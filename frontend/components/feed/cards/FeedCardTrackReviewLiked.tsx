'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { getTrackEntryLikes } from '@/app/actions/feed';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';
import { buildInteractionContext } from './feedInteractionContext';

interface Props {
  event: FeedEvent & { type: 'TRACK_REVIEW_LIKED' };
  currentUserId?: string;
}

export default function FeedCardTrackReviewLiked({ event, currentUserId }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;
  const track = event.track;
  const entryHref = event.liked_entry_id ? `/track-diary/${event.liked_entry_id}` : undefined;

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

  const title = track && (
    entryHref ? (
      <Link href={entryHref} className="hover:text-accent-deep transition-colors duration-150">
        {track.title}
      </Link>
    ) : (
      track.title
    )
  );

  return (
    <>
      <div className="relative flex items-center gap-3 px-3 py-2">
        <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="like" />

        <FeedTextLines context={context} title={title} titleText={track?.title} time={timeAgo} className="flex-1 min-w-0" />

        <FeedRightCluster
          coverUrl={track?.cover_url}
          coverHref={entryHref}
          coverAlt={track?.title}
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
            ? () => getTrackEntryLikes(event.liked_entry_id!)
            : undefined
          }
        />
      )}
    </>
  );
}
