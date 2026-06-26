'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FeedEvent } from '@/app/actions/feed';
import { getTrackCommentActors } from '@/app/actions/feed';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedActorsBottomSheet from '@/components/feed/FeedActorsBottomSheet';
import { FeedAvatarCluster } from './FeedAvatarCluster';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedTextLines } from './FeedTextLines';
import { buildInteractionContext } from './feedInteractionContext';

interface Props {
  event: FeedEvent & { type: 'TRACK_COMMENT_CREATED' };
  currentUserId?: string;
}

export default function FeedCardTrackCommentCreated({ event, currentUserId }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const timeAgo = getTimeAgo(event.created_at);
  const isAggregate = event.actors_count && event.actors_count > 1 && event.actors;
  const needsFetch = isAggregate && event.actors_count! > event.actors!.length;
  const track = event.track;
  const entryHref = event.entry_id
    ? `/track-diary/${event.entry_id}${event.is_reply && event.comment_id ? `?reply=${event.comment_id}` : ''}`
    : undefined;
  const canOpenActors = Boolean(isAggregate && event.entry_id);

  const handleCardNavigation = (target: EventTarget | null) => {
    if (!entryHref) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;
    router.push(entryHref);
  };

  const avatarCluster = (
    <FeedAvatarCluster isAggregate={isAggregate} actor={event.actor} actors={event.actors} glyph="comment" />
  );

  const context = event.is_reply ? (
    <>
      <Link href={`/u/${event.actor.username}`} className="font-medium text-text-secondary hover:text-accent-deep transition-colors duration-150">
        {event.actor.username}
      </Link>
      <span>{' a répondu à ton commentaire'}</span>
    </>
  ) : buildInteractionContext({
      currentUserId,
      actor: event.actor,
      verb: 'commenté',
      isAggregate,
      actors: event.actors,
      actorsCount: event.actors_count,
      onShowMore: needsFetch ? () => setSheetOpen(true) : undefined,
      entryOwnerId: event.entry_owner_id,
      alsoActed: event.current_user_also_commented,
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

      {isAggregate && event.entry_id && (
        <FeedActorsBottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Commentaires"
          knownActors={event.actors!}
          totalCount={event.actors_count!}
          fetchActors={needsFetch
            ? () => getTrackCommentActors(event.entry_id!)
            : undefined
          }
        />
      )}
    </>
  );
}
