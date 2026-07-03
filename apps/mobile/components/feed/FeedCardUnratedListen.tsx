import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeedEvent } from '../../lib/feed';
import { getTimeAgo } from '../../lib/formatDate';
import { Avatar } from '../Avatar';
import { ActorLink } from './ActorLink';
import { FeedTextLines } from './FeedTextLines';
import { FeedRightCluster } from './FeedRightCluster';

type Props = { event: FeedEvent & { type: 'UNRATED_LISTEN' }; currentUserId?: string };

export function FeedCardUnratedListen({ event, currentUserId }: Props) {
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const isMe = currentUserId === event.actor.id;
  const entryHref = event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album?.id}`;

  const context = (
    <Text>
      {isMe ? (
        <Text>Tu as écouté</Text>
      ) : (
        <>
          <ActorLink username={event.actor.username} />
          <Text> a écouté</Text>
        </>
      )}
    </Text>
  );

  return (
    <Pressable onPress={() => router.push(entryHref as any)} className="flex-row items-center gap-3 px-6 py-2">
      <Avatar src={event.actor.avatar_url} size={32} />
      <FeedTextLines context={context} title={event.album?.title} artist={event.album?.artist_name} time={timeAgo} />
      <FeedRightCluster coverUrl={event.album?.cover_url} />
    </Pressable>
  );
}
