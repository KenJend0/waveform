'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const entryHref = event.entry_id
    ? `/diary/${event.entry_id}`
    : `/albums/${event.album?.id}`;
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

  const handleCardNavigation = (target: EventTarget | null) => {
    if (!entryHref) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;
    router.push(entryHref);
  };

  const artist = event.album?.artist_name && (
    event.album.artist_name
  );

  return (
    <div
      className="relative flex items-center gap-3 px-3 py-2 cursor-pointer"
      onClick={(e) => handleCardNavigation(e.target)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardNavigation(e.target);
        }
      }}
      role="link"
      tabIndex={0}
      data-feed-nav-href={entryHref}
    >
      <Link href={`/u/${event.actor.username}`} className="flex-shrink-0">
        <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={32} />
      </Link>

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
