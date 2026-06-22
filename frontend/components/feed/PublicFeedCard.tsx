'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import type { PublicFeedEntry } from '@/app/actions/feed';
import { ActorLink } from './cards/FeedActorLink';
import { FeedRightCluster } from './cards/FeedRightCluster';
import { FeedTextLines } from './cards/FeedTextLines';

export default function PublicFeedCard({ entry }: { entry: PublicFeedEntry }) {
  const timeAgo = getTimeAgo(entry.created_at);
  const hasWords = !!entry.review_body;
  const router = useRouter();

  const albumHref = `/albums/${entry.album.id}`;
  const entryHref = `/diary/${entry.id}`;
  const verb = entry.rating != null ? 'noté' : 'écouté';

  const handleCardNavigation = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;

    router.push(entryHref);
  };

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

  const textBlock = (
    <FeedTextLines
      context={context}
      title={title}
      titleText={entry.album.title}
      artist={entry.album.artist_name}
      artistText={entry.album.artist_name}
      time={timeAgo}
      className="flex-1 min-w-0"
    />
  );

  if (!hasWords) {
    return (
      <div
        className="relative flex items-center gap-3 px-3 py-2 cursor-pointer"
        onClick={(e) => handleCardNavigation(e.target)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardNavigation(e.target);
          }
        }}
        role="link"
        tabIndex={0}
      >
        <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={32} />
        {textBlock}
        <FeedRightCluster
          rating={entry.rating}
          coverUrl={entry.album.cover_url}
          coverHref={albumHref}
          coverAlt={entry.album.title}
        />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-card border border-accent px-3 pt-3 pb-2 cursor-pointer"
      onClick={(e) => handleCardNavigation(e.target)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardNavigation(e.target);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-background font-display italic text-[12px] leading-none text-accent">
        critique
      </span>

      <div className="flex items-center gap-3">
        <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={32} />
        {textBlock}
        <FeedRightCluster
          rating={entry.rating}
          coverUrl={entry.album.cover_url}
          coverHref={albumHref}
          coverAlt={entry.album.title}
        />
      </div>
    </div>
  );
}
