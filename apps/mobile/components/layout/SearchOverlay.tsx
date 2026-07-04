import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Clock, Disc3, Music, Search, User, X } from 'lucide-react-native';
import { CoverImage } from '../album/CoverImage';
import { showToast } from '../ui/Toast';
import { useAuth } from '../../lib/AuthContext';
import { useSearchOverlay } from '../../lib/SearchOverlayContext';
import { supabase } from '../../lib/supabase';
import { searchInternal, type SearchResultUI, type SearchTab } from '../../lib/search';
import {
  searchMusicBrainzAlbums,
  searchMusicBrainzArtists,
  searchMusicBrainzRecordings,
} from '../../lib/musicbrainz';
import { mergeAndRank } from '../../lib/searchRanking';
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from '../../lib/recentSearches';

// Miroir mobile de apps/web/components/layout/SearchOverlay.tsx — même logique de
// recherche (fusion interne + MusicBrainz, debounce, tabs). Aucune page album/artiste/
// titre/profil n'existe encore côté mobile (phases 6.3-6.5) : le tap sur un résultat ne
// déclenche donc ni import MusicBrainz ni navigation pour l'instant (voir roadmap 6.2).
//
// Pas de <Modal> natif — un Modal RN recouvre toute la fenêtre, y compris BottomNav
// (un composant JS, pas une vraie tab bar native). Le panneau (SearchOverlayHost) est
// donc un simple overlay en position absolue, monté une fois dans app/(tabs)/_layout.tsx
// avec un zIndex inférieur à celui de BottomNav (50) pour que la nav reste visible et
// cliquable par-dessus pendant que la recherche est ouverte. L'état ouvert/fermé et le
// déclencheur (bouton "barre" sur Découvrir) passent par SearchOverlayContext.

const TAB_LABELS: Record<SearchTab, string> = {
  albums: 'Albums',
  tracks: 'Titres',
  artists: 'Artistes',
  users: 'Profils',
};

const TAB_PLACEHOLDERS: Record<SearchTab, string> = {
  albums: 'Rechercher un album…',
  tracks: 'Rechercher un titre…',
  artists: 'Rechercher un artiste…',
  users: 'Rechercher un profil…',
};

const RESULT_LIMIT = 8;

/** Bouton déclencheur — à placer sur l'écran Découvrir. Ouvre le SearchOverlayHost. */
export function SearchTrigger() {
  const { open } = useSearchOverlay();
  return (
    <Pressable
      onPress={open}
      className="w-full bg-paper-hi px-4 py-3 flex-row items-center gap-3"
      style={{ borderWidth: 1, borderColor: '#8E6F5E66', borderRadius: 14 }}
    >
      <Search size={18} color="#8E6F5E" />
      <Text style={{ fontFamily: 'Inter_400Regular' }} className="flex-1 text-[14px] text-text-tertiary">
        Album, titre, artiste, profil…
      </Text>
    </Pressable>
  );
}

