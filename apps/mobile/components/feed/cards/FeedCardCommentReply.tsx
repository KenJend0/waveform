import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeedEvent } from '../../../lib/feed';
import { getTimeAgo } from '../../../lib/formatDate';
import { ActorLink } from './ActorLink';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedTextLines } from './FeedTextLines';
import { FeedRightCluster } from './FeedRightCluster';

type Props = { event: FeedEvent & { type: 'COMMENT_REPLY' } };

export function FeedCardCommentReply({ event }: Props) {
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const entryHref = event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album?.id}`;

  const context = (
    <Text>
      <ActorLink username={event.actor.username} />
      <Text> a répondu à ton commentaire</Text>
    </Text>
  );

  return (
    <Pressable onPress={() => router.push(entryHref as any)} className="flex-row items-center gap-3 px-6 py-2">
      <FeedAvatarCluster actor={event.actor} glyph="reply" />
      <FeedTextLines context={context} title={event.album?.title} time={timeAgo} />
      <FeedRightCluster coverUrl={event.album?.cover_url} />
    </Pressable>
  );
}
