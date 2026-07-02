import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeedEvent } from '../../lib/feed';
import { getTimeAgo } from '../../lib/formatDate';
import { Avatar } from '../Avatar';
import { ActorLink } from './ActorLink';
import { FeedTextLines } from './FeedTextLines';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedActions } from './FeedActions';
import { CommentSheet } from './CommentSheet';

type Props = { event: FeedEvent & { type: 'TRACK_REVIEW_CREATED' }; currentUserId?: string };

export function FeedCardTrackReviewCreated({ event, currentUserId }: Props) {
  const router = useRouter();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(event.comments_count ?? 0);
  const timeAgo = getTimeAgo(event.created_at);
  const hasWords = !!event.review_excerpt;
  const isMe = currentUserId === event.actor.id;
  const track = event.track;
  const entryHref = event.entry_id ? `/track-diary/${event.entry_id}` : `/tracks/${track?.id}`;
  const coverUrl = track?.cover_url ?? event.album?.cover_url ?? null;

  const context = (
    <Text>
      {isMe ? (
        <Text>{hasWords ? 'Tu as écrit une critique' : 'Tu as noté'}</Text>
      ) : (
        <>
          <ActorLink username={event.actor.username} />
          <Text>{hasWords ? ' a écrit une critique' : ' a noté un titre'}</Text>
        </>
      )}
    </Text>
  );

  const artistOrExcerpt = hasWords ? `« ${event.review_excerpt?.trim()} »` : track?.artist_name;

  const row = (
    <Pressable onPress={() => router.push(entryHref as any)} className="flex-row items-center gap-3">
      <Avatar src={event.actor.avatar_url} size={32} />
      <FeedTextLines context={context} title={track?.title} artist={artistOrExcerpt} time={hasWords ? '' : timeAgo} />
      <FeedRightCluster rating={event.rating} coverUrl={coverUrl} />
    </Pressable>
  );

  if (!hasWords) {
    return <View className="px-3 py-2">{row}</View>;
  }

  return (
    <>
      <View className="mx-3 rounded-card border border-accent px-3 pt-3 pb-2 relative">
        <View className="absolute -top-2.5 self-center bg-background px-2">
          <Text className="text-accent text-[12px]" style={{ fontFamily: 'InstrumentSerif_400Regular_Italic' }}>
            critique
          </Text>
        </View>
        {row}
        <FeedActions
          entryId={event.entry_id}
          currentUserId={currentUserId}
          isLiked={event.is_liked}
          likesCount={event.likes_count}
          commentsCount={commentsCount}
          onCommentPress={() => setCommentsOpen(true)}
        />
        <Text className="ml-11 mt-1 text-[11px] text-text-disabled">{timeAgo}</Text>
      </View>
      <CommentSheet
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        entryId={event.entry_id}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
      />
    </>
  );
}