function ResultRow({
  item,
  onSelect,
  importing,
  needsAuth,
}: {
  item: SearchResultUI;
  onSelect: (item: SearchResultUI) => void;
  importing: boolean;
  needsAuth: boolean;
}) {
  const isRound = item.kind === 'artist' || item.kind === 'user';
  const PlaceholderIcon =
    item.kind === 'album' || item.kind === 'track' ? Disc3 : item.kind === 'artist' || item.kind === 'user' ? User : Music;

  return (
    <Pressable
      onPress={() => !importing && onSelect(item)}
      className="flex-row items-center gap-3 px-3 py-2.5 rounded-button active:bg-background-secondary"
      style={importing ? { opacity: 0.7 } : undefined}
    >
      <View
        className={`w-10 h-10 bg-background-tertiary items-center justify-center overflow-hidden ${
          isRound ? 'rounded-full' : 'rounded-cover-sm'
        }`}
      >
        {item.coverUrl ? (
          <CoverImage
            src={item.coverUrl}
            placeholder={<PlaceholderIcon size={16} color="#BDBDBD" />}
            style={{ width: 40, height: 40 }}
          />
        ) : (
          <PlaceholderIcon size={16} color="#BDBDBD" />
        )}
      </View>

      <View className="flex-1 min-w-0">
        {importing ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#8E6F5E" />
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-[13px] text-text-secondary">
              Import en cours…
            </Text>
          </View>
        ) : (
          <>
            <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium' }} className="text-[14px] text-text-primary">
              {item.title}
            </Text>
            {!!item.subtitle && (
              <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular' }} className="text-[12px] text-text-tertiary mt-0.5">
                {item.subtitle}
                {item.kind === 'album' && item.releaseDate ? ` · ${item.releaseDate.substring(0, 4)}` : ''}
              </Text>
            )}
            {needsAuth && (
              <View className="self-start mt-1 px-1.5 py-0.5 rounded-badge-sm bg-paper-hi" style={{ borderWidth: 1, borderColor: '#D8D3CB' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', color: '#8E6F5E' }} className="text-[10px]">
                  Connecte-toi pour l&apos;ajouter
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

/** Panneau de recherche — monté une seule fois dans app/(tabs)/_layout.tsx. */
export function SearchOverlayHost() {
  const { isOpen, close: closeOverlay } = useSearchOverlay();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [artist, setArtist] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('albums');
  const [results, setResults] = useState<SearchResultUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const close = useCallback(() => {
    Keyboard.dismiss();
    closeOverlay();
    setQ('');
    setArtist('');
    setResults([]);
  }, [closeOverlay]);

  useEffect(() => {
    if (isOpen) {
      getRecentSearches().then(setRecentSearches);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Changer d'onglet (navbar ou swipe) doit fermer la recherche — sinon le panneau
  // reste ouvert par-dessus le nouvel onglet puisqu'il n'est plus un <Modal> natif.
  useEffect(() => {
    if (isOpen) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Bouton retour Android — ferme la recherche plutôt que de quitter l'onglet, comme
  // le ferait onRequestClose d'un <Modal> natif.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      setLoadingExtended(false);
      return;
    }

    let aborted = false;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 300));
      if (aborted) return;

      setLoading(true);
      setResults([]);

      const mbPromise = activeTab !== 'users'
        ? Promise.all([
            activeTab === 'albums' ? searchMusicBrainzAlbums(q) : Promise.resolve(null),
            activeTab === 'artists' ? searchMusicBrainzArtists(q, 5) : Promise.resolve(null),
            activeTab === 'tracks' ? searchMusicBrainzRecordings(q, 20, artist) : Promise.resolve(null),
          ])
        : null;

      if (activeTab !== 'users') setLoadingExtended(true);

      let internal: SearchResultUI[] = [];
      try {
        internal = await searchInternal(q, activeTab, activeTab === 'tracks' ? artist : undefined);
      } catch {
        // Recherche interne échouée — le fallback MB (phase 2) prend le relais
      }
      if (aborted) return;

      setResults(mergeAndRank(internal, [], q, RESULT_LIMIT));
      setLoading(false);

      if (mbPromise) {
        try {
          const [mbAlbumsRes, mbArtistsRes, mbRecordingsRes] = await mbPromise;
          if (aborted) return;

          const mbList: SearchResultUI[] = [];

          if (mbAlbumsRes?.success && mbAlbumsRes.results) {
            mbAlbumsRes.results.forEach((album) =>
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

          if (mbArtistsRes?.success && mbArtistsRes.results) {
            mbArtistsRes.results.forEach((a) =>
              mbList.push({
                id: a.id,
                title: a.name,
                subtitle: [a.type, a.country].filter(Boolean).join(' · '),
                kind: 'artist',
                source: 'musicbrainz',
                score: a.score,
              })
            );
          }

          if (mbRecordingsRes?.success && mbRecordingsRes.results) {
            mbRecordingsRes.results.forEach((rec) =>
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

          setResults(mergeAndRank(internal, mbList, q, RESULT_LIMIT));
        } catch {
          // Erreur MB — les résultats internes restent affichés tels quels
        } finally {
          if (!aborted) setLoadingExtended(false);
        }
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, [q, activeTab, artist]);

  const handleSelect = useCallback(
    async (item: SearchResultUI) => {
      const needsImport = item.source === 'musicbrainz' && (item.kind === 'album' || item.kind === 'track' || item.kind === 'artist');
      if (needsImport && !user) {
        showToast(
          item.kind === 'artist' ? 'Connecte-toi pour accéder à cet artiste' : "Connecte-toi pour importer cet album ou ce titre",
          'error'
        );
        return;
      }

      if (q.trim()) saveRecentSearch(q.trim());

      // Albums, titres et artistes déjà en DB → pages dédiées (6.3, 6.3bis, 6.5).
      if (item.kind === 'album' && item.source === 'internal') {
        close();
        router.push(`/albums/${item.id}`);
        return;
      }
      if (item.kind === 'track' && item.source === 'internal') {
        close();
        router.push(`/tracks/${item.id}`);
        return;
      }
      if (item.kind === 'artist' && item.source === 'internal') {
        close();
        router.push(`/artists/${item.id}` as any);
        return;
      }

      // Résultats MusicBrainz non encore en DB → Edge Function import-musicbrainz,
      // miroir exact du web (le clic déclenche l'import ET la navigation directement,
      // pas d'étape de preview visible côté utilisateur).
      if (item.kind === 'album' && item.source === 'musicbrainz') {
        setImportingId(item.id);
        try {
          const { data, error } = await supabase.functions.invoke('import-musicbrainz', {
            body: { kind: 'album', mbid: item.releaseId || item.id },
          });
          if (!error && data?.success && data.albumId) {
            close();
            router.push((data.redirectUrl ?? `/albums/${data.albumId}`) as any);
          } else {
            showToast(data?.error || "Erreur lors de l'import", 'error');
          }
        } catch {
          showToast("Erreur lors de l'import", 'error');
        } finally {
          setImportingId(null);
        }
        return;
      }

      if (item.kind === 'track' && item.source === 'musicbrainz') {
        setImportingId(item.id);
        try {
          const { data, error } = await supabase.functions.invoke('import-musicbrainz', {
            body: {
              kind: 'track',
              recordingMbid: item.recordingMbid || item.id,
              releaseId: item.releaseId || '',
              trackTitle: item.title,
            },
          });
          if (!error && data?.success && data.trackId) {
            close();
            router.push(`/tracks/${data.trackId}` as any);
          } else {
            showToast(data?.error || "Erreur lors de l'import du titre", 'error');
          }
        } catch {
          showToast("Erreur lors de l'import du titre", 'error');
        } finally {
          setImportingId(null);
        }
        return;
      }

      if (item.kind === 'artist' && item.source === 'musicbrainz') {
        setImportingId(item.id);
        try {
          const { data, error } = await supabase.functions.invoke('import-musicbrainz', {
            body: { kind: 'artist', mbid: item.id, name: item.title },
          });
          if (!error && data?.success && data.artistId) {
            close();
            router.push(`/artists/${data.artistId}` as any);
          } else {
            showToast(data?.error || "Erreur lors de l'import de l'artiste", 'error');
          }
        } catch {
          showToast("Erreur lors de l'import de l'artiste", 'error');
        } finally {
          setImportingId(null);
        }
        return;
      }

      showToast('Bientôt disponible', 'info');
    },
    [q, close, router, user]
  );

  const handleClearAll = useCallback(async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  }, []);

  if (!isOpen) return null;

  const hasResults = results.length > 0;
  const showEmptyState = !q.trim() && recentSearches.length === 0;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
    >
      <View className="flex-1 bg-paper-hi" style={{ paddingTop: insets.top }}>
        <View className="border-b border-border">
          <View className="flex-row items-center gap-2 px-4 pt-3">
            <View
              className="flex-1 flex-row items-center gap-2 bg-background-secondary rounded-input px-3"
              style={{ height: 38 }}
            >
              <Search size={16} color="#8E6F5E" />
              <TextInput
                ref={inputRef}
                value={q}
                onChangeText={setQ}
                placeholder={TAB_PLACEHOLDERS[activeTab]}
                placeholderTextColor="#9A9A9A"
                style={{ fontFamily: 'Inter_400Regular' }}
                className="flex-1 text-[15px] text-text-primary"
              />
              {q.length > 0 && (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <X size={16} color="#9A9A9A" />
                </Pressable>
              )}
            </View>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={{ fontFamily: 'Inter_500Medium', color: '#8E6F5E' }} className="text-[14px]">
                Annuler
              </Text>
            </Pressable>
          </View>

          {activeTab === 'tracks' && (
            <View className="flex-row items-center gap-2 px-4 pt-2">
              <View
                className="flex-1 flex-row items-center gap-2 bg-background-secondary rounded-input px-3"
                style={{ height: 34 }}
              >
                <TextInput
                  value={artist}
                  onChangeText={setArtist}
                  placeholder="Filtrer par artiste"
                  placeholderTextColor="#9A9A9A"
                  textAlignVertical="center"
                  style={{ fontFamily: 'Inter_400Regular' }}
                  className="flex-1 text-[13px] text-text-primary"
                />
                {artist.length > 0 && (
                  <Pressable onPress={() => setArtist('')} hitSlop={8}>
                    <X size={14} color="#9A9A9A" />
                  </Pressable>
                )}
              </View>
              {/* Espaceur invisible — même texte/police que "Annuler" pour que la barre
                  de filtre s'aligne exactement sur la largeur de la barre de recherche. */}
              <View style={{ opacity: 0 }} pointerEvents="none">
                <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-[14px]">
                  Annuler
                </Text>
              </View>
            </View>
          )}

          <View className="flex-row gap-5 px-4 pt-3">
            {(['albums', 'tracks', 'artists', 'users'] as SearchTab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => {
                    setActiveTab(tab);
                    if (tab !== 'tracks') setArtist('');
                  }}
                  style={{
                    paddingBottom: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: isActive ? '#8E6F5E' : 'transparent',
                  }}
                >
                  <Text
                    style={{ fontFamily: isActive ? 'Inter_500Medium' : 'Inter_400Regular', color: isActive ? '#2A2520' : '#9A9A9A' }}
                    className="text-[14px]"
                  >
                    {TAB_LABELS[tab]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {!q.trim() ? (
            recentSearches.length > 0 ? (
              <View>
                <Text
                  style={{ fontFamily: 'Inter_500Medium', letterSpacing: 1.8 }}
                  className="text-[10px] uppercase text-text-disabled px-3 mb-2"
                >
                  Recherches récentes
                </Text>
                {recentSearches.map((search, i) => (
                  <View
                    key={search}
                    className="flex-row items-center justify-between px-3 py-2.5"
                    style={i > 0 ? { marginTop: 2 } : undefined}
                  >
                    <Pressable onPress={() => setQ(search)} className="flex-row items-center gap-3 flex-1 min-w-0">
                      <Clock size={13} color="#BDBDBD" />
                      <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular' }} className="text-[14px] text-text-primary">
                        {search}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => removeRecentSearch(search).then(setRecentSearches)}
                      hitSlop={8}
                      className="ml-2"
                    >
                      <X size={12} color="#9A9A9A" />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  onPress={handleClearAll}
                  className="self-center mt-4 px-4 py-2 rounded-pill border border-border"
                >
                  <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-[12px] text-text-secondary">
                    Effacer les recherches récentes
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 }}>
                <Search size={32} color="#D8D3CB" />
                <Text
                  style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', textAlign: 'center', marginTop: 16 }}
                  className="text-[20px] text-text-secondary"
                >
                  Trouve un album, un titre, un artiste ou un profil
                </Text>
                <Text
                  style={{ fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 }}
                  className="text-[13px] text-text-tertiary"
                >
                  Commence à taper pour lancer la recherche.
                </Text>
              </View>
            )
          ) : loading ? (
            <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-[14px] text-text-tertiary px-3 py-5">
              Recherche…
            </Text>
          ) : (
            <>
              {hasResults ? (
                results.map((item) => (
                  <ResultRow
                    key={`${item.source}-${item.id}`}
                    item={item}
                    onSelect={handleSelect}
                    importing={importingId === item.id}
                    needsAuth={!user && item.source === 'musicbrainz' && (item.kind === 'album' || item.kind === 'track')}
                  />
                ))
              ) : !loadingExtended ? (
                <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-[14px] text-text-tertiary px-3 py-5">
                  Aucun résultat pour « {q} »
                </Text>
              ) : null}

              {loadingExtended && (
                <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-[11px] text-text-disabled px-3 py-2">
                  Recherche étendue…
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
