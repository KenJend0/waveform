'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FeedEvent } from '@/app/actions/feed';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { ActorLink } from './FeedActorLink';
import { FeedAvatarGlyph } from './FeedAvatarGlyph';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';

interface FeedCardCommentReplyProps {
  event: FeedEvent & { type: 'COMMENT_REPLY' };
}

export default function FeedCardCommentReply({ event }: FeedCardCommentReplyProps) {
  const timeAgo = getTimeAgo(event.created_at);
  const router = useRouter();

  const entryLink = event.entry_id
    ? `/diary/${event.entry_id}${event.comment_id ? `?reply=${event.comment_id}` : ''}`
    : event.album
    ? `/albums/${event.album.id}`
    : null;

  const context = (
    <>
      <ActorLink username={event.actor.username} />
      <span>{' a répondu à ton commentaire'}</span>
    </>
  );

  const title = event.album && entryLink && (
    <Link href={entryLink} className="hover:text-accent-deep transition-colors duration-150">
      {event.album.title}
    </Link>
  );

  const handleCardNavigation = (target: EventTarget | null) => {
    if (!entryLink) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;
    router.push(entryLink);
  };

  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-2 ${entryLink ? 'cursor-pointer' : ''}`}
      onClick={(e) => handleCardNavigation(e.target)}
      onKeyDown={(e) => {
        if (entryLink && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleCardNavigation(e.target);
        }
      }}
      role={entryLink ? 'link' : undefined}
      tabIndex={entryLink ? 0 : undefined}
      data-feed-nav-href={entryLink ?? undefined}
    >
      <Link href={`/u/${event.actor.username}`} className="flex-shrink-0">
        <FeedAvatarGlyph userId={event.actor.id} avatarUrl={event.actor.avatar_url} size={32} glyph="reply" />
      </Link>

      <FeedTextLines
        context={context}
        title={title}
        titleText={event.album?.title}
        time={timeAgo}
        className="flex-1 min-w-0"
      />

      <FeedRightCluster
        coverUrl={event.album?.cover_url}
        coverHref={entryLink}
        coverAlt={event.album?.title}
      />
    </div>
  );
}
