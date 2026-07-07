import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/ui/BackButton';
import { AlbumHero } from '../../components/album/AlbumHero';
import { MyListenSection } from '../../components/album/MyListenSection';
import { DiaryEntryBottomSheet } from '../../components/album/DiaryEntryBottomSheet';
import { ReviewsSection } from '../../components/album/ReviewsSection';
import { NetworkListenersSection } from '../../components/album/NetworkListenersSection';
import { AppearsInLists } from '../../components/album/AppearsInLists';
import { ArtistAlbumsSection } from '../../components/album/ArtistAlbumsSection';
import { AddToListBottomSheet } from '../../components/album/AddToListBottomSheet';
import { AlbumCard } from '../../components/album/AlbumCard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { coverSrcWithFallback } from '../../lib/cover';
import { msToMMSS, msToDuration } from '../../lib/formatDate';
import { getMyDiaryEntries, getAlbumReviewsPreview, type MyDiaryEntry, type AlbumReview } from '../../lib/diary';
import { getUserLists, getUserListsContaining, getPublicListsContaining, type UserListSummary, type PublicListPreview } from '../../lib/lists';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { getArtistReleases, type ArtistRelease } from '../../lib/musicbrainz';
import { getSimilarAlbums, type SimilarAlbum } from '../../lib/album';
import { parseFeaturedRows, type FeaturedCredit, type RawFeaturedRow } from '../../lib/creditedArtists';
import { h2Style, smStyle, metaStyle, labelStyle } from '../../lib/typography';

type Track = {
  id: string;
  title: string;
  duration_ms: number | null;
  track_no: number | null;
  disc_no: number | null;
  track_featured_artists: RawFeaturedRow[] | null;
};

/** Miroir de trackFeaturedSuffix (web, apps/web/app/albums/[id]/page.tsx). */
function trackFeaturedSuffix(track: Track): string {
  return parseFeaturedRows(track.track_featured_artists)
    .map((f) => `${f.joinphrase || ' feat. '}${f.artist.name}`)
    .join('');
}

type AlbumData = {
  id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  artist_id: string | null;
  mbid: string | null;
};

type ArtistData = { id: string; name: string; mbid: string | null };

type NetworkListener = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  entryId: string | null;
  hasReview: boolean;
};

/** Miroir de apps/web/app/albums/[id]/page.tsx — voir le commentaire de scope dans
 * docs/MOBILE_ROADMAP.md (6.3) : enrichissement (genres/description/streaming ajoutés
 * après import) et import MusicBrainz sont en mode dégradé (Phase 8 non faite). */
