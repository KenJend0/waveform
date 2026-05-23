'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import type { PublicFeedEntry } from '@/app/actions/feed';

const REVIEW_LONG_THRESHOLD = 120;

export default function PublicFeedCard({ entry }: { entry: PublicFeedEntry }) {
  const timeAgo = getTimeAgo(entry.created_at);
  const hasWords = !!entry.review_body;
  const isLong = hasWords && entry.review_body!.length > REVIEW_LONG_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full relative rounded-card px-6 py-6 bg-background-tertiary overflow-hidden">
      <div className="absolute left-0 top-6 bottom-6 w-0.5 bg-accent opacity-40 rounded-r-full" />
      <time className="absolute top-5 right-6 text-label text-text-disabled">
        {timeAgo}
      </time>

      {/* Author context */}
      <div className="mb-4 flex items-center gap-2 pr-16 text-label text-text-tertiary">
        <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={18} />
        <Link
          href={`/u/${entry.author.username}`}
          className="text-text-secondary hover:text-text-primary transition-colors duration-150"
        >
          {entry.author.username}
        </Link>
        <span>·</span>
        <span>{hasWords ? 'a écrit quelques mots' : 'a écouté'}</span>
      </div>

      {/* Cover + title/rating */}
      <div className="flex gap-4 items-center mb-4">
        <Link href={`/albums/${entry.album.id}`} className="shrink-0">
          {entry.album.cover_url ? (
            <Image
              src={entry.album.cover_url}
              alt={entry.album.title}
              width={80}
              height={80}
              className="w-20 h-20 object-cover rounded-cover"
              unoptimized
            />
          ) : (
            <div className="w-20 h-20 rounded-cover bg-background-secondary" />
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/albums/${entry.album.id}`}>
            <p className="font-display font-normal text-body text-text-warm line-clamp-2 leading-snug">
              {entry.album.title}
            </p>
          </Link>
          {entry.album.artist_name && (
            <p className="text-sm text-text-tertiary mt-0.5 truncate">{entry.album.artist_name}</p>
          )}
          {entry.rating !== null && (
            <span className="inline-flex items-baseline gap-0.5 mt-2 bg-paper-hi border border-accent rounded-badge px-1.5 py-0.5 text-accent font-display italic text-[15px] leading-none">
              {entry.rating}
              <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
            </span>
          )}
        </div>
      </div>

      {/* Review excerpt */}
      {hasWords && (
        <div>
          <p className={`italic text-meta leading-relaxed text-text-secondary max-w-[540px] ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
            &laquo;&thinsp;{entry.review_body}&thinsp;&raquo;
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-label text-text-tertiary hover:text-text-primary transition-colors duration-150 pl-3.5"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
