import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/ui/BackButton';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { TrackHero } from '../../components/track/TrackHero';
import { TrackMyListenSection } from '../../components/track/TrackMyListenSection';
import { TrackDiaryBottomSheet } from '../../components/track/TrackDiaryBottomSheet';
import { TrackReviewsSection } from '../../components/track/TrackReviewsSection';
import { NetworkListenersSection } from '../../components/album/NetworkListenersSection';
import { AddToListBottomSheet } from '../../components/album/AddToListBottomSheet';
import { AlbumCard } from '../../components/album/AlbumCard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { coverSrcWithFallback } from '../../lib/cover';
import { msToMMSS } from '../../lib/formatDate';
import { getTrack, getAlbumTracks, type TrackDetail, type AlbumTrackItem } from '../../lib/tracks';
import { getMyTrackDiaryEntries, getTrackReviewsPreview, getTrackStats, type MyTrackDiaryEntry, type TrackReview, type TrackStat } from '../../lib/trackDiary';
import { getUserLists, getUserListsContainingTrack, type UserListSummary } from '../../lib/lists';
import { h2Style, metaStyle } from '../../lib/typography';

type ArtistAlbum = { id: string; title: string; cover_url: string | null; release_date: string | null; mbid: string | null };

type NetworkListener = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  entryId: string | null;
  hasReview: boolean;
};

/** Miroir de apps/web/app/tracks/[id]/page.tsx — même dégradation de scope que la page
 * album (voir docs/MOBILE_ROADMAP.md 6.3) : pas d'enrichissement/import MB déclenché
 * depuis mobile, pas de fanout feed pour les nouvelles écoutes. */