export default function AlbumPage() {
  const { id, scrollTo } = useLocalSearchParams<{ id: string; scrollTo?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const scrolledToReviews = useRef(false);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [featuredArtists, setFeaturedArtists] = useState<FeaturedCredit[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [genreWeights, setGenreWeights] = useState<Record<string, number>>({});
  const [streamingLinks, setStreamingLinks] = useState<{ spotify?: string | null; appleMusic?: string | null; deezer?: string | null }>({});
  const [stats, setStats] = useState({ avg_rating: null as number | null, listeners_count: 0, reviews_count: 0 });
  const [myEntries, setMyEntries] = useState<MyDiaryEntry[]>([]);
  const [reviewsPreview, setReviewsPreview] = useState<AlbumReview[]>([]);
  const [networkListeners, setNetworkListeners] = useState<NetworkListener[]>([]);
  const [userLists, setUserLists] = useState<UserListSummary[]>([]);
  const [listsContaining, setListsContaining] = useState<string[]>([]);
  const [publicListsContaining, setPublicListsContaining] = useState<PublicListPreview[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<AlbumData[]>([]);
  const [artistMbReleases, setArtistMbReleases] = useState<ArtistRelease[]>([]);
  const [similarAlbums, setSimilarAlbums] = useState<SimilarAlbum[]>([]);

  const [diarySheetOpen, setDiarySheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MyDiaryEntry | undefined>(undefined);
  const [listSheetOpen, setListSheetOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);

    const { data: albumRow } = await supabase
      .from('albums')
      .select('id, title, cover_url, release_date, artist_id, mbid')
      .eq('id', id)
      .maybeSingle();

    if (!albumRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setAlbum(albumRow);

    const [artistRes, tracksRes, featuredRes] = await Promise.all([
      albumRow.artist_id
        ? supabase.from('artists').select('id, name, mbid').eq('id', albumRow.artist_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('tracks')
        .select('id, title, duration_ms, track_no, disc_no, track_featured_artists(position, joinphrase, artists(id, name))')
        .eq('album_id', id)
        .order('disc_no', { ascending: true, nullsFirst: true })
        .order('track_no', { ascending: true, nullsFirst: true }),
      supabase
        .from('album_featured_artists')
        .select('position, joinphrase, artists(id, name)')
        .eq('album_id', id)
        .order('position', { ascending: true }),
    ]);
    setArtist(artistRes.data as ArtistData | null);
    setTracks((tracksRes.data ?? []) as unknown as Track[]);
    setFeaturedArtists(parseFeaturedRows(featuredRes.data as any));

    const [
      genresRes,
      metaRes,
      statsRes,
      myEntriesData,
      reviewsPreviewData,
      userListsData,
      listsContainingData,
      publicListsContainingData,
      artistAlbumsRes,
      artistMbReleasesRes,
      similarAlbumsData,
      followsRes,
    ] = await Promise.all([
      supabase.from('album_genres').select('weight, source, genres(name)').eq('album_id', id).order('weight', { ascending: false }).limit(3),
      supabase.from('album_metadata').select('spotify_url, apple_music_url, deezer_url').eq('album_id', id).maybeSingle(),
      supabase.from('album_stats').select('reviews_count, avg_rating, listeners_count').eq('album_id', id).maybeSingle(),
      getMyDiaryEntries(id),
      getAlbumReviewsPreview(id, 3),
      user ? getUserLists() : Promise.resolve([]),
      user ? getUserListsContaining(id) : Promise.resolve([]),
      getPublicListsContaining(id, 5),
      albumRow.artist_id
        ? supabase.from('albums').select('id, title, cover_url, mbid, release_date').eq('artist_id', albumRow.artist_id).neq('id', id).limit(8)
        : Promise.resolve({ data: [] as AlbumData[] }),
      artistRes.data?.mbid ? getArtistReleases(artistRes.data.mbid) : Promise.resolve(null),
      getSimilarAlbums(id),
      user ? supabase.from('follows').select('followee_id').eq('follower_id', user.id) : Promise.resolve({ data: null as any }),
    ]);

    const genresData = (genresRes.data ?? []) as Array<{ weight: number; source: string; genres: { name: string } | { name: string }[] | null }>;
    const genreName = (g: { name: string } | { name: string }[] | null): string | null =>
      g == null ? null : Array.isArray(g) ? g[0]?.name ?? null : g.name;
    setGenres(genresData.flatMap((r) => {
      const name = genreName(r.genres);
      return name ? [name] : [];
    }));
    setGenreWeights(Object.fromEntries(
      genresData
        .filter((r) => r.source === 'community' && genreName(r.genres))
        .map((r) => [genreName(r.genres)!, r.weight ?? 1])
    ));
    setStreamingLinks({
      spotify: metaRes.data?.spotify_url ?? null,
      appleMusic: metaRes.data?.apple_music_url ?? null,
      deezer: metaRes.data?.deezer_url ?? null,
    });
    const s = statsRes.data;
    setStats({
      avg_rating: s?.avg_rating != null ? Number(s.avg_rating) : null,
      listeners_count: s?.listeners_count ?? 0,
      reviews_count: s?.reviews_count ?? 0,
    });
    setMyEntries(myEntriesData);
    setReviewsPreview(reviewsPreviewData);
    setUserLists(userListsData);
    setListsContaining(listsContainingData);
    setPublicListsContaining(publicListsContainingData);
    setArtistAlbums((artistAlbumsRes.data as AlbumData[]) ?? []);
    setArtistMbReleases(artistMbReleasesRes?.success ? artistMbReleasesRes.releases ?? [] : []);
    setSimilarAlbums(similarAlbumsData);

    const followeeIds = ((followsRes.data ?? []) as Array<{ followee_id: string }>).map((f) => f.followee_id);
    if (user && followeeIds.length > 0) {
      const [{ data: entries }, { data: profiles }] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('id, user_id, rating, listened_at, review_body')
          .eq('album_id', id)
          .in('user_id', followeeIds)
          .order('listened_at', { ascending: false }),
        supabase.from('profiles').select('id, username, avatar_url').in('id', followeeIds),
      ]);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const latestByUser = new Map<string, NetworkListener>();
      for (const e of entries ?? []) {
        if (latestByUser.has(e.user_id)) continue;
        const p = profileMap.get(e.user_id);
        if (!p) continue;
        latestByUser.set(e.user_id, {
          userId: p.id,
          username: p.username ?? '',
          avatarUrl: p.avatar_url ?? null,
          rating: e.rating,
          entryId: e.id,
          hasReview: !!(e.review_body && e.review_body.trim()),
        });
      }
      setNetworkListeners([...latestByUser.values()]);
    } else {
      setNetworkListeners([]);
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  // L'enrichissement (genres/liens streaming) tourne en tâche de fond après l'import (Edge
  // Function import-musicbrainz) et finit typiquement quelques secondes après le premier
  // chargement de cette page. Pas de Realtime Supabase dans ce projet (nouvelle brique
  // d'infra pour un besoin ponctuel) — un polling léger et borné dans le temps suffit : on
  // ne réinterroge que le sous-ensemble genres/liens (pas tout `load()`), toutes les 3s,
  // jusqu'à 5 tentatives, et on s'arrête dès qu'une donnée apparaît.
  useEffect(() => {
    if (!id || loading) return; // attend la fin du chargement initial avant de juger l'état
    if (genres.length > 0 || hasSomeLinks) return; // déjà enrichi — rien à attendre

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const [genresRes, metaRes] = await Promise.all([
        supabase.from('album_genres').select('weight, source, genres(name)').eq('album_id', id).order('weight', { ascending: false }).limit(3),
        supabase.from('album_metadata').select('spotify_url, apple_music_url, deezer_url').eq('album_id', id).maybeSingle(),
      ]);
      if (cancelled) return;

      const genresData = (genresRes.data ?? []) as Array<{ weight: number; source: string; genres: { name: string } | { name: string }[] | null }>;
      const genreName = (g: { name: string } | { name: string }[] | null): string | null =>
        g == null ? null : Array.isArray(g) ? g[0]?.name ?? null : g.name;
      const names = genresData.flatMap((r) => {
        const name = genreName(r.genres);
        return name ? [name] : [];
      });
      const links = {
        spotify: metaRes.data?.spotify_url ?? null,
        appleMusic: metaRes.data?.apple_music_url ?? null,
        deezer: metaRes.data?.deezer_url ?? null,
      };
      const found = names.length > 0 || !!(links.spotify || links.appleMusic || links.deezer);

      if (found) {
        setGenres(names);
        setGenreWeights(Object.fromEntries(
          genresData
            .filter((r) => r.source === 'community' && genreName(r.genres))
            .map((r) => [genreName(r.genres)!, r.weight ?? 1])
        ));
        setStreamingLinks(links);
      } else if (attempts < 5) {
        timeoutId = setTimeout(poll, 3000);
      }
    };

    let timeoutId = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loading]);

  const { refreshControl } = usePullToRefresh(() => load(true));

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#1C1C1C" />
      </View>
    );
  }

  if (notFound || !album) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text
          className="text-text-primary mb-2"
          style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22, lineHeight: 26, letterSpacing: -0.11 }}
        >
          Album introuvable
        </Text>
        <Text className="text-text-secondary text-center mb-6" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
          Cet album n'existe pas ou a été supprimé.
        </Text>
        <BackButton />
      </View>
    );
  }

  const { src: heroCoverSrc, fallback: heroCoverFallback } = coverSrcWithFallback(album.mbid, album.cover_url);
  const year = album.release_date ? new Date(album.release_date).getFullYear() : null;
  const trackCount = tracks.length;
  const totalDurationMs = tracks.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0);
  const hasExistingEntry = myEntries.length > 0;
  const myLatestEntry = myEntries[0];

  const hasSomeLinks = !!(streamingLinks.spotify || streamingLinks.appleMusic || streamingLinks.deezer);
  const hasStatsRow = stats.avg_rating !== null || stats.listeners_count > 0 || stats.reviews_count > 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        refreshControl={refreshControl}
      >
        <View style={{ paddingTop: 16 }}>
          <BackButton />
        </View>

        <View className="mt-4 mb-6">
          <AlbumHero
            album={{
              id: album.id,
              title: album.title,
              artist: artist?.name || 'Artiste inconnu',
              artistId: artist?.id,
              coverSrc: heroCoverSrc,
              coverFallback: heroCoverFallback,
              year,
              featuredArtists: featuredArtists.length > 0 ? featuredArtists : undefined,
            }}
            genres={genres}
            genreWeights={genreWeights}
            streamingLinks={hasSomeLinks ? streamingLinks : undefined}
            diaryButtonLabel={hasExistingEntry ? 'Ré-écouter' : 'Ajouter au journal'}
            listsContainingCount={listsContaining.length}
            onAddToDiary={() => {
              if (!user) return;
              setEditingEntry(undefined);
              setDiarySheetOpen(true);
            }}
            onAddToList={() => {
              if (!user) return;
              setListSheetOpen(true);
            }}
          />
        </View>

        {networkListeners.length > 0 && <NetworkListenersSection listeners={networkListeners} />}

        {hasStatsRow && (
          <View className="flex-row border-t border-b border-rule py-3 mb-8">
            {stats.avg_rating !== null && (
              <View className="flex-1 pr-4 border-r border-rule">
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                  {stats.avg_rating.toFixed(1).replace('.', ',')}
                  <Text className="uppercase text-text-tertiary" style={{ fontFamily: 'Inter_400Regular', fontSize: 9 }}> /10</Text>
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Moyenne</Text>
              </View>
            )}
            {stats.listeners_count > 0 && (
              <View className="flex-1 px-4 border-r border-rule">
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                  {stats.listeners_count.toLocaleString()}
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Auditeurs</Text>
              </View>
            )}
            {stats.reviews_count > 0 && (
              <View className="flex-1 pl-4">
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 26 }}>
                  {stats.reviews_count.toLocaleString()}
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Critiques</Text>
              </View>
            )}
          </View>
        )}

        {myLatestEntry && (
          <MyListenSection
            entry={myLatestEntry}
            entriesCount={myEntries.length}
            onEdit={() => { setEditingEntry(myLatestEntry); setDiarySheetOpen(true); }}
            onAddReview={() => { setEditingEntry(myLatestEntry); setDiarySheetOpen(true); }}
            onDeleted={load}
          />
        )}

        {tracks.length > 0 && (
          <View className={`${(hasStatsRow || !!myLatestEntry) ? 'pt-8' : 'border-t border-border-divider pt-8'} mb-12`}>
            <Text className="text-text-primary mb-1" style={h2Style}>Morceaux</Text>
            {(trackCount > 0 || totalDurationMs > 0) && (
              <Text className="text-text-tertiary mb-5" style={smStyle}>
                {trackCount > 0 && `${trackCount} morceau${trackCount > 1 ? 'x' : ''}`}
                {trackCount > 0 && totalDurationMs > 0 && ' · '}
                {totalDurationMs > 0 && msToDuration(totalDurationMs)}
              </Text>
            )}
            {tracks.map((t, idx) => (
              <View key={t.id} className="flex-row items-baseline gap-4 py-2">
                <Text
                  className="text-accent w-7 text-right"
                  style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 16, lineHeight: 16 }}
                >
                  {t.track_no ?? idx + 1}
                </Text>
                <Text className="flex-1 text-text-primary" style={metaStyle} numberOfLines={1}>
                  {t.title}
                  {trackFeaturedSuffix(t) && (
                    <Text className="text-text-tertiary">{trackFeaturedSuffix(t)}</Text>
                  )}
                </Text>
                <Text className="text-text-tertiary" style={labelStyle}>{msToMMSS(t.duration_ms)}</Text>
              </View>
            ))}
          </View>
        )}

        <View
          onLayout={(e) => {
            reviewsY.current = e.nativeEvent.layout.y;
            if (scrollTo === 'reviews' && !scrolledToReviews.current) {
              scrolledToReviews.current = true;
              scrollRef.current?.scrollTo({ y: reviewsY.current - 16, animated: true });
            }
          }}
        >
          <ReviewsSection albumId={album.id} reviewsCount={stats.reviews_count} initialReviews={reviewsPreview} />
        </View>

        {publicListsContaining.length > 0 && <AppearsInLists lists={publicListsContaining} />}

        {(artistAlbums.length > 0 || artistMbReleases.length > 0) && (
          <ArtistAlbumsSection
            albums={artistAlbums}
            mbReleases={artistMbReleases}
            artistName={artist?.name ?? ''}
            primaryArtistName={featuredArtists.length > 0 ? artist?.name : undefined}
          />
        )}

        <View className="border-t border-border-divider pt-8 mb-12">
          <Text className="text-text-primary mb-5" style={h2Style}>Albums similaires</Text>
          {similarAlbums.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {similarAlbums.map((a) => {
                const { src, fallback } = coverSrcWithFallback(a.mbid, a.cover_url);
                return (
                  <AlbumCard
                    key={a.id}
                    album={{ id: a.id, title: a.title, coverSrc: src, coverFallback: fallback }}
                    year={a.year ?? undefined}
                    width={140}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <Text className="text-text-tertiary" style={metaStyle}>Aucun album similaire trouvé pour le moment.</Text>
          )}
        </View>
      </ScrollView>

      <DiaryEntryBottomSheet
        isOpen={diarySheetOpen}
        onClose={() => setDiarySheetOpen(false)}
        albumId={album.id}
        editingEntry={editingEntry}
        hasExistingEntry={hasExistingEntry}
        onSaved={load}
      />
      <AddToListBottomSheet
        isOpen={listSheetOpen}
        onClose={() => setListSheetOpen(false)}
        albumId={album.id}
        userLists={userLists}
        listsContaining={listsContaining}
        onChanged={setListsContaining}
      />
    </View>
  );
}
