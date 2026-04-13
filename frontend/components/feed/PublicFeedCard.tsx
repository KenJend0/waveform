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
    <div className="w-full relative rounded-[12px] px-6 py-6 bg-background-tertiary">
      <time className="absolute top-5 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>

      {/* Author context */}
      <div className="mb-4 flex items-center gap-2 pr-16 text-[12px] text-text-tertiary">
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
              className="w-20 h-20 object-cover rounded-[10px]"
            />
          ) : (
            <div className="w-20 h-20 rounded-[10px] bg-background-secondary" />
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/albums/${entry.album.id}`}>
            <h3 className="text-[16px] font-medium text-text-primary line-clamp-2 leading-snug">
              {entry.album.title}
            </h3>
          </Link>
          {entry.album.artist_name && (
            <p className="text-[12px] text-text-tertiary mt-0.5 truncate">{entry.album.artist_name}</p>
          )}
          {entry.rating !== null && (
            <div className="text-[#8E6F5E] font-medium text-[12px] mt-1">
              {entry.rating}/10
            </div>
          )}
        </div>
      </div>

      {/* Review excerpt */}
      {hasWords && (
        <div>
          <p className={`text-[14px] leading-[1.8] text-text-secondary italic ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
            &laquo;&thinsp;{entry.review_body}&thinsp;&raquo;
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
