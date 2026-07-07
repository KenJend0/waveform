import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/ui/BackButton';
import { Avatar } from '../../components/avatars/Avatar';
import { NetworkListenersSection } from '../../components/album/NetworkListenersSection';
import { ArtistPopularSection } from '../../components/artist/ArtistPopularSection';
import { ArtistDiscographySection } from '../../components/artist/ArtistDiscographySection';
import { ArtistAppearsOnSection, type Apparition } from '../../components/artist/ArtistAppearsOnSection';
import { ArtistSimilarSection } from '../../components/artist/ArtistSimilarSection';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { getArtistReleases, type ArtistRelease } from '../../lib/musicbrainz';
import { getSimilarArtists, type SimilarArtist } from '../../lib/artists';

type ArtistData = { id: string; name: string; mbid: string | null; image_url: string | null };

type AlbumRow = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  mbid: string | null;
  avg_rating: number | null;
  listeners_count: number;
  reviews_count: number;
};

type NetworkListener = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  entryId: string | null;
  hasReview: boolean;
};

/**
 * Miroir de apps/web/app/artists/[id]/page.tsx + ArtistPageContent.tsx — voir les
 * notes de scope 6.5 dans docs/MOBILE_ROADMAP.md (Phase 8 backend mobile non faite) :
 * - Photo : lue en DB uniquement (image_url), avec fallback sur la 1re cover d'album
 *   trouvée en DB. Pas de fetch MusicBrainz/Wikidata ni d'écriture cache (admin/service_role
 *   côté web, jamais exposable côté mobile) — même dégradation que l'enrichissement album (6.3).
 * - Discographie : albums DB + releases MusicBrainz non importées affichées (API publique).
 * - Artistes similaires : délègue à l'Edge Function `similar-artists` (lib/artists.ts),
 *   qui appelle Last.fm avec LASTFM_API_KEY côté serveur (secret jamais exposé au client).
 */
