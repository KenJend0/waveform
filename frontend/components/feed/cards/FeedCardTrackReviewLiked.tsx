'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;
  const track = event.track;
  const entryHref = event.liked_entry_id ? `/track-diary/${event.liked_entry_id}` : undefined;
  const canOpenActors = Boolean(isAggregate && event.liked_entry_id);

  const handleCardNavigation = (target: EventTarget | null) => {
    if (!entryHref) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;
    router.push(entryHref);
  };

  const avatarCluster = (
    <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="like" />
  );

  const context = buildInteractionContext({
    currentUserId,
    actor: event.actor,
    verb: 'aimé',
    isAggregate,
    actors: event.actors,
    actorsCount: event.actors_count,
    onShowMore: needsFetch ? () => setSheetOpen(true) : undefined,
    entryOwnerId: event.entry_owner_id,
    targetHasReview: event.target_has_review,
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
      <div
        className={`relative flex items-center gap-3 px-3 py-2 ${entryHref ? 'cursor-pointer' : ''}`}
        onClick={(e) => handleCardNavigation(e.target)}
        onKeyDown={(e) => {
          if (entryHref && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleCardNavigation(e.target);
          }
        }}
        role={entryHref ? 'link' : undefined}
        tabIndex={entryHref ? 0 : undefined}
        data-feed-nav-href={entryHref}
      >
        {canOpenActors ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSheetOpen(true);
            }}
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
