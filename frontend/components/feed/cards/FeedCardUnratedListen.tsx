'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';

interface FeedCardUnratedListenProps {
  event: FeedEvent & { type: 'UNRATED_LISTEN' };
  currentUserId?: string;
}

export default function FeedCardUnratedListen({
  event,
  currentUserId,
}: FeedCardUnratedListenProps) {
  const timeAgo = getTimeAgo(event.created_at);

  const entryHref = event.entry_id
    ? `/diary/${event.entry_id}`
    : `/albums/${event.album?.id}`;

  return (
    <div className="w-full relative rounded-[12px] px-6 py-6 bg-background-tertiary opacity-90">
      <time className="absolute top-5 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>

      {/* Contexte — avatar + nom */}
      <div className="mb-4 flex items-center gap-2 pr-16 text-[12px] text-text-tertiary">
        <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
        {currentUserId === event.actor.id ? (
          <span>Tu as écouté</span>
        ) : (
          <>
            <Link
              href={`/u/${event.actor.username}`}
              className="hover:text-text-primary transition-colors duration-150"
            >
              {event.actor.username}
            </Link>
            <span>·</span>
            <span>a écouté</span>
          </>
        )}
      </div>

      {/* En-tête compact — cover + titre/artiste */}
      <div className="flex gap-4 items-center">
        {event.album?.cover_url && (
          <Link href={entryHref} className="shrink-0">
            <Image
              src={event.album.cover_url}
              alt={event.album.title || 'album'}
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded-[8px]"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          {event.album && (
            <Link href={entryHref}>
              <h3 className="text-[14px] font-medium text-text-secondary line-clamp-2 leading-snug">
                {event.album.title}
              </h3>
            </Link>
          )}
        </div>
      </div>

      {/* Small note: journal entry exists but not rated */}
      <div className="mt-3 text-[11px] text-text-disabled italic">
        Inscrit dans le journal (sans note)
      </div>
    </div>
  );
}
