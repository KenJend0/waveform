import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/AuthContext';
import { useNavScrollHandler } from '../../../lib/useNavScrollHandler';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { getLastSeenActivityAt, getMyFeed, markActivitySeen, type FeedEvent, type FeedScope } from '../../../lib/feed';
import { FeedTabs } from '../../../components/feed/FeedTabs';
import { FeedDateSeparator, getDateBucket } from '../../../components/feed/FeedDateSeparator';
import { FeedNewSeparator } from '../../../components/feed/FeedNewSeparator';
import { FeedCardReviewCreated } from '../../../components/feed/FeedCardReviewCreated';
import { FeedCardTrackReviewCreated } from '../../../components/feed/FeedCardTrackReviewCreated';
import { FeedCardReviewLiked } from '../../../components/feed/FeedCardReviewLiked';
import { FeedCardCommentCreated } from '../../../components/feed/FeedCardCommentCreated';
import { FeedCardCommentReply } from '../../../components/feed/FeedCardCommentReply';
import { FeedCardUserFollowed } from '../../../components/feed/FeedCardUserFollowed';
import { FeedCardUnratedListen } from '../../../components/feed/FeedCardUnratedListen';
import { FeedCardTrackReviewLiked } from '../../../components/feed/FeedCardTrackReviewLiked';
import { FeedCardTrackCommentCreated } from '../../../components/feed/FeedCardTrackCommentCreated';
import { groupFeedEvents, type GroupedFeedItem } from '../../../components/feed/groupFeedEvents';
import { ListenGroupCard } from '../../../components/feed/ListenGroupCard';
import { LikeGroupCard } from '../../../components/feed/LikeGroupCard';

type Tab = Extract<FeedScope, 'notifications' | 'activity'>;
type Bucket = { events: FeedEvent[]; cursor: string | null; hasMore: boolean; loaded: boolean };

type RenderItem =
  | { kind: 'date'; id: string; label: string; isFirst: boolean }
  | { kind: 'newSeparator'; id: string; label: string; leadingCritique: boolean }
  | { kind: 'event'; id: string; event: GroupedFeedItem; needsClearance: boolean }
  | { kind: 'loading'; id: 'loading' }
  | { kind: 'empty'; id: 'empty' };

/** Compte les événements postérieurs à la dernière visite — miroir de countEventsAfter (web). */
function countEventsAfter(events: FeedEvent[], lastSeenAt: string | null): number {
  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  if (!Number.isFinite(lastSeenTime)) return 0;
  return events.filter((event) => new Date(event.created_at).getTime() > lastSeenTime).length;
}

const EMPTY_BUCKET: Bucket = { events: [], cursor: null, hasMore: true, loaded: false };

function renderEvent(item: GroupedFeedItem, currentUserId?: string) {
  if (item.type === 'LISTEN_GROUP') {
    return <ListenGroupCard group={item} currentUserId={currentUserId} />;
  }
  if (item.type === 'LIKE_GROUP') {
    return <LikeGroupCard group={item} currentUserId={currentUserId} />;
  }
  switch (item.type) {
    case 'REVIEW_CREATED':
      return <FeedCardReviewCreated event={item as FeedEvent & { type: 'REVIEW_CREATED' }} currentUserId={currentUserId} />;
    case 'TRACK_REVIEW_CREATED':
      return <FeedCardTrackReviewCreated event={item as FeedEvent & { type: 'TRACK_REVIEW_CREATED' }} currentUserId={currentUserId} />;
    case 'REVIEW_LIKED':
      return <FeedCardReviewLiked event={item as FeedEvent & { type: 'REVIEW_LIKED' }} currentUserId={currentUserId} />;
    case 'COMMENT_CREATED':
      return <FeedCardCommentCreated event={item as FeedEvent & { type: 'COMMENT_CREATED' }} currentUserId={currentUserId} />;
    case 'COMMENT_REPLY':
      return <FeedCardCommentReply event={item as FeedEvent & { type: 'COMMENT_REPLY' }} />;
    case 'USER_FOLLOWED':
      return <FeedCardUserFollowed event={item as FeedEvent & { type: 'USER_FOLLOWED' }} currentUserId={currentUserId} />;
    case 'UNRATED_LISTEN':
      return <FeedCardUnratedListen event={item as FeedEvent & { type: 'UNRATED_LISTEN' }} currentUserId={currentUserId} />;
    case 'TRACK_REVIEW_LIKED':
      return <FeedCardTrackReviewLiked event={item as FeedEvent & { type: 'TRACK_REVIEW_LIKED' }} currentUserId={currentUserId} />;
    case 'TRACK_COMMENT_CREATED':
      return <FeedCardTrackCommentCreated event={item as FeedEvent & { type: 'TRACK_COMMENT_CREATED' }} currentUserId={currentUserId} />;
    default:
      return null;
  }
}

/** La carte "critique" (REVIEW_CREATED/TRACK_REVIEW_CREATED avec texte) a un label qui
 * chevauche sa bordure haute — deux d'affilée ont besoin d'un espacement supplémentaire
 * pour que le label du bas ne morde pas sur la bordure du haut (miroir de isCritiqueCard web). */