export default function ArtistPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [mbReleases, setMbReleases] = useState<ArtistRelease[]>([]);
  const [artistStats, setArtistStats] = useState({ totalListeners: 0, globalAvgRating: null as number | null, totalReviews: 0 });
  const [networkListeners, setNetworkListeners] = useState<NetworkListener[]>([]);
  const [apparitions, setApparitions] = useState<Apparition[]>([]);
  const [similarArtists, setSimilarArtists] = useState<SimilarArtist[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: artistRow } = await supabase
      .from('artists')
      .select('id, name, mbid, image_url')
      .eq('id', id)
      .maybeSingle();

    if (!artistRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: albumRows } = await supabase
      .from('albums')
      .select('id, title, cover_url, release_date, mbid')
      .eq('artist_id', id)
      .order('release_date', { ascending: false, nullsFirst: true })
      .order('title', { ascending: true });

    const albumIds = (albumRows ?? []).map((a) => a.id);

    const [
      statsRes,
      relResult,
      albumListenerRows,
      trackListenerRows,
      albumFeaturedRows,
      trackFeaturedRows,
      followsRes,
      fallbackImageRes,
      similarArtistsResult,
    ] = await Promise.all([
      albumIds.length > 0
        ? supabase.from('album_stats').select('album_id, avg_rating, reviews_count, listeners_count').in('album_id', albumIds)
        : Promise.resolve({ data: [] as any[] }),
      artistRow.mbid ? getArtistReleases(artistRow.mbid) : Promise.resolve(null),
      albumIds.length > 0
        ? supabase.from('diary_entries').select('user_id, review_body').in('album_id', albumIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('track_diary_entries').select('user_id, review_body').eq('artist_id', id),
      supabase
        .from('album_featured_artists')
        .select('albums(id, title, cover_url, release_date, artists(name))')
        .eq('artist_id', id),
      supabase
        .from('track_featured_artists')
        .select('tracks(albums(id, title, cover_url, release_date, artists(name)))')
        .eq('artist_id', id),
      user ? supabase.from('follows').select('followee_id').eq('follower_id', user.id) : Promise.resolve({ data: null as any }),
      !artistRow.image_url && albumIds.length > 0
        ? supabase.from('albums').select('cover_url').eq('artist_id', id).not('cover_url', 'is', null).limit(1).maybeSingle()
        : Promise.resolve({ data: null as any }),
      getSimilarArtists(artistRow.name, artistRow.mbid),
    ]);

    const statsMap = new Map((statsRes.data ?? []).map((s: any) => [s.album_id, {
      avg_rating: s.avg_rating != null ? Number(s.avg_rating) : null,
      reviews_count: s.reviews_count ?? 0,
      listeners_count: s.listeners_count ?? 0,
    }]));

    const albumsWithStats: AlbumRow[] = (albumRows ?? []).map((a) => ({
      ...a,
      avg_rating: statsMap.get(a.id)?.avg_rating ?? null,
      reviews_count: statsMap.get(a.id)?.reviews_count ?? 0,
      listeners_count: statsMap.get(a.id)?.listeners_count ?? 0,
    }));
    setAlbums(albumsWithStats);

    const fallbackImage = (fallbackImageRes.data as { cover_url: string | null } | null)?.cover_url ?? null;
    setArtist({ ...artistRow, image_url: artistRow.image_url ?? fallbackImage });

    setMbReleases(relResult?.success && relResult.releases ? relResult.releases : []);
    setSimilarArtists(similarArtistsResult);

    // Stats agrégées — auditeurs uniques + moyenne + critiques, albums + titres fusionnés
    const ratedAlbums = albumsWithStats.filter((a) => a.avg_rating !== null);
    const globalAvgRating = ratedAlbums.length > 0
      ? ratedAlbums.reduce((s, a) => s + (a.avg_rating ?? 0), 0) / ratedAlbums.length
      : null;
    const albumReviewsFromStats = albumsWithStats.reduce((s, a) => s + a.reviews_count, 0);

    const albumListenerIds = new Set((albumListenerRows.data ?? []).map((r: any) => r.user_id));
    const trackListenerIds = new Set((trackListenerRows.data ?? []).map((r: any) => r.user_id));
    const totalListeners = new Set([...albumListenerIds, ...trackListenerIds]).size;
    const trackReviewsCount = (trackListenerRows.data ?? []).filter((r: any) => r.review_body).length;
    setArtistStats({ totalListeners, globalAvgRating, totalReviews: albumReviewsFromStats + trackReviewsCount });

    // Apparitions — albums crédités en featuring (album OU piste), dédupliqués par album
    const apparitionsByAlbumId = new Map<string, Apparition>();
    const addApparitionAlbum = (a: any) => {
      if (!a || apparitionsByAlbumId.has(a.id)) return;
      apparitionsByAlbumId.set(a.id, {
        id: a.id,
        title: a.title,
        coverUrl: a.cover_url,
        subtitle: a.artists?.name || 'Artiste inconnu',
        year: a.release_date ? new Date(a.release_date).getFullYear() : null,
      });
    };
    ((albumFeaturedRows.data ?? []) as any[]).forEach((row) => addApparitionAlbum(row.albums));
    ((trackFeaturedRows.data ?? []) as any[]).forEach((row) => addApparitionAlbum(row.tracks?.albums));
    setApparitions([...apparitionsByAlbumId.values()]);

    // Activité réseau — qui parmi mes abonnements a écouté cet artiste (albums ou titres)
    const followeeIds = ((followsRes.data ?? []) as Array<{ followee_id: string }>).map((f) => f.followee_id);
    if (user && followeeIds.length > 0) {
      const followeeSet = new Set(followeeIds);
      const followeeListenerIds = [...new Set([
        ...[...albumListenerIds].filter((uid) => followeeSet.has(uid)),
        ...[...trackListenerIds].filter((uid) => followeeSet.has(uid)),
      ])];
      if (followeeListenerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', followeeListenerIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        setNetworkListeners(
          followeeListenerIds
            .map((uid): NetworkListener | null => {
              const p = profileMap.get(uid);
              if (!p) return null;
              return { userId: p.id, username: p.username ?? '', avatarUrl: p.avatar_url ?? null, rating: null, entryId: null, hasReview: false };
            })
            .filter((x): x is NetworkListener => x !== null)
        );
      } else {
        setNetworkListeners([]);
      }
    } else {
      setNetworkListeners([]);
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#1C1C1C" />
      </View>
    );
  }

  if (notFound || !artist) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text
          className="text-text-primary mb-2"
          style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22, lineHeight: 26, letterSpacing: -0.11 }}
        >
          Artiste introuvable
        </Text>
        <Text className="text-text-secondary text-center mb-6" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
          Cet artiste n'existe pas ou a été supprimé.
        </Text>
        <BackButton />
      </View>
    );
  }

  const hasStatsRow = artistStats.globalAvgRating !== null || artistStats.totalListeners > 0 || artistStats.totalReviews > 0;
  const topAlbums = [...albums]
    .filter((a) => a.listeners_count > 0)
    .sort((a, b) => (b.listeners_count - a.listeners_count) || ((b.avg_rating ?? 0) - (a.avg_rating ?? 0)))
    .slice(0, 3);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}>
        <View style={{ paddingTop: 16 }}>
          <BackButton />
        </View>

        <View className="mt-4 mb-10">
          <View className="flex-row items-center gap-5">
            <Avatar src={artist.image_url} size={80} />
            <View className="flex-1 min-w-0">
              <Text
                className="text-text-primary"
                style={{ fontFamily: 'Inter_500Medium', fontSize: 32, letterSpacing: -0.64, lineHeight: 38.4 }}
              >
                {artist.name}
              </Text>
            </View>
          </View>

          {networkListeners.length > 0 && (
            <View className="mt-5">
              <NetworkListenersSection listeners={networkListeners} itemLabel="cet artiste" />
            </View>
          )}

          {hasStatsRow && (
            <View className="flex-row border-t border-b border-rule py-3 mt-5">
              {artistStats.globalAvgRating !== null && (
                <View className="flex-1 pr-4 border-r border-rule">
                  <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                    {artistStats.globalAvgRating.toFixed(1).replace('.', ',')}
                    <Text className="uppercase text-text-tertiary" style={{ fontFamily: 'Inter_400Regular', fontSize: 9 }}> /10</Text>
                  </Text>
                  <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Moyenne</Text>
                </View>
              )}
              {artistStats.totalListeners > 0 && (
                <View className="flex-1 px-4 border-r border-rule">
                  <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                    {artistStats.totalListeners.toLocaleString()}
                  </Text>
                  <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Auditeurs</Text>
                </View>
              )}
              {artistStats.totalReviews > 0 && (
                <View className="flex-1 pl-4">
                  <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                    {artistStats.totalReviews.toLocaleString()}
                  </Text>
                  <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Critiques</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <ArtistPopularSection albums={topAlbums} />

        <ArtistDiscographySection albums={albums} mbReleases={mbReleases} artistName={artist.name} />

        <ArtistAppearsOnSection apparitions={apparitions} />

        <ArtistSimilarSection artists={similarArtists} />
      </ScrollView>
    </View>
  );
}
