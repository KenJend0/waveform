'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getEntryLikes } from '@/app/actions/diary';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { formatActors } from '@/components/feed/formatActors';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';

interface FeedCardReviewLikedProps {
  event: FeedEvent & { type: 'REVIEW_LIKED' };
  currentUserId?: string;
}

export default function FeedCardReviewLiked({
  event,
  currentUserId,
}: FeedCardReviewLikedProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;

  const albumLink = event.album && (
    <>
      {' de '}
      <Link
        href={event.liked_entry_id ? `/diary/${event.liked_entry_id}` : `/albums/${event.album.id}`}
        className="text-text-secondary hover:text-text-primary transition-colors duration-150"
      >
        {event.album.title}
      </Link>
    </>
  );

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
            <>Tu as aimé une écoute{albumLink}</>
          ) : isAggregate ? (
            <>
              {formatActors(
                event.actors!,
                event.actors_count!,
                needsFetch ? () => setSheetOpen(true) : undefined,
              )}{' '}
              ont aimé ton écoute{albumLink}
            </>
          ) : (
            <>
              <Link
                href={`/u/${event.actor.username}`}
                className="text-text-secondary hover:text-text-primary transition-colors duration-150"
              >
                {event.actor.display_name || event.actor.username}
              </Link>
              {event.entry_owner_id === currentUserId
                ? <>{' '}a aimé ton écoute</>
                : <>{' '}a aimé une écoute</>
              }
              {albumLink}
            </>
          )}
        </p>
      </div>

      {isAggregate && event.liked_entry_id && (
        <FeedActorsBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="J'aime"
          knownActors={event.actors!}
          totalCount={event.actors_count!}
          fetchActors={needsFetch
            ? async () => {
                const result = await getEntryLikes(event.liked_entry_id!);
                return result.map(u => ({
                  id: u.id,
                  username: u.username,
                  display_name: u.display_name,
                  avatar_url: u.avatar_url,
                }));
              }
            : undefined
          }
        />
      )}
    </>
  );
}
