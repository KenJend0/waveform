'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getCommentActors } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { formatActors } from '@/components/feed/formatActors';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';

interface FeedCardCommentCreatedProps {
  event: FeedEvent & { type: 'COMMENT_CREATED' };
  currentUserId?: string;
}

export default function FeedCardCommentCreated({
  event,
  currentUserId,
}: FeedCardCommentCreatedProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;

  const albumLink = event.album && (
    <>
      {' de '}
      <Link
        href={event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album.id}`}
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
            <>Tu as commenté une écoute{albumLink}</>
          ) : isAggregate ? (
            <>
              {formatActors(
                event.actors!,
                event.actors_count!,
                needsFetch ? () => setSheetOpen(true) : undefined,
              )}{' '}
              ont commenté ton écoute{albumLink}
            </>
          ) : (
            <>
              <Link
                href={`/u/${event.actor.username}`}
                className="text-text-secondary hover:text-text-primary transition-colors duration-150"
              >
                {event.actor.username}
              </Link>
              {event.entry_owner_id === currentUserId ? (
                <>{' '}a commenté ton écoute</>
              ) : event.current_user_also_commented ? (
                <>{' '}a aussi commenté l&apos;écoute</>
              ) : (
                <>{' '}a commenté une écoute</>
              )}
              {albumLink}
            </>
          )}
        </p>
      </div>

      {isAggregate && event.entry_id && (
        <FeedActorsBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Commentaires"
          knownActors={event.actors!}
          totalCount={event.actors_count!}
          fetchActors={needsFetch
            ? () => getCommentActors(event.entry_id!)
            : undefined
          }
        />
      )}
    </>
  );
}
