'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import type { PublicFeedEntry } from '@/app/actions/feed';
import { ActorLink } from './cards/FeedActorLink';
import { FeedRightCluster } from './cards/FeedRightCluster';
import { FeedTextLines } from './cards/FeedTextLines';

const REVIEW_LONG_THRESHOLD = 120;

export default function PublicFeedCard({ entry }: { entry: PublicFeedEntry }) {
  const timeAgo = getTimeAgo(entry.created_at);
  const hasWords = !!entry.review_body;
  const isLong = hasWords && entry.review_body!.length > REVIEW_LONG_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  const albumHref = `/albums/${entry.album.id}`;
  const verb = entry.rating != null ? 'noté' : 'écouté';

  const context = (
    <>
      <ActorLink username={entry.author.username} />
      <span>{` a ${verb}`}</span>
    </>
  );

  const title = (
    <Link href={albumHref} className="hover:text-accent-deep transition-colors duration-150">
      {entry.album.title}
    </Link>
  );

  return (
    <div className="relative rounded-card px-3 py-2 bg-background-tertiary">
      <div className="flex items-center gap-3">
        <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={32} />

        <FeedTextLines
          context={context}
          title={title}
          titleText={entry.album.title}
          artist={entry.album.artist_name}
          artistText={entry.album.artist_name}
          time={timeAgo}
          className="flex-1 min-w-0"
        />

        <FeedRightCluster
          rating={entry.rating}
          coverUrl={entry.album.cover_url}
          coverHref={albumHref}
          coverAlt={entry.album.title}
        />
      </div>

      {hasWords && (
        <div className="mt-2 pl-[44px]">
          <p className={`italic text-meta leading-relaxed text-text-secondary ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
            &laquo;&thinsp;{entry.review_body}&thinsp;&raquo;
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-label text-text-tertiary hover:text-text-primary transition-colors duration-150"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
