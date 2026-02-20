'use client';

import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';

interface FeedCardUserFollowedProps {
  event: FeedEvent & { type: 'USER_FOLLOWED' };
  currentUserId?: string;
}

export default function FeedCardUserFollowed({
  event,
  currentUserId,
}: FeedCardUserFollowedProps) {
  const timeAgo = getTimeAgo(event.created_at);

  return (
    <div className="relative flex items-start gap-2 px-6 py-2">
      <time className="absolute top-2 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>
      <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
      <p className="flex-1 min-w-0 pr-16 text-[12px] text-text-tertiary leading-relaxed">
        {currentUserId === event.actor.id ? (
          <>
            Tu as commencé à suivre{' '}
            {event.followee ? (
              <Link
                href={`/u/${event.followee.username}`}
                className="hover:text-text-primary transition-colors duration-150"
              >
                {event.followee.display_name || event.followee.username}
              </Link>
            ) : (
              'quelqu\'un'
            )}
          </>
        ) : (
          <>
            <Link
              href={`/u/${event.actor.username}`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              {event.actor.display_name || event.actor.username}
            </Link>
            {' '}a commencé à te suivre
          </>
        )}
      </p>
    </div>
  );
}

