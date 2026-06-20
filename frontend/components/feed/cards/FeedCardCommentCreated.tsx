'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getCommentActors } from '@/app/actions/feed';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';
import { buildInteractionContext } from './feedInteractionContext';

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
  const entryHref = event.entry_id ? `/diary/${event.entry_id}` : (event.album ? `/albums/${event.album.id}` : null);

  const context = buildInteractionContext({
    currentUserId,
    actor: event.actor,
    verb: 'commenté',
    isAggregate,
    actors: event.actors,
    actorsCount: event.actors_count,
    onShowMore: needsFetch ? () => setSheetOpen(true) : undefined,
    entryOwnerId: event.entry_owner_id,
    alsoActed: event.current_user_also_commented,
  });

  const title = event.album && (
    <Link href={entryHref ?? `/albums/${event.album.id}`} className="hover:text-accent-deep transition-colors duration-150">
      {event.album.title}
    </Link>
  );

  return (
    <>
      <div className="relative flex items-center gap-3 px-3 py-2">
        <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="comment" />

        <FeedTextLines context={context} title={title} titleText={event.album?.title} time={timeAgo} className="flex-1 min-w-0" />

        <FeedRightCluster
          coverUrl={event.album?.cover_url}
          coverHref={entryHref}
          coverAlt={event.album?.title}
        />
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
