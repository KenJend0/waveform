import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/AuthContext';
import { useNavScrollHandler } from '../../../lib/useNavScrollHandler';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { getMyFeed, type FeedEvent, type FeedScope } from '../../../lib/feed';
import { FeedTabs } from '../../../components/feed/FeedTabs';
import { FeedDateSeparator, getDateBucket } from '../../../components/feed/FeedDateSeparator';
import { FeedCardReviewCreated } from '../../../components/feed/FeedCardReviewCreated';
import { FeedCardTrackReviewCreated } from '../../../components/feed/FeedCardTrackReviewCreated';
import { FeedCardReviewLiked } from '../../../components/feed/FeedCardReviewLiked';
import { FeedCardCommentCreated } from '../../../components/feed/FeedCardCommentCreated';
import { FeedCardCommentReply } from '../../../components/feed/FeedCardCommentReply';
import { FeedCardUserFollowed } from '../../../components/feed/FeedCardUserFollowed';
import { FeedCardUnratedListen } from '../../../components/feed/FeedCardUnratedListen';

type Tab = Extract<FeedScope, 'notifications' | 'activity'>;
type Bucket = { events: FeedEvent[]; cursor: string | null; hasMore: boolean; loaded: boolean };

type RenderItem = { kind: 'date'; id: string; label: string; isFirst: boolean } | { kind: 'event'; id: string; event: FeedEvent };

const EMPTY_BUCKET: Bucket = { events: [], cursor: null, hasMore: true, loaded: false };

function renderEvent(event: FeedEvent, currentUserId?: string) {
  switch (event.type) {
    case 'REVIEW_CREATED':
      return <FeedCardReviewCreated event={event as FeedEvent & { type: 'REVIEW_CREATED' }} currentUserId={currentUserId} />;
    case 'TRACK_REVIEW_CREATED':
      return <FeedCardTrackReviewCreated event={event as FeedEvent & { type: 'TRACK_REVIEW_CREATED' }} currentUserId={currentUserId} />;
    case 'REVIEW_LIKED':
      return <FeedCardReviewLiked event={event as FeedEvent & { type: 'REVIEW_LIKED' }} currentUserId={currentUserId} />;
    case 'COMMENT_CREATED':
      return <FeedCardCommentCreated event={event as FeedEvent & { type: 'COMMENT_CREATED' }} currentUserId={currentUserId} />;
    case 'COMMENT_REPLY':
      return <FeedCardCommentReply event={event as FeedEvent & { type: 'COMMENT_REPLY' }} />;
    case 'USER_FOLLOWED':
      return <FeedCardUserFollowed event={event as FeedEvent & { type: 'USER_FOLLOWED' }} currentUserId={currentUserId} />;
    case 'UNRATED_LISTEN':
      return <FeedCardUnratedListen event={event as FeedEvent & { type: 'UNRATED_LISTEN' }} currentUserId={currentUserId} />;
    default:
      return null;
  }
}

/** La carte "critique" (REVIEW_CREATED/TRACK_REVIEW_CREATED avec texte) a un label qui
 * chevauche sa bordure haute — deux d'affilée ont besoin d'un espacement supplémentaire
 * pour que le label du bas ne morde pas sur la bordure du haut (miroir de isCritiqueCard web). */
function isCritiqueCard(event: FeedEvent): boolean {
  return (event.type === 'REVIEW_CREATED' || event.type === 'TRACK_REVIEW_CREATED') && !!event.review_excerpt;
}

function buildRenderItems(events: FeedEvent[]): RenderItem[] {
  const items: RenderItem[] = [];
  let prevLabel: string | null = null;

  for (const event of events) {
    const label = getDateBucket(event.created_at);
    if (label !== prevLabel) {
      items.push({ kind: 'date', id: `date-${label}-${event.id}`, label, isFirst: prevLabel === null });
      prevLabel = label;
    }
    items.push({ kind: 'event', id: event.id, event });
  }

  return items;
}

export default function FeedScreen() {
  const scrollHandler = useNavScrollHandler();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const [buckets, setBuckets] = useState<Record<Tab, Bucket>>({
    notifications: EMPTY_BUCKET,
    activity: EMPTY_BUCKET,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadTab = useCallback(async (tab: Tab) => {
    const result = await getMyFeed({ limit: 20, scope: tab });
    setBuckets((prev) => ({
      ...prev,
      [tab]: { events: result.events, cursor: result.nextCursor, hasMore: Boolean(result.nextCursor), loaded: true },
    }));
  }, []);

  useEffect(() => {
    if (user && !buckets[activeTab].loaded) {
      loadTab(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  const { refreshing, refreshControl } = usePullToRefresh(() => loadTab(activeTab));

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
  const renderItems = useMemo(() => buildRenderItems(bucket.events), [bucket.events]);

  return (
    <Animated.FlatList
      data={renderItems}
      keyExtractor={(item: RenderItem) => item.id}
      renderItem={({ item, index }: { item: RenderItem; index: number }) => {
        if (item.kind === 'date') {
          return <FeedDateSeparator label={item.label} isFirst={item.isFirst} />;
        }
        const prevItem = index > 0 ? renderItems[index - 1] : null;
        const needsClearance =
          prevItem?.kind === 'event' && isCritiqueCard(item.event) && isCritiqueCard(prevItem.event);
        return <View className={needsClearance ? 'mt-2' : 'mt-0.5'}>{renderEvent(item.event, user?.id)}</View>;
      }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      ListHeaderComponent={
        <View style={{ paddingTop: insets.top + 8 }} className="pb-2">
          <Text style={{ fontFamily: 'InstrumentSerif_400Regular' }} className="text-3xl text-text-primary px-3 mb-1">
            Activité
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-text-tertiary px-3 mb-4 text-[13px]">
            Ce qui se passe autour de toi.
          </Text>
          <FeedTabs active={activeTab} onChange={setActiveTab} />
        </View>
      }
      ListEmptyComponent={
        !bucket.loaded ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#1C1C1C" />
          </View>
        ) : (
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
        )
      }
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
  );
}
