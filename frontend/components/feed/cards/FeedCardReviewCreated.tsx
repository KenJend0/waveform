'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { FeedEvent } from '@/app/actions/feed';
import { toggleDiaryLike } from '@/app/actions/diary';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';

interface FeedCardReviewCreatedProps {
  event: FeedEvent & { type: 'REVIEW_CREATED' };
  currentUserId?: string;
}

export default function FeedCardReviewCreated({
  event,
  currentUserId,
}: FeedCardReviewCreatedProps) {
  const timeAgo = getTimeAgo(event.created_at);
  const hasWords = !!event.review_excerpt;

  const [isLiked, setIsLiked] = useState(event.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(event.likes_count ?? 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking || !event.entry_id) return;
    setLiking(true);
    try {
      await toggleDiaryLike(event.entry_id);
      const newLiked = !isLiked;
      const newCount = newLiked ? likesCount + 1 : likesCount - 1;
      setIsLiked(newLiked);
      setLikesCount(newCount);
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      setLiking(false);
    }
  };

  const entryHref = event.entry_id
    ? `/diary/${event.entry_id}`
    : `/albums/${event.album?.id}`;

  return (
    <div className="w-full relative rounded-[12px] px-6 py-6 bg-background-tertiary">
      <time className="absolute top-5 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>

      {/* Contexte — avatar + nom */}
      <div className="mb-4 flex items-center gap-2 pr-16 text-[12px] text-text-tertiary">
        <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
        {currentUserId === event.actor.id ? (
          <span>{hasWords ? 'Tu as écrit quelques mots' : 'Tu as écouté'}</span>
        ) : (
          <>
            <Link
              href={`/u/${event.actor.username}`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              {event.actor.display_name || event.actor.username}
            </Link>
            <span>·</span>
            <span>{hasWords ? 'a écrit quelques mots' : 'a écouté'}</span>
          </>
        )}
      </div>

      {/* En-tête compact — cover + titre/artiste */}
      <div className="flex gap-4 items-center mb-4">
        {event.album?.cover_url && (
          <Link href={entryHref} className="shrink-0">
            <Image
              src={event.album.cover_url}
              alt={event.album.title}
              width={80}
              height={80}
              className="w-20 h-20 object-cover rounded-[10px]"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          {event.album && (
            <Link href={entryHref}>
              <h3 className="text-[16px] font-medium text-text-primary line-clamp-2 leading-snug">
                {event.album.title}
              </h3>
            </Link>
          )}
          {event.rating && (
            <div className="text-[#8E6F5E] font-medium text-[12px] mt-1">
              {Math.round(event.rating)}/10
            </div>
          )}
        </div>
      </div>

      {/* Extrait de review — pleine largeur */}
      {hasWords && (
        <Link href={entryHref} className="block mb-4">
          <p className="text-[14px] leading-[1.8] text-text-secondary italic line-clamp-3">
            &laquo;&thinsp;{event.review_excerpt}&thinsp;&raquo;
          </p>
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6">
        <button
          onClick={handleLike}
          disabled={liking}
          className="flex items-center gap-2 text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150 disabled:opacity-50"
        >
          <Heart
            size={16}
            className={isLiked ? 'fill-[#C86C6C] text-[#C86C6C]' : ''}
          />
          <span className="text-[12px]">{likesCount}</span>
        </button>
        {event.entry_id && (
          <Link
            href={`/diary/${event.entry_id}`}
            className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors duration-150"
          >
            <MessageCircle size={16} />
            <span className="text-[12px]">{event.comments_count ?? 0}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