function isCritiqueCard(item: GroupedFeedItem): boolean {
  if (item.type === 'LISTEN_GROUP' || item.type === 'LIKE_GROUP') return false;
  return (item.type === 'REVIEW_CREATED' || item.type === 'TRACK_REVIEW_CREATED') && !!item.review_excerpt;
}

function buildRenderItems(
  items: GroupedFeedItem[],
  bucket: Bucket,
  lastSeenAt: string | null,
  newSeparatorLabel: string
): RenderItem[] {
  const result: RenderItem[] = [];

  if (!bucket.loaded) {
    result.push({ kind: 'loading', id: 'loading' });
    return result;
  }

  if (items.length === 0) {
    result.push({ kind: 'empty', id: 'empty' });
    return result;
  }

  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  const allItemsAreNew =
    lastSeenTime !== null && items.every((item) => new Date(item.created_at).getTime() > lastSeenTime);
  const showNewMarker = lastSeenTime !== null && Number.isFinite(lastSeenTime) && !allItemsAreNew;

  let prevLabel: string | null = null;
  let prevItem: GroupedFeedItem | null = null;

  for (const item of items) {
    const itemIsNew = showNewMarker && new Date(item.created_at).getTime() > lastSeenTime!;
    const prevItemIsNew = !!prevItem && showNewMarker && new Date(prevItem.created_at).getTime() > lastSeenTime!;
    if (!itemIsNew && prevItemIsNew) {
      result.push({
        kind: 'newSeparator',
        id: `new-${item.id}`,
        label: newSeparatorLabel,
        leadingCritique: !!prevItem && isCritiqueCard(prevItem),
      });
    }

    const label = getDateBucket(item.created_at);
    const dateChanged = label !== prevLabel;
    if (dateChanged) {
      result.push({ kind: 'date', id: `date-${label}-${item.id}`, label, isFirst: prevLabel === null });
      prevLabel = label;
    }
    // Basé sur le véritable événement précédent (peu importe qu'un newSeparator se soit
    // intercalé juste avant) — miroir de needsClearance (web, FeedInfiniteList.tsx), qui ne
    // désactive le clearance que sur un changement de date, jamais sur un newSeparator.
    const needsClearance = !dateChanged && !!prevItem && isCritiqueCard(item) && isCritiqueCard(prevItem);
    result.push({ kind: 'event', id: item.id, event: item, needsClearance });
    prevItem = item;
  }

  return result;
}

const TAB_IDS: Tab[] = ['notifications', 'activity'];

