import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeedEvent } from '../../../lib/feed';
import { getTimeAgo } from '../../../lib/formatDate';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedTextLines } from './FeedTextLines';
import { FeedRightCluster } from './FeedRightCluster';
import { buildInteractionContext } from './feedInteractionContext';

type Props = { event: FeedEvent & { type: 'COMMENT_CREATED' }; currentUserId?: string };

export function FeedCardCommentCreated({ event, currentUserId }: Props) {
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = Boolean(event.actors_count && event.actors_count > 1 && event.actors);
  const entryHref = event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album?.id}`;

  const context = buildInteractionContext({
    currentUserId,
    actor: event.actor,
    verb: 'commenté',
    isAggregate,
    actors: event.actors,
    actorsCount: event.actors_count,
    entryOwnerId: event.entry_owner_id,
    alsoActed: event.current_user_also_commented,
    targetHasReview: event.target_has_review,
  });

  return (
    <Pressable onPress={() => router.push(entryHref as any)} className="flex-row items-center gap-3 px-6 py-2">
      <FeedAvatarCluster actor={event.actor} actors={event.actors} isAggregate={isAggregate} glyph="comment" />
      <FeedTextLines context={context} title={event.album?.title} time={timeAgo} />
      <FeedRightCluster coverUrl={event.album?.cover_url} />
    </Pressable>
  );
}
