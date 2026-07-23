import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileHeader } from '../../../components/profile/ProfileHeader';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { ProfileTabs } from '../../../components/profile/ProfileTabs';
import { RatingDistribution } from '../../../components/profile/RatingDistribution';
import { RatingFilterProvider } from '../../../lib/RatingFilterContext';
import { useAuth } from '../../../lib/AuthContext';
import { useNavScrollHandler } from '../../../lib/useNavScrollHandler';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { supabase } from '../../../lib/supabase';
import { ensureProfile, getCurrentStreak, getFavoriteAlbums, type FavoriteAlbum } from '../../../lib/profile';
import { getOrCreateDefaultList } from '../../../lib/lists';
import { getUserDiary, getUserReviewsUnified, type DiaryEntryUI, type UnifiedReview } from '../../../lib/diary';
import { getUserTrackDiary, type TrackDiaryEntryUI } from '../../../lib/trackDiary';
import { getFullUserLists, getUserSavedLists, type ProfileListUI } from '../../../lib/lists';

type ProfileData = { username: string; bio: string | null; avatar_url: string | null };

/**
 * Page /me — miroir de apps/web/app/me/page.tsx + ProfileHeader/ProfileTabs (web).
 * Voir docs/MOBILE_ROADMAP.md (6.6) pour les notes de scope (Top3 en lecture seule,
 * pas de filtre par note, pas de gestion de listes).
 */
export default function MeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollHandler = useNavScrollHandler();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [favoriteAlbums, setFavoriteAlbums] = useState<FavoriteAlbum[]>([]);
  const [streak, setStreak] = useState<{ days: number; isActiveToday: boolean } | undefined>(undefined);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [allRatings, setAllRatings] = useState<(number | null)[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntryUI[]>([]);
  const [trackEntries, setTrackEntries] = useState<TrackDiaryEntryUI[]>([]);
  const [unifiedReviews, setUnifiedReviews] = useState<UnifiedReview[]>([]);
  const [lists, setLists] = useState<ProfileListUI[]>([]);
  const [savedLists, setSavedLists] = useState<ProfileListUI[]>([]);

  // Le spinner plein écran ne doit s'afficher qu'au tout premier chargement : les refetch
  // déclenchés par useFocusEffect (à chaque retour sur l'onglet) mettent à jour les données
  // en arrière-plan sans effacer l'écran ni le scroll.
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    if (!hasLoadedOnceRef.current) setLoading(true);

    await ensureProfile();

    const [
      { data: profileRow },
      { count: followers },
      { count: following },
      favAlbums,
      streakResult,
      diary,
      tracks,
      reviews,
      userLists,
      userSavedLists,
      { data: albumRatings },
      { data: trackRatings },
      { count: albumReviewsCount },
      { count: trackReviewsCount },
    ] = await Promise.all([
      supabase.from('profiles').select('username, bio, avatar_url').eq('id', user.id).maybeSingle(),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
      getFavoriteAlbums(user.id),
      getCurrentStreak(user.id),
      getUserDiary(user.id, 0, 51),
      getUserTrackDiary(user.id, 0, 51),
      getUserReviewsUnified(user.id),
      getFullUserLists(user.id),
      getUserSavedLists(user.id),
      supabase.from('diary_entries').select('rating').eq('user_id', user.id),
      supabase.from('track_diary_entries').select('rating').eq('user_id', user.id),
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('review_body', 'is', null),
      supabase.from('track_diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('review_body', 'is', null).neq('review_body', ''),
      getOrCreateDefaultList().catch((err) => {
        console.error('Error ensuring default list:', err);
        return null;
      }),
    ]);

    setProfile(profileRow ?? null);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
    setFavoriteAlbums(favAlbums);
    setStreak(streakResult.ok ? { days: streakResult.streakDays, isActiveToday: streakResult.isActiveToday } : undefined);
    setDiaryEntries(diary);
    setTrackEntries(tracks);
    setUnifiedReviews(reviews);
    setLists(userLists);
    setSavedLists(userSavedLists);
    setAllRatings([...(albumRatings ?? []).map((r) => r.rating), ...(trackRatings ?? []).map((r) => r.rating)]);
    setReviewsCount((albumReviewsCount ?? 0) + (trackReviewsCount ?? 0));
    setLoading(false);
    hasLoadedOnceRef.current = true;
  }, [user]);

  // Refetch à chaque prise de focus de l'onglet (pas juste au montage) — l'écran reste
  // monté en arrière-plan en changeant d'onglet (bottom nav), donc un simple
  // useEffect([user]) ne relirait jamais une liste sauvegardée depuis Découvrir tant
  // qu'on ne revient pas ici (voir même pattern dans app/(tabs)/feed/index.tsx).
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const { refreshControl } = usePullToRefresh(load);

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-text-secondary text-center" style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}>
          Connecte-toi pour voir ton profil.
        </Text>
      </View>
    );
  }

  if (loading || !profile) {
    return <LoadingScreen />;
  }

  const username = profile.username || user.email?.split('@')[0] || 'user';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={refreshControl}
      >
        <ProfileHeader
          user={{ id: user.id, username, pictureUrl: profile.avatar_url, bio: profile.bio, isMe: true }}
          reviewsCount={reviewsCount}
          followersCount={followersCount}
          followingCount={followingCount}
          streak={streak}
          favoriteAlbums={favoriteAlbums}
          onOpenFollowers={() => router.push(`/u/${username}/followers`)}
          onOpenFollowing={() => router.push(`/u/${username}/following`)}
        />

        <View style={{ paddingHorizontal: 16 }}>
          <RatingFilterProvider>
            <RatingDistribution ratings={allRatings} label="Mes" />

            <View className="mt-8">
              <ProfileTabs
                isMe
                userId={user.id}
                diaryEntries={diaryEntries}
                trackEntries={trackEntries}
                unifiedReviews={unifiedReviews}
                lists={lists}
                savedLists={savedLists}
                currentUserId={user.id}
              />
            </View>
          </RatingFilterProvider>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
