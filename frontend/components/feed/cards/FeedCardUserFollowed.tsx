'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getFollowActors } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { formatActors } from '@/components/feed/formatActors';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';

interface FeedCardUserFollowedProps {
  event: FeedEvent & { type: 'USER_FOLLOWED' };
  currentUserId?: string;
}

export default function FeedCardUserFollowed({
  event,
  currentUserId,
}: FeedCardUserFollowedProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;

  return (
    <>
      <div className="relative flex items-start gap-2 px-6 py-2">
        <time className="absolute top-2 right-6 text-[12px] text-text-disabled">
          {timeAgo}
        </time>

        {isAggregate ? (
          <div className="flex -space-x-1 flex-shrink-0">
            {event.actors!.slice(0, 3).map(a => (
              <UserAvatar key={a.id} userId={a.id} src={a.avatar_url} size={18} />
            ))}
          </div>
        ) : (
          <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
        )}

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
          ) : isAggregate ? (
            <>
              {formatActors(
                event.actors!,
                event.actors_count!,
                needsFetch ? () => setSheetOpen(true) : undefined,
              )}{' '}
              vous ont suivi
            </>
          ) : (
            <>
              <Link
                href={`/u/${event.actor.username}`}
                className="text-text-secondary hover:text-text-primary transition-colors duration-150"
              >
                {event.actor.display_name || event.actor.username}
              </Link>
              {' '}a commencé à te suivre
            </>
          )}
        </p>
      </div>

      {isAggregate && event.followee && (
        <FeedActorsBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Nouveaux abonnés"
          knownActors={event.actors!}
          totalCount={event.actors_count!}
          fetchActors={needsFetch
            ? () => getFollowActors(event.followee!.id, event.created_at)
            : undefined
          }
        />
      )}
    </>
  );
}
