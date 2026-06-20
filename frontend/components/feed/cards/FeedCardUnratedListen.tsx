'use client';

import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { ActorLink } from './FeedActorLink';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';

interface FeedCardUnratedListenProps {
  event: FeedEvent & { type: 'UNRATED_LISTEN' };
  currentUserId?: string;
}

export default function FeedCardUnratedListen({
  event,
  currentUserId,
}: FeedCardUnratedListenProps) {
  const timeAgo = getTimeAgo(event.created_at);
  const entryHref = event.entry_id
    ? `/diary/${event.entry_id}`
    : `/albums/${event.album?.id}`;
  const artistHref = event.album?.artist_id ? `/artists/${event.album.artist_id}` : null;
  const isMe = currentUserId === event.actor.id;

  const context = isMe ? (
    <span>Tu as écouté</span>
  ) : (
    <>
      <ActorLink username={event.actor.username} />
      <span>{' a écouté'}</span>
    </>
  );

  const title = event.album && (
    <Link href={entryHref} className="hover:text-accent-deep transition-colors duration-150">
      {event.album.title}
    </Link>
  );

  const artist = event.album?.artist_name && (
    artistHref ? (
      <Link href={artistHref} className="hover:text-text-primary transition-colors duration-150">
        {event.album.artist_name}
      </Link>
    ) : (
      event.album.artist_name
    )
  );

  return (
    <div className="relative flex items-center gap-3 px-3 py-2">
      <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={32} />

      <FeedTextLines
        context={context}
        title={title}
        titleText={event.album?.title}
        artist={artist}
        artistText={event.album?.artist_name ?? undefined}
        time={timeAgo}
        className="flex-1 min-w-0"
      />

      <FeedRightCluster
        coverUrl={event.album?.cover_url}
        coverHref={entryHref}
        coverAlt={event.album?.title}
      />
    </div>
  );
}
