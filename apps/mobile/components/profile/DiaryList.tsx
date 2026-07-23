import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import { RatingBadge } from '../ui/RatingBadge';
import { BottomSheet } from '../ui/BottomSheet';
import { coverSrcWithFallback } from '../../lib/cover';
import { getUserDiary, type DiaryEntryUI, type DiarySort } from '../../lib/diary';
import { getUserTrackDiary, type TrackDiaryEntryUI, type TrackDiarySort } from '../../lib/trackDiary';
import { useRatingFilter } from '../../lib/RatingFilterContext';
import { labelStyle, metaMediumStyle } from '../../lib/typography';

const PAGE_SIZE = 51;
// Quand un filtre par note est actif, on récupère tout en une seule requête —
// miroir de MAX_FILTERED_RESULTS (web).
const MAX_FILTERED_RESULTS = 1000;
type MediaFilter = 'albums' | 'titres';

const albumSortLabels = (ratingLabel: string): Record<DiarySort, string> => ({
  date_listened: "Date d'écoute",
  release_date: 'Date de parution',
  personal_rating: ratingLabel,
});
const trackSortLabels = (ratingLabel: string): Record<TrackDiarySort, string> => ({
  date_listened: "Date d'écoute",
  personal_rating: ratingLabel,
});

function sortAlbums(list: DiaryEntryUI[], sort: DiarySort): DiaryEntryUI[] {
  return [...list].sort((a, b) => {
    if (sort === 'personal_rating') return (b.rating ?? 0) - (a.rating ?? 0);
    if (sort === 'release_date') {
      const dA = a.release_date ? new Date(a.release_date).getTime() : 0;
      const dB = b.release_date ? new Date(b.release_date).getTime() : 0;
      return dB - dA;
    }
    const diff = new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
    return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function sortTracks(list: TrackDiaryEntryUI[], sort: TrackDiarySort): TrackDiaryEntryUI[] {
  return [...list].sort((a, b) => {
    if (sort === 'personal_rating') return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
  });
}

type Props = {
  userId: string;
  initialAlbumEntries: DiaryEntryUI[];
  initialTrackEntries: TrackDiaryEntryUI[];
  ratingLabel?: string;
};

/**
 * Miroir de DiaryList (web) — toggle Albums/Titres + tri + pagination "Charger plus" +
 * filtre par note (piloté par RatingDistribution via RatingFilterContext). Les entrées
 * naviguent vers /diary/[entry_id] et /track-diary/[entry_id] (détail d'écoute + fil de
 * commentaires), comme le web.
 */
export const DiaryList = memo(function DiaryList({ userId, initialAlbumEntries, initialTrackEntries, ratingLabel = 'Ma note' }: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaFilter>(
    initialAlbumEntries.length === 0 && initialTrackEntries.length > 0 ? 'titres' : 'albums'
  );

  const [albumEntries, setAlbumEntries] = useState(initialAlbumEntries);
  const [albumHasMore, setAlbumHasMore] = useState(initialAlbumEntries.length === PAGE_SIZE);
  const [albumLoadingMore, setAlbumLoadingMore] = useState(false);
  const [albumSort, setAlbumSort] = useState<DiarySort>('date_listened');

  const [trackEntries, setTrackEntries] = useState(initialTrackEntries);
  const [trackHasMore, setTrackHasMore] = useState(initialTrackEntries.length === PAGE_SIZE);
  const [trackLoadingMore, setTrackLoadingMore] = useState(false);
  const [trackSort, setTrackSort] = useState<TrackDiarySort>('date_listened');

  const [sortOpen, setSortOpen] = useState(false);

  // Même piège que ListsTab (voir son commentaire) : sans resync, un pull-to-refresh ou
  // un retour sur l'onglet Journal après suppression d'une entrée depuis /diary ou
  // /track-diary ne se répercute jamais ici.
  useEffect(() => {
    setAlbumEntries(initialAlbumEntries);
    setAlbumHasMore(initialAlbumEntries.length === PAGE_SIZE);
  }, [initialAlbumEntries]);

  useEffect(() => {
    setTrackEntries(initialTrackEntries);
    setTrackHasMore(initialTrackEntries.length === PAGE_SIZE);
  }, [initialTrackEntries]);

  // Filtre par note — piloté par l'histogramme dans le header du profil.
  const { selectedRating, selectedCount } = useRatingFilter();
  const ratingFilter = selectedRating !== null ? selectedRating + 1 : null;

  const [filteredAlbums, setFilteredAlbums] = useState<DiaryEntryUI[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<TrackDiaryEntryUI[]>([]);
  const [albumFilterLoading, setAlbumFilterLoading] = useState(false);
  const [trackFilterLoading, setTrackFilterLoading] = useState(false);
  const filterRequestRef = useRef(0);

  useEffect(() => {
    if (ratingFilter === null) {
      setAlbumFilterLoading(false);
      setTrackFilterLoading(false);
      return;
    }

    const optimisticAlbums = albumEntries.filter((e) => e.rating === ratingFilter);
    const optimisticTracks = trackEntries.filter((e) => e.rating === ratingFilter);
    setFilteredAlbums(optimisticAlbums);
    setFilteredTracks(optimisticTracks);

    const albumsComplete = selectedCount !== null ? optimisticAlbums.length >= selectedCount : !albumHasMore;
    const tracksComplete = !trackHasMore;

    if (albumsComplete && tracksComplete) return;

    const requestId = ++filterRequestRef.current;
    if (!albumsComplete) setAlbumFilterLoading(true);
    if (!tracksComplete) setTrackFilterLoading(true);

    (async () => {
      const [albums, tracks] = await Promise.all([
        albumsComplete ? Promise.resolve(optimisticAlbums) : getUserDiary(userId, 0, MAX_FILTERED_RESULTS, 'date_listened', ratingFilter),
        tracksComplete ? Promise.resolve(optimisticTracks) : getUserTrackDiary(userId, 0, MAX_FILTERED_RESULTS, 'date_listened', ratingFilter),
      ]);
      if (filterRequestRef.current !== requestId) return;
      setFilteredAlbums(albums);
      setFilteredTracks(tracks);
      setAlbumFilterLoading(false);
      setTrackFilterLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter, selectedCount, userId]);

  const loadMoreAlbums = async () => {
    setAlbumLoadingMore(true);
    const more = await getUserDiary(userId, albumEntries.length, PAGE_SIZE, albumSort);
    setAlbumEntries((prev) => [...prev, ...more]);
    setAlbumHasMore(more.length === PAGE_SIZE);
    setAlbumLoadingMore(false);
  };

  const loadMoreTracks = async () => {
    setTrackLoadingMore(true);
    const more = await getUserTrackDiary(userId, trackEntries.length, PAGE_SIZE, trackSort);
    setTrackEntries((prev) => [...prev, ...more]);
    setTrackHasMore(more.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  const changeAlbumSort = async (next: DiarySort) => {
    setAlbumSort(next);
    setSortOpen(false);
    if (ratingFilter !== null) return;
    setAlbumLoadingMore(true);
    const fresh = await getUserDiary(userId, 0, PAGE_SIZE, next);
    setAlbumEntries(fresh);
    setAlbumHasMore(fresh.length === PAGE_SIZE);
    setAlbumLoadingMore(false);
  };

  const changeTrackSort = async (next: TrackDiarySort) => {
    setTrackSort(next);
    setSortOpen(false);
    if (ratingFilter !== null) return;
    setTrackLoadingMore(true);
    const fresh = await getUserTrackDiary(userId, 0, PAGE_SIZE, next);
    setTrackEntries(fresh);
    setTrackHasMore(fresh.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  const sortedAlbums = ratingFilter !== null ? sortAlbums(filteredAlbums, albumSort) : albumEntries;
  const sortedTracks = ratingFilter !== null ? sortTracks(filteredTracks, trackSort) : trackEntries;

  const albumSortLabelsMap = albumSortLabels(ratingLabel);
  const trackSortLabelsMap = trackSortLabels(ratingLabel);
  const currentSortLabel = media === 'albums' ? albumSortLabelsMap[albumSort] : trackSortLabelsMap[trackSort];

  return (
    <View>
      <View className="flex-row items-center justify-between mb-5">
        <Pressable onPress={() => setSortOpen((v) => !v)} className="flex-row items-center gap-1">
          <Text className="text-text-tertiary" style={labelStyle}>
            Trié par: <Text className="text-text-primary" style={metaMediumStyle}>{currentSortLabel}</Text>
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-1.5">
          <Pressable onPress={() => setMedia('albums')}>
            <Text className={media === 'albums' ? 'text-text-primary' : 'text-text-tertiary'} style={media === 'albums' ? metaMediumStyle : labelStyle}>
              Albums
            </Text>
          </Pressable>
          <Text className="text-text-disabled">·</Text>
          <Pressable onPress={() => setMedia('titres')}>
            <Text className={media === 'titres' ? 'text-text-primary' : 'text-text-tertiary'} style={media === 'titres' ? metaMediumStyle : labelStyle}>
              Titres
            </Text>
          </Pressable>
        </View>
      </View>

      <BottomSheet isOpen={sortOpen} onClose={() => setSortOpen(false)} title="Trier par" snapPoint="35%">
        <View className="px-6 py-2">
          {(media === 'albums'
            ? (Object.entries(albumSortLabelsMap) as [DiarySort, string][])
            : (Object.entries(trackSortLabelsMap) as [TrackDiarySort, string][])
          ).map(([opt, sortLabel]) => {
            const selected = media === 'albums' ? albumSort === opt : trackSort === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => (media === 'albums' ? changeAlbumSort(opt as DiarySort) : changeTrackSort(opt as TrackDiarySort))}
                className="flex-row items-center justify-between py-3.5 border-b border-border-divider"
              >
                <Text style={metaMediumStyle} className={selected ? 'text-text-primary' : 'text-text-secondary'}>
                  {sortLabel}
                </Text>
                {selected && <Check size={16} color="#8E6F5E" />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {((media === 'albums' && albumFilterLoading) || (media === 'titres' && trackFilterLoading)) && (
        <Text className="mb-4 text-text-tertiary" style={labelStyle}>Recherche d'autres résultats…</Text>
      )}

      {media === 'albums' ? (
        sortedAlbums.length === 0 ? (
          ratingFilter !== null && selectedCount !== null && selectedCount > 0 ? null : (
            <Text className="text-center text-text-tertiary py-12" style={metaMediumStyle}>
              {ratingFilter !== null ? 'Aucune entrée avec cette note' : 'Aucune entrée dans le journal'}
            </Text>
          )
        ) : (
          <>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {sortedAlbums.map((entry) => {
                const { src, fallback } = coverSrcWithFallback(entry.mbid, entry.cover_url);
                return (
                <Pressable key={entry.id} onPress={() => router.push(`/diary/${entry.id}` as any)} style={{ width: '31%' }}>
                  <View className="aspect-square rounded-input overflow-hidden bg-background-tertiary relative">
                    {src ? (
                      <CoverImage src={src} fallback={fallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                    ) : null}
                    {entry.rating != null && (
                      <View className="absolute top-1.5 right-1.5">
                        <RatingBadge rating={entry.rating} />
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} className="mt-2 text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 13 }}>{entry.album_title}</Text>
                  <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>{entry.artist_name}</Text>
                </Pressable>
                );
              })}
            </View>
            {ratingFilter === null && albumHasMore && (
              <Pressable onPress={loadMoreAlbums} disabled={albumLoadingMore} className="mt-6 items-center">
                {albumLoadingMore ? <ActivityIndicator size="small" color="#6B6B6B" /> : <Text className="text-text-tertiary" style={metaMediumStyle}>Charger plus</Text>}
              </Pressable>
            )}
          </>
        )
      ) : sortedTracks.length === 0 ? (
        <Text className="text-center text-text-tertiary py-12" style={metaMediumStyle}>
          {ratingFilter !== null ? 'Aucun titre avec cette note' : 'Aucun titre noté pour le moment'}
        </Text>
      ) : (
        <>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {sortedTracks.map((entry) => {
              const { src, fallback } = coverSrcWithFallback(entry.mbid, entry.cover_url);
              return (
              <Pressable key={entry.id} onPress={() => router.push(`/track-diary/${entry.id}` as any)} style={{ width: '31%' }}>
                <View className="aspect-square rounded-input overflow-hidden bg-background-tertiary relative">
                  {src ? (
                    <CoverImage src={src} fallback={fallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                  ) : null}
                  {entry.rating != null && (
                    <View className="absolute top-1.5 right-1.5">
                      <RatingBadge rating={entry.rating} />
                    </View>
                  )}
                </View>
                <Text numberOfLines={2} className="mt-2 text-text-warm" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 13 }}>{entry.track_title}</Text>
                <Text numberOfLines={1} className="text-text-tertiary mt-0.5" style={labelStyle}>{entry.artist_name}</Text>
              </Pressable>
              );
            })}
          </View>
          {ratingFilter === null && trackHasMore && (
            <Pressable onPress={loadMoreTracks} disabled={trackLoadingMore} className="mt-6 items-center">
              {trackLoadingMore ? <ActivityIndicator size="small" color="#6B6B6B" /> : <Text className="text-text-tertiary" style={metaMediumStyle}>Charger plus</Text>}
            </Pressable>
          )}
        </>
      )}
    </View>
  );
});
