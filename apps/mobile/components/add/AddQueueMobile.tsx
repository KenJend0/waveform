import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown, ChevronUp, ChevronRight, Search, X, Disc3, Music } from 'lucide-react-native';
import { StarRating } from '../ui/StarRating';
import { CoverImage } from '../album/CoverImage';
import { coverSrcWithFallback } from '../../lib/cover';
import { searchInternal, type SearchResultUI } from '../../lib/search';
import { searchMusicBrainzAlbums, searchMusicBrainzRecordings } from '../../lib/musicbrainz';
import { mergeAndRank } from '../../lib/searchRanking';
import { upsertDiaryEntry } from '../../lib/diary';
import { upsertTrackDiaryEntry } from '../../lib/trackDiary';
import { showToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';
import { type AddQueueItem, ADD_QUEUE_SOURCE_LABELS } from '../../lib/buildAddQueue';

/**
 * Miroir mobile de apps/web/components/add/AddQueueMobile.tsx — pile de cartes
 * "façon Tinder" à swiper, note + critique inline, recherche compacte intégrée.
 * Voir docs/MOBILE_ROADMAP.md (6.4) pour les notes de scope (mode dégradé Phase 7,
 * simplifications d'animation).
 */

type Props = {
  initialQueue: AddQueueItem[];
};

type RatedCover = { key: string; coverUrl: string | null; mbid: string | null; title: string };
type PanelMode = 'none' | 'search' | 'comment';

// Cartes derrière l'active — offsets top/left/right/bottom fixes, comme le web
// (PEEK_STYLES), pour un emboîtement régulier qui ne dépasse jamais du conteneur.
const PEEK_STYLES = [
  { bottomInset: 10, sideInset: 5 }, // la plus proche de la carte active
  { bottomInset: 0, sideInset: 10 }, // la plus en arrière
];
const PEEK_RESERVE_PX = 20;

// Inclinaisons pour les pochettes éparpillées dans l'état de fin de file.
const FAN_STYLES = [
  { rotate: -9, translateX: -34, translateY: 6, z: 1 },
  { rotate: 4, translateX: 0, translateY: -6, z: 3 },
  { rotate: 12, translateX: 32, translateY: 10, z: 2 },
];

const SEARCH_LIMIT_INITIAL = 4;
const SEARCH_LIMIT_EXPANDED = 20;
const SEARCH_RESULTS_EXPANDED_MAX_PX = 220;
const SEARCH_MINI_CARD_MAX_PX = 220;
const SWIPE_THRESHOLD = 120;

export default function AddQueueMobile({ initialQueue }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().split('T')[0];

  const [queue, setQueue] = useState<AddQueueItem[]>(initialQueue);
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [ratedCovers, setRatedCovers] = useState<RatedCover[]>([]);

  const [searchEntityType, setSearchEntityType] = useState<'album' | 'track'>('album');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUI[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchImportingId, setSearchImportingId] = useState<string | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const commentInputRef = useRef<TextInput>(null);

  const translateX = useSharedValue(0);
  // Miroirs UI-thread de panelMode/current — le geste ci-dessous (panGesture) n'est
  // construit qu'une seule fois (useMemo), donc il ne peut pas relire panelMode/current
  // via une closure classique à chaque swipe : ces shared values, synchronisées par les
  // useEffect plus bas, sont le seul moyen fiable de lire un état "à jour" côté UI thread.
  const panelModeIsNone = useSharedValue(true);
  const hasCurrent = useSharedValue(false);

  const current = queue[index] ?? null;
  const currentHref = current ? (current.kind === 'album' ? `/albums/${current.id}` : `/tracks/${current.id}`) : null;
  const currentSeeLabel = current?.kind === 'album' ? "voir l'album" : 'voir le titre';
  const { src: currentCoverSrc, fallback: currentCoverFallback } = current
    ? coverSrcWithFallback(current.mbid, current.coverUrl)
    : { src: null as string | null, fallback: undefined as string | undefined };
  const upcoming = queue.slice(index + 1, index + 3);
  const remaining = queue.length - index;
  const peekCount = Math.min(upcoming.length, 2);

  const commentOpen = panelMode === 'comment';
  const searchHasResults = panelMode === 'search' && searchQuery.trim() !== '' && searchResults.length >= 3;
  const cardView = commentOpen ? 'comment' : searchHasResults ? 'search' : 'full';
  const visibleResults = searchExpanded ? searchResults : searchResults.slice(0, SEARCH_LIMIT_INITIAL);
  const hasMoreResults = !searchExpanded && searchResults.length > SEARCH_LIMIT_INITIAL;

  const resetCardForm = () => {
    setRating(null);
    setComment('');
  };

  const closePanel = () => {
    setPanelMode('none');
    setSearchQuery('');
    setSearchArtist('');
    setSearchResults([]);
    setSearchExpanded(false);
    Keyboard.dismiss();
  };

  const advance = () => {
    setIndex((i) => i + 1);
    resetCardForm();
    closePanel();
    translateX.value = 0;
  };

  // Envoi en arrière-plan — ne bloque jamais la navigation dans la file, comme le web.
  const saveInBackground = (item: AddQueueItem, ratingValue: number, commentValue: string) => {
    const source = item.source === 'foryou' ? 'for_you' : undefined;
    const promise = item.kind === 'album'
      ? upsertDiaryEntry({
          albumId: item.id,
          listenedAt: today,
          rating: ratingValue,
          reviewBody: commentValue.trim() || undefined,
          source,
        })
      : upsertTrackDiaryEntry({
          trackId: item.id,
          albumId: item.albumId,
          artistId: item.artistId,
          listenedAt: today,
          rating: ratingValue,
          reviewBody: commentValue.trim() || undefined,
          source,
        });

    promise
      .then((result) => {
        if (!result.success) {
          showToast(result.error || `Erreur lors de l'enregistrement de « ${item.title} »`, 'error');
        }
      })
      .catch(() => {
        showToast(`Erreur lors de l'enregistrement de « ${item.title} »`, 'error');
      });
  };

  // Noter ne fait qu'une mise à jour locale — rien n'est envoyé au serveur tant
  // que l'utilisateur n'a pas swipé/tapé "Suivant".
  const handleRate = (value: number) => {
    if (!current) return;
    setRating(value);
  };

  const clearRating = () => setRating(null);

  const handleNext = () => {
    if (!current) return;
    if (rating !== null) {
      saveInBackground(current, rating, comment);
      setRatedCovers((prev) => [...prev, { key: `${current.kind}-${current.id}`, coverUrl: current.coverUrl, mbid: current.mbid, title: current.title }]);
    }
    advance();
  };

  // handleNext est recréée à chaque render (elle capture rating/comment/current à jour) —
  // le geste de swipe, lui, ne doit être construit qu'une seule fois (voir panGesture plus
  // bas) pour éviter que react-native-gesture-handler ne ré-attache un nouveau handler natif
  // en cours de swipe. Cette ref garde toujours la dernière version de handleNext accessible
  // depuis le callback stable appelé par le geste.
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const triggerNextFromGesture = useCallback(() => {
    handleNextRef.current();
  }, []);

  const insertItem = (item: AddQueueItem) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
    closePanel();
    resetCardForm();
  };

  const handleTabClick = (tab: 'album' | 'track') => {
    if (panelMode === 'search' && searchEntityType === tab) {
      closePanel();
    } else {
      setSearchEntityType(tab);
      setPanelMode('search');
      setSearchQuery('');
      setSearchArtist('');
      setSearchResults([]);
      setSearchExpanded(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const toggleComment = () => {
    if (panelMode === 'comment') {
      setPanelMode('none');
      Keyboard.dismiss();
    } else {
      setPanelMode('comment');
      setTimeout(() => commentInputRef.current?.focus(), 350);
    }
  };

  // Recherche compacte intégrée — même debounce/fusion que SearchOverlay.
  useEffect(() => {
    if (panelMode !== 'search' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    let aborted = false;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 300));
      if (aborted) return;

      setSearchLoading(true);
      const isAlbum = searchEntityType === 'album';
      const mbAlbumPromise = isAlbum ? searchMusicBrainzAlbums(searchQuery).catch(() => null) : null;
      const mbTrackPromise = !isAlbum ? searchMusicBrainzRecordings(searchQuery, 20, searchArtist).catch(() => null) : null;

      let internal: SearchResultUI[] = [];
      try {
        internal = await searchInternal(searchQuery, isAlbum ? 'albums' : 'tracks', isAlbum ? undefined : searchArtist);
      } catch {}
      if (aborted) return;

      setSearchResults(mergeAndRank(internal, [], searchQuery, SEARCH_LIMIT_EXPANDED));
      setSearchLoading(false);

      try {
        const mbList: SearchResultUI[] = [];
        if (isAlbum) {
          const mbRes = await mbAlbumPromise;
          if (aborted) return;
          if (mbRes?.success && mbRes.results) {
            mbRes.results.forEach((album) =>
              mbList.push({
                id: album.id,
                releaseId: album.releaseId,
                title: album.title,
                subtitle: album.artistName,
                kind: 'album',
                coverUrl: album.coverUrl || null,
                releaseDate: album.releaseDate,
                source: 'musicbrainz',
                score: album.score,
                releaseCount: album.releaseCount,
              })
            );
          }
        } else {
          const mbRes = await mbTrackPromise;
          if (aborted) return;
          if (mbRes?.success && mbRes.results) {
            mbRes.results.forEach((rec) =>
              mbList.push({
                id: rec.mbid,
                recordingMbid: rec.mbid,
                releaseId: rec.releaseId,
                title: rec.title,
                subtitle: `${rec.artistName} · ${rec.albumTitle}`,
                kind: 'track',
                coverUrl: rec.coverUrl || null,
                source: 'musicbrainz',
                score: rec.score,
              })
            );
          }
        }

        if (!aborted) setSearchResults(mergeAndRank(internal, mbList, searchQuery, SEARCH_LIMIT_EXPANDED));
      } catch {}
    };

    run();
    return () => {
      aborted = true;
    };
  }, [searchQuery, searchArtist, searchEntityType, panelMode]);

  // Import direct via l'Edge Function import-musicbrainz — pas les hooks de
  // lib/useMusicBrainzImport.ts, qui naviguent systématiquement vers la page créée :
  // ici on veut insérer l'item dans la file (insertItem), pas quitter l'écran.
  const handleSearchSelect = async (item: SearchResultUI) => {
    if (searchImportingId) return;

    if (item.source === 'musicbrainz') {
      setSearchImportingId(item.id);
      try {
        if (searchEntityType === 'album') {
          const { data, error } = await supabase.functions.invoke('import-musicbrainz', {
            body: { kind: 'album', mbid: item.releaseId || item.id },
          });
          if (!error && data?.success && data.albumId) {
            insertItem({
              kind: 'album',
              id: data.albumId,
              title: item.title,
              artist: item.subtitle || 'Unknown Artist',
              coverUrl: item.coverUrl ?? null,
              mbid: null,
              year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
              source: 'search',
            });
          } else {
            showToast(data?.error || "Erreur lors de l'import", 'error');
          }
        } else {
          const { data, error } = await supabase.functions.invoke('import-musicbrainz', {
            body: {
              kind: 'track',
              recordingMbid: item.recordingMbid || item.id,
              releaseId: item.releaseId || '',
              trackTitle: item.title,
            },
          });
          if (!error && data?.success && data.trackId) {
            const parts = (item.subtitle || '').split(' · ');
            insertItem({
              kind: 'track',
              id: data.trackId,
              title: item.title,
              artist: parts[0] || '',
              coverUrl: item.coverUrl ?? null,
              mbid: null,
              albumId: data.albumId || '',
              albumTitle: parts[1] || '',
              artistId: data.artistId || '',
              source: 'search',
            });
          } else {
            showToast(data?.error || "Erreur lors de l'import du titre", 'error');
          }
        }
      } catch {
        showToast("Erreur lors de l'import", 'error');
      } finally {
        setSearchImportingId(null);
      }
      return;
    }

    if (searchEntityType === 'album') {
      insertItem({
        kind: 'album',
        id: item.id,
        title: item.title,
        artist: item.subtitle || 'Unknown Artist',
        coverUrl: item.coverUrl ?? null,
        mbid: null,
        year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        source: 'search',
      });
    } else {
      const parts = (item.subtitle || '').split(' · ');
      insertItem({
        kind: 'track',
        id: item.id,
        title: item.title,
        artist: parts[0] || 'Unknown',
        coverUrl: item.coverUrl ?? null,
        mbid: null,
        albumId: item.trackAlbumId || '',
        albumTitle: parts[1] || '',
        artistId: item.trackArtistId || '',
        source: 'search',
      });
    }
  };

  useEffect(() => {
    panelModeIsNone.value = panelMode === 'none';
  }, [panelMode, panelModeIsNone]);

  // Pilote la réserve de padding bas (voir plus bas) sur la présence réelle du clavier,
  // pas sur panelMode seul : la recherche peut rester ouverte (résultats affichés) une
  // fois le clavier fermé (tap ailleurs, bouton retour…), auquel cas la carte doit
  // redescendre au-dessus de la bottom nav plutôt que de garder l'espace réduit.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    hasCurrent.value = !!current;
  }, [current, hasCurrent]);

  // Construit une seule fois (useMemo, deps stables) — reconstruire ce geste à chaque
  // render (comme avant) faisait ré-attacher un handler natif RNGH en plein swipe, ce qui
  // se traduisait par un handleNext() déclenché deux fois pour un seul geste (la file
  // avançait de deux cartes au lieu d'une). L'activation et les données lues pendant le
  // swipe passent donc par des shared values / une ref plutôt que par les closures React
  // classiques (voir panelModeIsNone/hasCurrent/triggerNextFromGesture).
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .onUpdate((e) => {
          if (!panelModeIsNone.value || !hasCurrent.value) return;
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          if (!panelModeIsNone.value || !hasCurrent.value) return;
          if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
            const direction = e.translationX > 0 ? 1 : -1;
            translateX.value = withTiming(direction * 500, { duration: 200 }, (finished) => {
              if (finished) runOnJS(triggerNextFromGesture)();
            });
          } else {
            translateX.value = withSpring(0, { damping: 18 });
          }
        }),
    [translateX, panelModeIsNone, hasCurrent, triggerNextFromGesture]
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-8, 0, 8], Extrapolation.CLAMP)}deg` },
    ],
  }));

  const goToCurrent = () => {
    if (currentHref) router.push(currentHref as any);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        className="flex-1 bg-background px-6"
        style={{ paddingTop: insets.top + 8, paddingBottom: keyboardVisible ? 12 : 100 }}
      >
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={() => handleTabClick('album')}
            className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-pill"
            style={{ backgroundColor: panelMode === 'search' && searchEntityType === 'album' ? '#5C4538' : '#ECE8E1' }}
          >
            {panelMode === 'search' && searchEntityType === 'album' ? <X size={12} color="#FAF8F4" strokeWidth={2.5} /> : <Search size={12} color="#6B6B6B" />}
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: panelMode === 'search' && searchEntityType === 'album' ? '#FAF8F4' : '#6B6B6B' }}>
              Chercher un album
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabClick('track')}
            className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-pill"
            style={{ backgroundColor: panelMode === 'search' && searchEntityType === 'track' ? '#5C4538' : '#ECE8E1' }}
          >
            {panelMode === 'search' && searchEntityType === 'track' ? <X size={12} color="#FAF8F4" strokeWidth={2.5} /> : <Search size={12} color="#6B6B6B" />}
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: panelMode === 'search' && searchEntityType === 'track' ? '#FAF8F4' : '#6B6B6B' }}>
              Chercher un titre
            </Text>
          </Pressable>
        </View>

        {!!current && (
          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.4 }} className="uppercase text-text-tertiary">
              À noter · {remaining} en attente
            </Text>
            <View className="w-16 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: '#D8D3CB' }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${queue.length > 0 ? (index / queue.length) * 100 : 0}%`, backgroundColor: '#8E6F5E' }}
              />
            </View>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {panelMode === 'search' && (
            <View
              className="flex-row items-center gap-2 bg-paper-hi border rounded-input px-3 mb-3"
              style={{ borderColor: '#8E6F5E', height: 38 }}
            >
              <Search size={15} color="#8E6F5E" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setSearchExpanded(false);
                }}
                placeholder={searchEntityType === 'album' ? 'Rechercher un album…' : 'Rechercher un titre'}
                placeholderTextColor="#9A9A9A"
                textAlignVertical="center"
                style={{ fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 }}
                className="flex-1 text-text-primary"
              />
              {searchEntityType === 'track' && (
                <>
                  <View className="w-px h-4 bg-border" />
                  <TextInput
                    value={searchArtist}
                    onChangeText={(t) => {
                      setSearchArtist(t);
                      setSearchExpanded(false);
                    }}
                    placeholder="par artiste"
                    placeholderTextColor="#8E6F5E"
                    textAlignVertical="center"
                    style={{ fontFamily: 'Inter_400Regular', fontSize: 14, width: '30%', paddingVertical: 0 }}
                    className="text-text-primary"
                  />
                </>
              )}
            </View>
          )}

          {panelMode === 'search' && searchQuery.trim() !== '' && (
            <View
              className="bg-paper-hi border border-border rounded-input overflow-hidden mb-3"
              style={searchExpanded ? { maxHeight: SEARCH_RESULTS_EXPANDED_MAX_PX } : undefined}
            >
              <ScrollView scrollEnabled={searchExpanded} style={searchExpanded ? undefined : { flexGrow: 0 }}>
                {searchLoading ? (
                  <View className="flex-row items-center gap-2 px-3 py-3">
                    <ActivityIndicator size="small" color="#8E6F5E" />
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-tertiary">Recherche…</Text>
                  </View>
                ) : searchResults.length === 0 ? (
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="px-3 py-3 text-text-tertiary">Aucun résultat</Text>
                ) : (
                  visibleResults.map((item) => (
                    <Pressable
                      key={`${item.source}-${item.id}`}
                      onPress={() => handleSearchSelect(item)}
                      disabled={!!searchImportingId}
                      className="flex-row items-center gap-2.5 px-3 py-2 border-b border-background-secondary"
                      style={searchImportingId ? { opacity: 0.5 } : undefined}
                    >
                      <View className="w-9 h-9 rounded-badge overflow-hidden bg-background-tertiary items-center justify-center">
                        {searchImportingId === item.id ? (
                          <ActivityIndicator size="small" color="#8E6F5E" />
                        ) : item.coverUrl ? (
                          <CoverImage
                            key={item.coverUrl}
                            src={item.coverUrl}
                            style={{ width: 36, height: 36 }}
                            placeholder={searchEntityType === 'album' ? <Disc3 size={13} color="#BDBDBD" /> : <Music size={13} color="#BDBDBD" />}
                          />
                        ) : searchEntityType === 'album' ? (
                          <Disc3 size={13} color="#BDBDBD" />
                        ) : (
                          <Music size={13} color="#BDBDBD" />
                        )}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }} className="text-text-primary">{item.title}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }} className="text-text-secondary">{item.subtitle}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
              {hasMoreResults && (
                <Pressable
                  onPress={() => setSearchExpanded(true)}
                  className="flex-row items-center justify-center gap-1 px-3 py-2 border-t border-background-secondary"
                >
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12 }} className="text-accent">Voir plus de résultats</Text>
                  <ChevronDown size={12} color="#8E6F5E" />
                </Pressable>
              )}
            </View>
          )}

          {!current ? (
            panelMode === 'search' && searchQuery.trim() !== '' ? null : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {ratedCovers.length > 0 ? (
                  <>
                    <View style={{ height: 112, marginBottom: 32, width: 200 }}>
                      {ratedCovers.slice(-3).map((c, i, arr) => {
                        const fan = FAN_STYLES[i + (3 - arr.length)];
                        const { src, fallback } = coverSrcWithFallback(c.mbid, c.coverUrl);
                        return (
                          <View
                            key={c.key}
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              width: 96,
                              height: 96,
                              marginLeft: -48 + fan.translateX,
                              marginTop: fan.translateY,
                              transform: [{ rotate: `${fan.rotate}deg` }],
                              zIndex: fan.z,
                              borderRadius: 8,
                              overflow: 'hidden',
                              borderWidth: 2,
                              borderColor: '#FAF8F4',
                            }}
                          >
                            {src ? (
                              <CoverImage key={src} src={src} fallback={fallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                            ) : (
                              <View className="w-full h-full bg-background-tertiary" />
                            )}
                          </View>
                        );
                      })}
                    </View>
                    <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 22 }} className="text-text-warm mb-2">Tout est à jour</Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-secondary mb-1 text-center">
                      Tu viens de noter <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-accent-deep">{ratedCovers.length} écoute{ratedCovers.length > 1 ? 's' : ''}</Text>.
                    </Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-tertiary mb-4">Ton journal a rattrapé son retard.</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 17 }} className="text-text-warm mb-2">Tout est à jour</Text>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-tertiary mb-4">Plus rien à noter pour le moment.</Text>
                  </>
                )}
                <Pressable onPress={() => router.push('/(tabs)/explore' as any)}>
                  <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }} className="text-accent border-b border-accent pb-0.5">
                    Découvrir de nouveaux albums
                  </Text>
                </Pressable>
              </View>
            )
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: searchHasResults ? 'center' : 'flex-start' }}>
              <View
                style={
                  searchHasResults
                    ? { width: '100%', maxWidth: 384, maxHeight: SEARCH_MINI_CARD_MAX_PX, height: '100%' }
                    : { width: '100%', maxWidth: 384, flex: 1 }
                }
              >
                {panelMode === 'none' &&
                  Array.from({ length: peekCount }).map((_, i) => {
                    const depth = peekCount - i; // 2 puis 1
                    const peek = PEEK_STYLES[depth - 1];
                    const peekItem = upcoming[depth - 1];
                    const peekCover = peekItem ? coverSrcWithFallback(peekItem.mbid, peekItem.coverUrl) : null;
                    return (
                      <View
                        key={`peek-${depth}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: peek.sideInset,
                          right: peek.sideInset,
                          bottom: peek.bottomInset,
                          zIndex: 10 - depth,
                          borderRadius: 14,
                          overflow: 'hidden',
                          backgroundColor: '#E4DFD6',
                          borderWidth: 1,
                          borderColor: '#D8D3CB',
                        }}
                      >
                        {peekCover?.src && (
                          <CoverImage key={peekCover.src} src={peekCover.src} fallback={peekCover.fallback} style={{ width: '100%', height: '100%', opacity: 0.7 }} placeholder={<View className="w-full h-full" />} />
                        )}
                        <View style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(28,28,28,${0.05 * depth})` }} />
                      </View>
                    );
                  })}

                <GestureDetector gesture={panGesture}>
                  <Animated.View
                    style={[
                      {
                        flex: 1,
                        zIndex: 10,
                        backgroundColor: '#FAF8F4',
                        borderWidth: 1,
                        borderColor: '#D8D3CB',
                        borderRadius: 14,
                        overflow: 'hidden',
                        marginBottom: !searchHasResults && panelMode === 'none' && peekCount > 0 ? PEEK_RESERVE_PX : 0,
                      },
                      panelMode === 'none' ? cardAnimatedStyle : undefined,
                    ]}
                  >
                    {cardView === 'comment' ? (
                      <View style={{ flex: 1, padding: 16 }}>
                        <View className="flex-row items-center gap-4 mb-3">
                          <View className="w-20 h-20 rounded-cover-sm overflow-hidden bg-background-tertiary">
                            {currentCoverSrc ? (
                              <CoverImage key={currentCoverSrc} src={currentCoverSrc} fallback={currentCoverFallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                            ) : (
                              <View className="w-full h-full bg-background-tertiary" />
                            )}
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text numberOfLines={1} style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 19 }} className="text-text-warm">{current.title}</Text>
                            <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-secondary">
                              {current.artist}
                              {current.kind === 'album' && current.year ? ` · ${current.year}` : ''}
                            </Text>
                          </View>
                        </View>

                        <View className="mb-3 flex-row items-center gap-2">
                          <View className="flex-1 min-w-0">
                            <StarRating value={rating} onChange={handleRate} compact />
                          </View>
                          {rating !== null && (
                            <Pressable onPress={clearRating} className="w-6 h-6 items-center justify-center rounded-full">
                              <X size={13} color="#9A9A9A" />
                            </Pressable>
                          )}
                        </View>

                        <View className="flex-row items-center justify-between mb-2">
                          <Pressable onPress={toggleComment} className="flex-row items-center gap-1">
                            <ChevronUp size={14} color="#9A9A9A" />
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }} className="text-text-tertiary">Écrire une critique…</Text>
                          </Pressable>
                          {!!currentHref && (
                            <Pressable onPress={goToCurrent}>
                              <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13 }} className="text-accent border-b border-accent pb-0.5">
                                {currentSeeLabel}
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        <TextInput
                          ref={commentInputRef}
                          value={comment}
                          onChangeText={setComment}
                          placeholder="Ce que tu as ressenti, si tu en as envie."
                          placeholderTextColor="#9A9A9A"
                          multiline
                          textAlignVertical="top"
                          style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
                          className="flex-1 min-w-0 px-3 py-2 bg-background-secondary border border-border rounded-input text-text-primary mb-3"
                        />

                        <Pressable
                          onPress={handleNext}
                          className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-button"
                          style={{ backgroundColor: rating !== null ? '#5C4538' : '#ECE8E1' }}
                        >
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: rating !== null ? '#FAF8F4' : '#1C1C1C' }}>
                            {rating !== null ? 'Suivant' : 'Passer'}
                          </Text>
                          <ChevronRight size={14} color={rating !== null ? '#FAF8F4' : '#1C1C1C'} />
                        </Pressable>
                      </View>
                    ) : cardView === 'search' ? (
                      <View style={{ flex: 1, justifyContent: 'center', padding: 12 }}>
                        <View className="flex-row items-center gap-3 mb-2">
                          <View className="w-12 h-12 rounded-cover-sm overflow-hidden bg-background-tertiary">
                            {currentCoverSrc ? (
                              <CoverImage key={currentCoverSrc} src={currentCoverSrc} fallback={currentCoverFallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                            ) : (
                              <View className="w-full h-full bg-background-tertiary" />
                            )}
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text numberOfLines={1} style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 15 }} className="text-text-warm">{current.title}</Text>
                            <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: 0.6 }} className="text-text-secondary">
                              {current.artist}
                              {current.kind === 'album' && current.year ? ` · ${current.year}` : ''}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="flex-1 min-w-0">
                            <StarRating value={rating} onChange={handleRate} compact />
                          </View>
                          {rating !== null && (
                            <Pressable onPress={clearRating} className="w-6 h-6 items-center justify-center rounded-full">
                              <X size={13} color="#9A9A9A" />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={{ flex: 1, backgroundColor: '#E4DFD6' }}>
                          {currentCoverSrc ? (
                            <CoverImage key={currentCoverSrc} src={currentCoverSrc} fallback={currentCoverFallback} style={{ width: '100%', height: '100%' }} placeholder={<View className="w-full h-full bg-background-tertiary" />} />
                          ) : (
                            <View className="w-full h-full bg-background-tertiary" />
                          )}
                          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(44,32,24,0.25)' }} />
                          <View className="absolute top-3 left-3 right-3 flex-row items-center justify-between gap-2">
                            <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(250,248,244,0.92)', borderWidth: 1, borderColor: 'rgba(216,211,203,0.6)' }}>
                              <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }} className="text-accent-deep">
                                {ADD_QUEUE_SOURCE_LABELS[current.source]}
                              </Text>
                            </View>
                            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(250,248,244,0.92)', borderWidth: 1, borderColor: 'rgba(216,211,203,0.6)' }}>
                              <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 14 }} className="text-text-secondary">
                                nº {String(index + 1).padStart(2, '0')}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View className="p-4">
                          <Text numberOfLines={2} style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 22, lineHeight: 26 }} className="text-text-warm mb-1">
                            {current.title}
                          </Text>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }} className="text-text-secondary mb-3">
                            {current.artist}
                            {current.kind === 'album' && current.year ? ` · ${current.year}` : ''}
                            {current.kind === 'track' && current.albumTitle ? (
                              <Text className="text-text-tertiary"> · {current.albumTitle}</Text>
                            ) : null}
                          </Text>

                          <View className="mb-3 flex-row items-center gap-2">
                            <View className="flex-1 min-w-0">
                              <StarRating value={rating} onChange={handleRate} compact />
                            </View>
                            {rating !== null && (
                              <Pressable onPress={clearRating} className="w-6 h-6 items-center justify-center rounded-full">
                                <X size={13} color="#9A9A9A" />
                              </Pressable>
                            )}
                          </View>

                          <View className="flex-row items-center justify-between gap-2">
                            <Pressable onPress={toggleComment} className="flex-row items-center gap-1">
                              <ChevronDown size={14} color="#9A9A9A" />
                              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }} className="text-text-tertiary">Écrire une critique</Text>
                            </Pressable>
                            {!!currentHref && (
                              <Pressable onPress={goToCurrent}>
                                <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 13 }} className="text-accent border-b border-accent pb-0.5">
                                  {currentSeeLabel}
                                </Text>
                              </Pressable>
                            )}
                          </View>

                          <Pressable
                            onPress={handleNext}
                            className="mt-3 flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-button"
                            style={{ backgroundColor: rating !== null ? '#5C4538' : '#ECE8E1' }}
                          >
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: rating !== null ? '#FAF8F4' : '#1C1C1C' }}>
                              {rating !== null ? 'Suivant' : 'Passer'}
                            </Text>
                            <ChevronRight size={14} color={rating !== null ? '#FAF8F4' : '#1C1C1C'} />
                          </Pressable>
                        </View>
                      </>
                    )}
                  </Animated.View>
                </GestureDetector>
              </View>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
