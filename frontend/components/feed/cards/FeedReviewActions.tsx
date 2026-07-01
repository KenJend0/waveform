'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import { toggleDiaryLike } from '@/app/actions/diary';
import { toggleTrackDiaryLike } from '@/app/actions/track-diary';
import { showToast } from '@/components/ui/Toast';

interface FeedReviewActionsProps {
  entryId?: string;
  entryHref: string;
  type: 'album' | 'track';
  currentUserId?: string;
  isLiked?: boolean;
  likesCount?: number;
  commentsCount?: number;
  time?: string;
}

export function FeedReviewActions({
  entryId,
  entryHref,
  type,
  currentUserId,
  isLiked = false,
  likesCount = 0,
  commentsCount = 0,
  time,
}: FeedReviewActionsProps) {
  const [liked, setLiked] = useState(isLiked);
  const [count, setCount] = useState(likesCount);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLiked(isLiked);
    setCount(likesCount);
  }, [entryId, isLiked, likesCount]);

  const handleLike = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!currentUserId) {
      showToast("Connecte-toi pour aimer cette critique", "error");
      return;
    }
    if (!entryId || pending) return;

    const previousLiked = liked;
    const previousCount = count;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setCount(nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1));
    setPending(true);

    try {
      if (type === 'track') {
        await toggleTrackDiaryLike(entryId);
      } else {
        await toggleDiaryLike(entryId);
      }
    } catch {
      setLiked(previousLiked);
      setCount(previousCount);
      showToast("Impossible d'aimer cette critique", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-1.5 ml-11 pr-14 flex items-center text-[12px] leading-none text-text-tertiary">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleLike}
          disabled={pending}
          aria-label={liked ? "Retirer le j'aime" : "Aimer la critique"}
          className="inline-flex items-center gap-1.5 hover:text-like disabled:opacity-50 transition-colors duration-150"
        >
          <Heart size={13} strokeWidth={1.8} className={liked ? 'fill-like text-like' : ''} />
          {count > 0 && <span>{count}</span>}
        </button>

        <Link
          href={`${entryHref}#comments`}
          onClick={(event) => event.stopPropagation()}
          aria-label="Repondre a la critique"
          className="inline-flex items-center gap-1.5 hover:text-accent transition-colors duration-150"
        >
          <MessageCircle size={13} strokeWidth={1.8} />
          {(commentsCount ?? 0) > 0 && <span>{commentsCount}</span>}
        </Link>
      </div>

      {time && (
        <span className="ml-2.5 flex-shrink-0 text-text-disabled" suppressHydrationWarning>
          · {time}
        </span>
      )}
    </div>
  );
}