export default function TrackPage() {
  const { id, scrollTo } = useLocalSearchParams<{ id: string; scrollTo?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const scrolledToReviews = useRef(false);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [streamingLinks, setStreamingLinks] = useState<{ spotify?: string | null; appleMusic?: string | null; deezer?: string | null }>({});
  const [stats, setStats] = useState<TrackStat | null>(null);
  const [myEntries, setMyEntries] = useState<MyTrackDiaryEntry[]>([]);
  const [reviewsPreview, setReviewsPreview] = useState<TrackReview[]>([]);
  const [networkListeners, setNetworkListeners] = useState<NetworkListener[]>([]);
  const [userLists, setUserLists] = useState<UserListSummary[]>([]);
  const [listsContaining, setListsContaining] = useState<string[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<ArtistAlbum[]>([]);

  const [diarySheetOpen, setDiarySheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MyTrackDiaryEntry | undefined>(undefined);
  const [listSheetOpen, setListSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const t = await getTrack(id);
    if (!t) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setTrack(t);

    const [
      statsData,
      reviewsData,
      myEntriesData,
      albumTracksData,
      genresRes,
      trackMetaRes,
      albumMetaRes,
      artistAlbumsRes,
      userListsData,
      listsContainingData,
      followsRes,
    ] = await Promise.all([
      getTrackStats(id),
      getTrackReviewsPreview(id, 5),
      getMyTrackDiaryEntries(id),
      getAlbumTracks(t.album_id),
      supabase.from('album_genres').select('weight, genres(name)').eq('album_id', t.album_id).order('weight', { ascending: false }).limit(3),
      supabase.from('track_metadata').select('spotify_url, apple_music_url, deezer_url').eq('track_id', id).maybeSingle(),
      supabase.from('album_metadata').select('spotify_url, apple_music_url, deezer_url').eq('album_id', t.album_id).maybeSingle(),
      supabase.from('albums').select('id, title, cover_url, release_date, mbid').eq('artist_id', t.artist_id).neq('id', t.album_id).limit(6),
      user ? getUserLists() : Promise.resolve([]),
      user ? getUserListsContainingTrack(id) : Promise.resolve([]),
      user ? supabase.from('follows').select('followee_id').eq('follower_id', user.id) : Promise.resolve({ data: null as any }),
    ]);

    const genreName = (g: { name: string } | { name: string }[] | null): string | null =>
      g == null ? null : Array.isArray(g) ? g[0]?.name ?? null : g.name;
    setGenres(((genresRes.data ?? []) as Array<{ genres: { name: string } | { name: string }[] | null }>)
      .flatMap((r) => { const n = genreName(r.genres); return n ? [n] : []; }));

    setStreamingLinks({
      spotify: trackMetaRes.data?.spotify_url ?? albumMetaRes.data?.spotify_url ?? null,
      appleMusic: trackMetaRes.data?.apple_music_url ?? albumMetaRes.data?.apple_music_url ?? null,
      deezer: trackMetaRes.data?.deezer_url ?? albumMetaRes.data?.deezer_url ?? null,
    });

    setStats(statsData);
    setReviewsPreview(reviewsData);
    setMyEntries(myEntriesData);
    setAlbumTracks(albumTracksData);
    setArtistAlbums((artistAlbumsRes.data as ArtistAlbum[]) ?? []);
    setUserLists(userListsData);
    setListsContaining(listsContainingData);

    const followeeIds = ((followsRes.data ?? []) as Array<{ followee_id: string }>).map((f) => f.followee_id);
    if (user && followeeIds.length > 0) {
      const [{ data: entries }, { data: profiles }] = await Promise.all([
        supabase
          .from('track_diary_entries')
          .select('id, user_id, rating, listened_at, review_body')
          .eq('track_id', id)
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (notFound || !track) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-text-primary mb-2" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22, lineHeight: 26, letterSpacing: -0.11 }}>
          Titre introuvable
        </Text>
        <Text className="text-text-secondary text-center mb-6" style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>
          Ce titre n'existe pas ou a été supprimé.
        </Text>
        <BackButton />
      </View>
    );
  }

  const { src: heroCoverSrc, fallback: heroCoverFallback } = coverSrcWithFallback(track.album_mbid, track.cover_url);
  const year = track.release_date ? new Date(track.release_date).getFullYear() : null;
  const hasExistingEntry = myEntries.length > 0;
  const myLatestEntry = myEntries[0];
  const hasSomeLinks = !!(streamingLinks.spotify || streamingLinks.appleMusic || streamingLinks.deezer);
  const hasStats = !!stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.reviews_count > 0);
  const otherTracks = albumTracks.filter((t) => t.id !== track.id).slice(0, 8);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}>
        <View style={{ paddingTop: 16 }}>
          <BackButton />
        </View>

        <View className="mt-4 mb-6">
          <TrackHero
            track={{
              id: track.id,
              title: track.title,
              artist: track.artist_name,
              artistId: track.artist_id,
              albumId: track.album_id,
              albumTitle: track.album_title,
              albumType: track.album_type,
              coverSrc: heroCoverSrc,
              coverFallback: heroCoverFallback,
              year,
              featuredArtists: track.featuredArtists.length > 0 ? track.featuredArtists : undefined,
            }}
            genres={genres}
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

        {networkListeners.length > 0 && (
          <NetworkListenersSection listeners={networkListeners} itemLabel="ce titre" entryPrefix="/track-diary/" />
        )}

        {hasStats && stats && (
          <View className="flex-row border-t border-b border-rule py-3 mb-8">
            {stats.avg_rating !== null && (
              <View className="flex-1 pr-4 border-r border-rule">
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
                  {stats.avg_rating.toFixed(1).replace('.', ',')}
                  <Text className="uppercase text-text-tertiary" style={{ fontFamily: 'Inter_400Regular', fontSize: 9 }}> /10</Text>
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Moyenne</Text>
              </View>
            )}
            {stats.listeners_count > 0 && (
              <View className="flex-1 px-4 border-r border-rule">
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
                  {stats.listeners_count.toLocaleString()}
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Auditeurs</Text>
              </View>
            )}
            {stats.reviews_count > 0 && (
              <Pressable
                className="flex-1 pl-4"
                onPress={() => scrollRef.current?.scrollTo({ y: reviewsY.current - 16, animated: true })}
              >
                <Text className="text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 26, lineHeight: 32 }}>
                  {stats.reviews_count.toLocaleString()}
                </Text>
                <Text className="uppercase text-text-tertiary mt-1.5" style={{ fontFamily: 'Inter_400Regular', fontSize: 10.5, letterSpacing: 1.68 }}>Critiques</Text>
              </Pressable>
            )}
          </View>
        )}

        {myLatestEntry && (
          <TrackMyListenSection
            entry={myLatestEntry}
            entriesCount={myEntries.length}
            onEdit={() => { setEditingEntry(myLatestEntry); setDiarySheetOpen(true); }}
            onAddReview={() => { setEditingEntry(myLatestEntry); setDiarySheetOpen(true); }}
            onDeleted={load}
          />
        )}

        {otherTracks.length > 0 && (
          <View className={`${myLatestEntry ? 'pt-8' : hasStats ? '' : 'border-t border-border-divider pt-8'} mb-12`}>
            <View className="flex-row items-baseline justify-between mb-4">
              <Text className="text-text-primary" style={h2Style}>Autres titres de l'album</Text>
              <Pressable onPress={() => router.push(`/albums/${track.album_id}` as any)} className="border-b border-accent pb-0.5">
                <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13, lineHeight: 13 }}>
                  voir l'album
                </Text>
              </Pressable>
            </View>
            {otherTracks.map((tr, idx) => (
              <Pressable
                key={tr.id}
                onPress={() => router.push(`/tracks/${tr.id}` as any)}
                className="flex-row items-center gap-3 py-2 px-3 rounded-button"
              >
                <Text className="text-accent w-7 text-right" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 16, lineHeight: 16, paddingRight: 3 }}>
                  {tr.track_no ?? idx + 1}
                </Text>
                <Text className="flex-1 text-text-primary" style={metaStyle} numberOfLines={1}>{tr.title}</Text>
                <Text className="text-text-tertiary" style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}>{msToMMSS(tr.duration_ms)}</Text>
              </Pressable>
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
          <TrackReviewsSection trackId={track.id} reviewsCount={stats?.reviews_count ?? 0} initialReviews={reviewsPreview} />
        </View>

        {artistAlbums.length > 0 && (
          <View className="border-t border-border-divider pt-8 mb-12">
            <View className="flex-row items-baseline justify-between mb-5">
              <Text className="text-text-primary" style={h2Style}>Plus de {track.artist_name}</Text>
              <Pressable onPress={() => router.push(`/artists/${track.artist_id}` as any)} className="border-b border-accent pb-0.5">
                <Text className="text-accent" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13, lineHeight: 13 }}>
                  voir l'artiste
                </Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {artistAlbums.map((a) => {
                const { src, fallback } = coverSrcWithFallback(a.mbid, a.cover_url);
                return (
                  <AlbumCard
                    key={a.id}
                    album={{ id: a.id, title: a.title, coverSrc: src, coverFallback: fallback }}
                    year={a.release_date ? new Date(a.release_date).getFullYear() : undefined}
                    width={140}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <TrackDiaryBottomSheet
        isOpen={diarySheetOpen}
        onClose={() => setDiarySheetOpen(false)}
        trackId={track.id}
        albumId={track.album_id}
        artistId={track.artist_id}
        editingEntry={editingEntry}
        hasExistingEntry={hasExistingEntry}
        onSaved={load}
      />
      <AddToListBottomSheet
        isOpen={listSheetOpen}
        onClose={() => setListSheetOpen(false)}
        trackId={track.id}
        userLists={userLists}
        listsContaining={listsContaining}
        onChanged={setListsContaining}
      />
    </View>
  );
}
