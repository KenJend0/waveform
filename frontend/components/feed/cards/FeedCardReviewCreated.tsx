'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
// import { Heart, MessageCircle } from 'lucide-react';
import { FeedEvent } from '@/app/actions/feed';
// import { toggleDiaryLike } from '@/app/actions/diary';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
// import { showToast } from '@/components/Toast';
import { ActorLink } from './FeedActorLink';
import { FeedRightCluster } from './FeedRightCluster';
import { FeedInlineReviewExcerpt, formatReviewExcerpt } from './FeedReviewExcerpt';
import { FeedReviewActions } from './FeedReviewActions';
import { FeedTextLines } from './FeedTextLines';

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
  const router = useRouter();

  // Like/répondre désactivés temporairement sur cette carte — voir BOITE_IDEE.md.
  // La carte entière reste cliquable vers la critique complète, où ces actions existent toujours.
  // const [isLiked, setIsLiked] = useState(event.is_liked ?? false);
  // const [likesCount, setLikesCount] = useState(event.likes_count ?? 0);
  // const [liking, setLiking] = useState(false);
  //
  // useEffect(() => {
  //   setIsLiked(event.is_liked ?? false);
  //   setLikesCount(event.likes_count ?? 0);
  // }, [event.entry_id, event.is_liked, event.likes_count]);
  //
  // const handleLike = async (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   if (!currentUserId) {
  //     showToast("Connecte-toi pour aimer cette revue", "error");
  //     return;
  //   }
  //   if (liking || !event.entry_id) {
  //     return;
  //   }
  //
  //   const prevLiked = isLiked;
  //   const prevCount = likesCount;
  //   const newLiked = !prevLiked;
  //   setIsLiked(newLiked);
  //   setLikesCount(newLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
  //   setLiking(true);
  //
  //   try {
  //     await toggleDiaryLike(event.entry_id);
  //   } catch (err) {
  //     console.error('Like error:', err);
  //     setIsLiked(prevLiked);
  //     setLikesCount(prevCount);
  //     showToast("Impossible d'aimer cette revue", "error");
  //   } finally {
  //     setLiking(false);
  //   }
  // };

  const entryHref = event.entry_id
    ? `/diary/${event.entry_id}`
    : `/albums/${event.album?.id}`;
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
      <span>{hasWords ? ' a écrit une critique' : ' a noté un album'}</span>
    </>
  );

  const title = event.album && (
    <Link href={entryHref} className="hover:text-accent-deep transition-colors duration-150">
      {event.album.title}
    </Link>
  );

  const artist = event.album?.artist_name && (
    event.album.artist_name
  );
  const reviewExcerpt = formatReviewExcerpt(event.review_excerpt);
  const excerptLine = reviewExcerpt && (
    <FeedInlineReviewExcerpt text={event.review_excerpt} />
  );

  const textBlock = (
    <FeedTextLines
      context={context}
      title={title}
      titleText={event.album?.title}
      artist={hasWords ? excerptLine : artist}
      artistText={hasWords ? reviewExcerpt ?? undefined : event.album?.artist_name ?? undefined}
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
          coverUrl={event.album?.cover_url}
          coverHref={entryHref}
          coverAlt={event.album?.title}
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
          coverUrl={event.album?.cover_url}
          coverHref={entryHref}
          coverAlt={event.album?.title}
        />
      </div>

      <FeedReviewActions
        entryId={event.entry_id}
        entryHref={entryHref}
        type="album"
        currentUserId={currentUserId}
        isLiked={event.is_liked}
        likesCount={event.likes_count}
        commentsCount={event.comments_count}
        time={timeAgo}
      />

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
            href={`/diary/${event.entry_id}`}
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
