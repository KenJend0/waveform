'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getFollowActors } from '@/app/actions/feed';
import { getTimeAgo } from '@/lib/utils/formatDate';
import { formatActors } from '@/components/feed/formatActors';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';
import { ActorLink } from './FeedActorLink';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedTextLines } from './FeedTextLines';

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
  const canOpenActors = Boolean(isAggregate && event.followee);
  const avatarCluster = (
    <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="follow" />
  );

  const context = currentUserId === event.actor.id ? (
    <>
      Tu as commencé à suivre{' '}
      {event.followee ? (
        <ActorLink username={event.followee.username} emphasis />
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
      t&apos;ont suivi
    </>
  ) : (
    <>
      <ActorLink username={event.actor.username} />
      {' '}a commencé à te suivre
    </>
  );

  return (
    <>
      <div className="relative flex items-center gap-3 px-3 py-2">
        {canOpenActors ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Voir les personnes"
            className="flex-shrink-0 p-0"
          >
            {avatarCluster}
          </button>
        ) : (
          <Link href={`/u/${event.actor.username}`} className="flex-shrink-0">
            {avatarCluster}
          </Link>
        )}

        <FeedTextLines context={context} time={timeAgo} className="flex-1 min-w-0" />
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
