'use client';

import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';

interface FeedCardReviewLikedProps {
  event: FeedEvent & { type: 'REVIEW_LIKED' };
  currentUserId?: string;
}

export default function FeedCardReviewLiked({
  event,
  currentUserId,
}: FeedCardReviewLikedProps) {
  const timeAgo = getTimeAgo(event.created_at);

  return (
    <div className="relative flex items-start gap-2 px-6 py-2">
      <time className="absolute top-2 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>
      <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
      <p className="flex-1 min-w-0 pr-16 text-[12px] text-text-tertiary leading-relaxed">
        {currentUserId === event.actor.id ? (
          <>Tu as aimé une écoute</>
        ) : (
          <>
            <Link
              href={`/u/${event.actor.username}`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              {event.actor.display_name || event.actor.username}
            </Link>
            {event.entry_owner_id === currentUserId
              ? <>{' '}a aimé ton écoute</>
              : <>{' '}a aimé une écoute</>
            }
          </>
        )}
        {event.album && (
          <>
            {' de '}
            <Link
              href={event.liked_entry_id ? `/diary/${event.liked_entry_id}` : `/albums/${event.album.id}`}
              className="text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              {event.album.title}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

