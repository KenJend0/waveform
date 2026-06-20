'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getEntryLikes } from '@/app/actions/diary';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';
import { buildInteractionContext } from './feedInteractionContext';

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
  const entryHref = event.liked_entry_id ? `/diary/${event.liked_entry_id}` : (event.album ? `/albums/${event.album.id}` : null);

  const context = buildInteractionContext({
    currentUserId,
    actor: event.actor,
    verb: 'aimé',
    isAggregate,
    actors: event.actors,
    actorsCount: event.actors_count,
    onShowMore: needsFetch ? () => setSheetOpen(true) : undefined,
    entryOwnerId: event.entry_owner_id,
  });

  const title = event.album && (
    <Link href={entryHref ?? `/albums/${event.album.id}`} className="hover:text-accent-deep transition-colors duration-150">
      {event.album.title}
    </Link>
  );

  return (
    <>
      <div className="relative flex items-center gap-3 px-3 py-2">
        <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="like" />

        <FeedTextLines context={context} title={title} titleText={event.album?.title} time={timeAgo} className="flex-1 min-w-0" />

        <FeedRightCluster
          coverUrl={event.album?.cover_url}
          coverHref={entryHref}
          coverAlt={event.album?.title}
        />
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
