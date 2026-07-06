import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavScrollHandler } from '../../../lib/useNavScrollHandler';
import { SearchTrigger } from '../../../components/layout/SearchOverlay';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { PourToiSection } from '../../../components/explore/PourToiSection';
import { OnboardingCTASection } from '../../../components/auth/OnboardingCTASection';
import { CuratorPickSection } from '../../../components/explore/CuratorPickSection';
import { TrendingSection } from '../../../components/explore/TrendingSection';
import { DiscoverySection } from '../../../components/explore/DiscoverySection';
import { CommunityListsSection } from '../../../components/explore/CommunityListsSection';
import { SimilarUsersSection } from '../../../components/user/SimilarUsersSection';
import {
  getProfileTier,
  getTrendingThisWeek,
  getForYouSuggestions,
  getForYouTracks,
  getDiscoveryAlbums,
  getSimilarUsers,
  type ProfileTier,
  type TrendingAlbum,
  type ForYouAlbum,
  type ForYouTrack,
  type DiscoveryResult,
  type SimilarUser,
} from '../../../lib/explore';
import { getTrendingTracks, type TrackWithStats } from '../../../lib/trackDiary';
import { getPublicLists, type ProfileListUI } from '../../../lib/lists';
import { getCuratorPick, type CuratorPick } from '../../../lib/curator';

/**
 * Page Découvrir — Phase 7 "Explore". Miroir de apps/web/app/explore/page.tsx,
 * uniquement la disposition mobile web (space-y-12 lg:hidden) : pas de layout
 * 2 colonnes avec sidebar sticky, qui ne s'applique pas ici.
 *
 * Onboarding : le web redirige vers /onboarding si userNeedsOnboarding — ce flow
 * (choix de username, comptes suggérés) n'existe pas côté mobile et reste hors
 * scope de cette passe. Seul getProfileTier() est repris pour l'affichage
 * conditionnel déjà présent sur la page elle-même (CTA inline si tier === 'new').
 */
export default function ExploreScreen() {
  const scrollHandler = useNavScrollHandler();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<ProfileTier>('anonymous');
  const [trending, setTrending] = useState<TrendingAlbum[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<TrackWithStats[]>([]);
  const [forYou, setForYou] = useState<ForYouAlbum[]>([]);
  const [forYouTracks, setForYouTracks] = useState<ForYouTrack[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryResult>({ albums: [], mode: 'discover', hasTasteProfile: false });
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [communityLists, setCommunityLists] = useState<ProfileListUI[]>([]);
  const [curatorPick, setCuratorPick] = useState<CuratorPick | null>(null);

  const load = useCallback(async () => {
    try {
      const profileTier = await getProfileTier();
      const isEstablished = profileTier === 'established';

      const [t, fy, fyt, disc, su, tt, lists, pick] = await Promise.all([
        getTrendingThisWeek(10),
        isEstablished ? getForYouSuggestions(4) : Promise.resolve([]),
        isEstablished ? getForYouTracks(4) : Promise.resolve([]),
        getDiscoveryAlbums(10),
        isEstablished ? getSimilarUsers(4) : Promise.resolve([]),
        getTrendingTracks(10),
        getPublicLists(6),
        getCuratorPick(),
      ]);

      setTier(profileTier);
      setTrending(t);
      setForYou(fy);
      setForYouTracks(fyt);
      setDiscovery(disc);
      setSimilarUsers(su);
      setTrendingTracks(tt);
      setCommunityLists(lists);
      setCuratorPick(pick);
    } catch (err) {
      console.error('Explore data fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshControl } = usePullToRefresh(load);

  const isEmpty = !loading && trending.length === 0 && trendingTracks.length === 0 && communityLists.length === 0 && !curatorPick;

  return (
    // paddingTop: insets.top est porté par ce wrapper (pas par le ScrollView) pour que
    // le repère y=0 des enfants "sticky" du ScrollView soit déjà sous la status bar/le
    // notch — sinon stickyHeaderIndices fige la barre de recherche au ras de l'écran,
    // par-dessus la zone système.
    <View style={{ flex: 1, paddingTop: insets.top }} className="bg-background">
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 100 }}
        // Index 1 = la barre de recherche : reste collée en haut au scroll, comme
        // StickySearchBar (web, sticky top-0 + IntersectionObserver). stickyHeaderIndices
        // se réfère à l'index parmi les enfants directs du ScrollView ci-dessous.
        stickyHeaderIndices={[1]}
      >
      <View className="mt-6 mb-5">
        <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 28 }} className="text-text-primary mb-2">
          Découvrir
        </Text>
        <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
          Découvre de la musique, des listes et des profils qui correspondent à tes goûts.
        </Text>
      </View>

      <View className="bg-background pb-5">
        <SearchTrigger />
      </View>

      {loading ? (
        <View className="py-20 items-center">
          <ActivityIndicator color="#8E6F5E" />
        </View>
      ) : isEmpty ? (
        <View className="py-16 items-center" style={{ gap: 16 }}>
          <Text className="text-text-primary text-center" style={{ fontFamily: 'Inter_500Medium', fontSize: 16 }}>
            Bienvenue sur Waveform !
          </Text>
          <Text className="text-text-secondary text-center" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
            Commence à découvrir de la musique en recherchant tes albums et artistes préférés.
          </Text>
          <Text className="text-text-tertiary text-center" style={{ fontFamily: 'Inter_500Medium', fontSize: 12 }}>
            Utilise la barre de recherche ci-dessus pour trouver n'importe quel album ou artiste
          </Text>
        </View>
      ) : (
        <View style={{ gap: 44 }}>
          {tier === 'established' && <PourToiSection albums={forYou} tracks={forYouTracks} />}
          {tier === 'new' && <OnboardingCTASection />}
          {curatorPick && <CuratorPickSection pick={curatorPick} />}
          <TrendingSection albums={trending} tracks={trendingTracks} />
          <DiscoverySection result={discovery} />
          <CommunityListsSection lists={communityLists} />
          {tier === 'established' && <SimilarUsersSection users={similarUsers} />}
        </View>
      )}
      </Animated.ScrollView>
    </View>
  );
}
