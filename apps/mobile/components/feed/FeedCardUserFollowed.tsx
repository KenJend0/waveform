import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeedEvent } from '../../lib/feed';
import { getTimeAgo } from '../../lib/formatDate';
import { ActorLink } from './ActorLink';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedTextLines } from './FeedTextLines';
import { formatActors } from './formatActors';

type Props = { event: FeedEvent & { type: 'USER_FOLLOWED' }; currentUserId?: string };

export function FeedCardUserFollowed({ event, currentUserId }: Props) {
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const isMe = currentUserId === event.actor.id;
  const isAggregate = Boolean(event.actors_count && event.actors_count > 1 && event.actors);

  const context = (
    <Text>
      {isMe ? (
        <Text>{`Tu as commencé à suivre ${event.followee?.username ?? 'quelqu’un'}`}</Text>
      ) : isAggregate ? (
        <Text>
          {formatActors(event.actors!, event.actors_count!)}
          <Text> t'ont suivi</Text>
        </Text>
      ) : (
        <>
          <ActorLink username={event.actor.username} />
          <Text> a commencé à te suivre</Text>
        </>
      )}
    </Text>
  );

  return (
    <Pressable onPress={() => router.push(`/u/${event.actor.username}` as any)} className="flex-row items-center gap-3 px-6 py-2">
      <FeedAvatarCluster actor={event.actor} actors={event.actors} isAggregate={isAggregate} glyph="follow" />
      <FeedTextLines context={context} time={timeAgo} />
    </Pressable>
  );
}