export default function FeedScreen() {
  const scrollHandler = useNavScrollHandler();
  const insets = useSafeAreaInsets();
  const { user, refreshUnseenActivity } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const [buckets, setBuckets] = useState<Record<Tab, Bucket>>({
    notifications: EMPTY_BUCKET,
    activity: EMPTY_BUCKET,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  // Figée à la première valeur chargée pour la session — comme initialLastSeenRef (web) —
  // sinon un simple retour sur l'onglet (re-focus) irait relire la valeur déjà mise à jour
  // par un markActivitySeen() précédent et le badge/filet "non lu" ne réapparaîtrait plus jamais.
  const [lastSeenAt, setLastSeenAt] = useState<string | null | undefined>(undefined);
  const lastSeenFetchedForUserRef = useRef<string | null>(null);
  const [seenUnreadTabs, setSeenUnreadTabs] = useState<Set<Tab>>(() => new Set());
  const markSeenInFlightRef = useRef(false);

  const loadTab = useCallback(async (tab: Tab) => {
    const result = await getMyFeed({ limit: 20, scope: tab });
    setBuckets((prev) => ({
      ...prev,
      [tab]: { events: result.events, cursor: result.nextCursor, hasMore: Boolean(result.nextCursor), loaded: true },
    }));
  }, []);

  // Refetch des events à chaque prise de focus (pas juste au montage) — l'écran reste monté
  // en arrière-plan entre les onglets de la bottom nav, donc un simple useEffect([user]) ne
  // relirait jamais les nouveaux events de l'onglet inactif — sinon son badge ne bougerait
  // jamais tant qu'on ne l'ouvre pas. En revanche lastSeenAt et seenUnreadTabs ne sont
  // initialisés qu'une seule fois par utilisateur — comme initialLastSeenRef/seenUnreadTabs
  // (web), qui ne sont jamais réinitialisés après le montage. Sur mobile l'écran ne démonte
  // jamais en changeant d'onglet de la bottom nav (contrairement au web où changer de page
  // démonte /feed), donc réinitialiser seenUnreadTabs à chaque focus ferait réapparaître un
  // badge déjà vu à la moindre visite de Découvrir/Ajouter/Moi suivie d'un retour.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      if (lastSeenFetchedForUserRef.current !== user.id) {
        lastSeenFetchedForUserRef.current = user.id;
        getLastSeenActivityAt().then(setLastSeenAt);
        setSeenUnreadTabs(new Set());
      }
      TAB_IDS.forEach((tab) => loadTab(tab));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const unreadCounts: Record<Tab, number> = {
    notifications: countEventsAfter(buckets.notifications.events, lastSeenAt ?? null),
    activity: countEventsAfter(buckets.activity.events, lastSeenAt ?? null),
  };
  const visibleUnreadCounts: Record<Tab, number> = {
    notifications: seenUnreadTabs.has('notifications') ? 0 : unreadCounts.notifications,
    activity: seenUnreadTabs.has('activity') ? 0 : unreadCounts.activity,
  };

  useEffect(() => {
    if (lastSeenAt === undefined) return;
    if (unreadCounts[activeTab] === 0 || seenUnreadTabs.has(activeTab)) return;

    const timer = setTimeout(() => {
      const nextSeenTabs = new Set(seenUnreadTabs);
      nextSeenTabs.add(activeTab);
      setSeenUnreadTabs(nextSeenTabs);

      const unreadTabs = TAB_IDS.filter((tab) => unreadCounts[tab] > 0);
      const allUnreadTabsSeen = unreadTabs.length > 0 && unreadTabs.every((tab) => nextSeenTabs.has(tab));

      if (allUnreadTabsSeen && !markSeenInFlightRef.current) {
        markSeenInFlightRef.current = true;
        markActivitySeen()
          .then(() => refreshUnseenActivity())
          .catch(() => {
            markSeenInFlightRef.current = false;
          });
      }
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lastSeenAt, unreadCounts.notifications, unreadCounts.activity, seenUnreadTabs]);

  const { refreshing, refreshControl } = usePullToRefresh(async () => {
    await Promise.all(TAB_IDS.map((tab) => loadTab(tab)));
  });

  const loadMore = useCallback(async () => {
    const bucket = buckets[activeTab];
    if (loadingMore || !bucket.hasMore || refreshing || !bucket.loaded) return;
    setLoadingMore(true);
    const result = await getMyFeed({ limit: 20, cursor: bucket.cursor, scope: activeTab });
    setBuckets((prev) => ({
      ...prev,
      [activeTab]: {
        events: [...prev[activeTab].events, ...result.events],
        cursor: result.nextCursor,
        hasMore: Boolean(result.nextCursor),
        loaded: true,
      },
    }));
    setLoadingMore(false);
  }, [activeTab, buckets, loadingMore, refreshing]);

  const bucket = buckets[activeTab];
  const newSeparatorLabel = activeTab === 'notifications' ? 'Déjà vu' : 'Plus ancien';
  const renderItems = useMemo(
    () => buildRenderItems(groupFeedEvents(bucket.events, user?.id), bucket, lastSeenAt ?? null, newSeparatorLabel),
    [bucket, user?.id, lastSeenAt, newSeparatorLabel]
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }} className="bg-background">
    <View className="bg-background pt-2 pb-3">
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular' }} className="text-3xl text-text-primary px-3 mb-1">
        Activité
      </Text>
      <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-text-tertiary px-3 mb-3 text-[13px]">
        Ce qui se passe autour de toi.
      </Text>
      <FeedTabs active={activeTab} onChange={setActiveTab} unreadCounts={visibleUnreadCounts} />
    </View>
    <Animated.FlatList
      data={renderItems}
      keyExtractor={(item: RenderItem) => item.id}
      renderItem={({ item }: { item: RenderItem }) => {
        if (item.kind === 'newSeparator') {
          return <FeedNewSeparator label={item.label} leadingCritique={item.leadingCritique} />;
        }
        if (item.kind === 'loading') {
          return (
            <View className="py-16 items-center">
              <ActivityIndicator size="large" color="#1C1C1C" />
            </View>
          );
        }
        if (item.kind === 'empty') {
          return (
            <View className="items-center px-8 pt-8">
              <Text style={{ fontFamily: 'InstrumentSerif_400Regular' }} className="text-2xl text-text-warm">
                Pas encore d'activité
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular' }} className="mt-2 text-text-secondary text-center">
                {activeTab === 'notifications'
                  ? 'Les likes, commentaires et nouveaux abonnés apparaîtront ici.'
                  : "L'activité de ton réseau apparaîtra ici."}
              </Text>
            </View>
          );
        }
        if (item.kind === 'date') {
          return <FeedDateSeparator label={item.label} isFirst={item.isFirst} />;
        }
        return <View className={item.needsClearance ? 'mt-3' : 'mt-0.5'}>{renderEvent(item.event, user?.id)}</View>;
      }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 100, flexGrow: 1 }}
      ListFooterComponent={
        loadingMore ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#6B6B6B" />
          </View>
        ) : !bucket.hasMore && bucket.events.length > 0 ? (
          <View className="py-8 items-center">
            <Text className="text-text-disabled text-[13px]" style={{ fontFamily: 'Inter_400Regular' }}>
              Fin du fil
            </Text>
          </View>
        ) : null
      }
    />
    </View>
  );
}
