'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
// import { useState } from 'react';
// import { Heart, MessageCircle } from 'lucide-react';
import { FeedEvent } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
// import { toggleTrackDiaryLike } from '@/app/actions/track-diary';
// import { showToast } from '@/components/Toast';
import { ActorLink } from './FeedActorLink';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedInlineReviewExcerpt, formatReviewExcerpt } from './FeedReviewExcerpt';
import { FeedReviewActions } from './FeedReviewActions';
import { FeedTextLines } from './FeedTextLines';

interface Props {
  event: FeedEvent & { type: 'TRACK_REVIEW_CREATED' };
  currentUserId?: string;
}

export default function FeedCardTrackReviewCreated({ event, currentUserId }: Props) {
  const timeAgo = getTimeAgo(event.created_at);
  const hasWords = !!event.review_excerpt;
  const router = useRouter();

  // Like/répondre désactivés temporairement sur cette carte — voir BOITE_IDEE.md.
  // const [isLiked, setIsLiked] = useState(event.is_liked ?? false);
  // const [likesCount, setLikesCount] = useState(event.likes_count ?? 0);
  // const [liking, setLiking] = useState(false);
  //
  // const handleLike = async (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   if (!currentUserId) { showToast('Connecte-toi pour aimer cette revue', 'error'); return; }
  //   if (liking || !event.entry_id) return;
  //   const prev = isLiked;
  //   setIsLiked(!prev);
  //   setLikesCount(!prev ? likesCount + 1 : Math.max(0, likesCount - 1));
  //   setLiking(true);
  //   try {
  //     await toggleTrackDiaryLike(event.entry_id);
  //   } catch {
  //     setIsLiked(prev);
  //     setLikesCount(prev ? likesCount + 1 : Math.max(0, likesCount - 1));
  //   } finally {
  //     setLiking(false);
  //   }
  // };

  const track = event.track;
  const trackHref = track ? `/tracks/${track.id}` : undefined;
  const entryHref = event.entry_id ? `/track-diary/${event.entry_id}` : trackHref;
  const coverUrl = track?.cover_url ?? event.album?.cover_url ?? null;

  const handleCardNavigation = (target: EventTarget | null) => {
    if (!entryHref) return;
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a, button')) return;
    router.push(entryHref);
  };

  const context = currentUserId === event.actor.id ? (
    <span>{hasWords ? 'Tu as écrit une critique' : 'Tu as noté'}</span>
  ) : (
    <>
      <ActorLink username={event.actor.username} />
      <span>{hasWords ? ' a écrit une critique' : ' a noté un titre'}</span>
    </>
  );

  const title = track && entryHref && (
    <Link href={entryHref} className="hover:text-accent-deep transition-colors duration-150">
      {track.title}
    </Link>
  );

  const artist = track?.artist_name && (
    track.artist_name
  );
  const reviewExcerpt = formatReviewExcerpt(event.review_excerpt);
  const excerptLine = reviewExcerpt && (
    <FeedInlineReviewExcerpt text={event.review_excerpt} />
  );

  const textBlock = (
    <FeedTextLines
      context={context}
      title={title}
      titleText={track?.title}
      artist={hasWords ? excerptLine : artist}
      artistText={hasWords ? reviewExcerpt ?? undefined : track?.artist_name ?? undefined}
      time={hasWords ? '' : timeAgo}
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
        data-feed-nav-href={entryHref}
      >
        <Link href={`/u/${event.actor.username}`} className="flex-shrink-0">
          <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={32} />
        </Link>
        {textBlock}
        <FeedRightCluster
          rating={event.rating}
          coverUrl={coverUrl}
          coverHref={entryHref}
          coverAlt={track?.title}
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
      data-feed-nav-href={entryHref}
    >
      <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-background font-display italic text-[12px] leading-none text-accent">
        critique
      </span>

      <div className="flex items-center gap-3">
        <Link href={`/u/${event.actor.username}`} className="flex-shrink-0">
          <UserAvatar userId={event.actor.id} src={event.actor.avatar_url} size={32} />
        </Link>
        {textBlock}
        <FeedRightCluster
          rating={event.rating}
          coverUrl={coverUrl}
          coverHref={entryHref}
          coverAlt={track?.title}
        />
      </div>

      {entryHref && (
        <FeedReviewActions
          entryId={event.entry_id}
          entryHref={entryHref}
          type="track"
          currentUserId={currentUserId}
          isLiked={event.is_liked}
          likesCount={event.likes_count}
          commentsCount={event.comments_count}
          time={timeAgo}
        />
      )}

      {/* Actions like/répondre retirées pour le moment — la carte entière navigue déjà vers
          la critique complète (like + réponse y restent possibles). Voir BOITE_IDEE.md pour
          une réintroduction plus subtile.
      <div className="h-px bg-rule opacity-70 my-3" />
      <div className="flex items-center gap-6">
        <button
          onClick={handleLike}
          disabled={liking}
          className="flex items-center gap-2 text-text-tertiary hover:text-like transition-colors duration-150 disabled:opacity-50"
        >
          <Heart size={16} className={isLiked ? 'fill-like text-like' : ''} />
          <span className="text-label">{likesCount > 0 ? likesCount : ''} J'aime</span>
        </button>
        {event.entry_id && (
          <Link
            href={`/track-diary/${event.entry_id}`}
            className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors duration-150"
          >
            <MessageCircle size={16} />
            <span className="text-label">Répondre</span>
          </Link>
        )}
      </div>
      */}
    </div>
  );
}
