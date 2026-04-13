'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';

interface FeedCardAlbumSavedProps {
  event: FeedEvent & { type: 'ALBUM_SAVED' };
  currentUserId?: string;
}

export default function FeedCardAlbumSaved({
  event,
  currentUserId,
}: FeedCardAlbumSavedProps) {
  const timeAgo = getTimeAgo(event.created_at);

  return (
    <div className="w-full relative border border-border rounded-[12px] py-5 px-6">
      <time className="absolute top-4 right-6 text-[12px] text-text-disabled">
        {timeAgo}
      </time>

      {/* Contexte â€” avatar + nom */}
      <div className="mb-3 flex items-center gap-2 pr-16 text-[12px] text-text-tertiary">
        <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={18} />
        {currentUserId === event.actor.id ? (
          <span>Tu as ajouté à ta liste</span>
        ) : (
          <>
            <Link
              href={`/u/${event.actor.username}`}
              className="text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              {event.actor.username}
            </Link>
            <span>·</span>
            <span>a ajouté à sa liste</span>
          </>
        )}
      </div>

      {/* Ligne compacte — cover + titre */}
      {event.album && (
        <Link
          href={`/albums/${event.album.id}`}
          className="flex gap-4 items-center min-w-0"
        >
          {event.album.cover_url && (
            <Image
              src={event.album.cover_url}
              alt={event.album.title}
              width={56}
              height={56}
              className="w-14 h-14 object-cover shrink-0 rounded-[8px]"
            />
          )}
          <h3 className="text-[16px] font-medium text-text-primary line-clamp-2 leading-snug min-w-0">
            {event.album.title}
          </h3>
        </Link>
      )}
    </div>
  );
}

