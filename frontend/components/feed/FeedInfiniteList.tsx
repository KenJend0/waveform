'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FeedEvent, getMyFeed } from '@/app/actions/feed';
import FeedCardReviewCreated from './cards/FeedCardReviewCreated';
import FeedCardAlbumSaved from './cards/FeedCardAlbumSaved';
import FeedCardUserFollowed from './cards/FeedCardUserFollowed';
import FeedCardReviewLiked from './cards/FeedCardReviewLiked';
import FeedCardCommentCreated from './cards/FeedCardCommentCreated';
import FeedCardUnratedListen from './cards/FeedCardUnratedListen';

interface FeedInfiniteListProps {
  initialEvents: FeedEvent[];
  currentUserId?: string;
}

/**
 * Deduplication key generator for feed events
 * Prevents duplicate display of similar events
 */
function getDedupKey(event: FeedEvent): string {
  if (event._dedup_key) return event._dedup_key;
  
  // Default dedup keys by type
  switch (event.type) {
    case 'REVIEW_CREATED':
      return `review-${event.actor.id}-${event.entry_id}`;
    case 'UNRATED_LISTEN':
      return `listen-${event.actor.id}-${event.entry_id}`;
    case 'REVIEW_LIKED':
      return `like-${event.actor.id}-${event.liked_entry_id}`;
    case 'COMMENT_CREATED':
      return `comment-${event.actor.id}-${event.entry_id}`;
    case 'USER_FOLLOWED':
      return `follow-${event.actor.id}-${event.followee?.id}`;
    case 'ALBUM_SAVED':
      return `saved-${event.actor.id}-${event.album?.id}`;
    default:
      return event.id;
  }
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

function renderEvent(event: FeedEvent, currentUserId?: string) {
  if (event.type === 'REVIEW_CREATED') {
    return (
      <FeedCardReviewCreated
        event={event as typeof event & { type: 'REVIEW_CREATED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'UNRATED_LISTEN') {
    return (
      <FeedCardUnratedListen
        event={event as typeof event & { type: 'UNRATED_LISTEN' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'ALBUM_SAVED') {
    return (
      <FeedCardAlbumSaved
        event={event as typeof event & { type: 'ALBUM_SAVED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'USER_FOLLOWED') {
    return (
      <FeedCardUserFollowed
        event={event as typeof event & { type: 'USER_FOLLOWED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'REVIEW_LIKED') {
    return (
      <FeedCardReviewLiked
        event={event as typeof event & { type: 'REVIEW_LIKED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'COMMENT_CREATED') {
    return (
      <FeedCardCommentCreated
        event={event as typeof event & { type: 'COMMENT_CREATED' }}
        currentUserId={currentUserId}
      />
    );
  }
  return null;
}

export default function FeedInfiniteList({ initialEvents, currentUserId }: FeedInfiniteListProps) {
  const [events, setEvents] = useState<FeedEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialEvents.length >= 20);
  const observerTarget = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const result = await getMyFeed({
        limit: 20,
        offset: events.length
      });

      if (result.success && result.events.length > 0) {
        // Deduplicate before adding
        const dedupMap = new Set(events.map(getDedupKey));
        const newEvents = result.events.filter(e => !dedupMap.has(getDedupKey(e)));
        
        setEvents(prev => [...prev, ...newEvents]);
        setHasMore(result.events.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more events:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, events.length, events]);

  useEffect(() => {
    // Avoid firing loadMore immediately during hydration (can cause duplicate fetch)
    const mountTimer = setTimeout(() => {
      mountedRef.current = true;
    }, 300);

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && mountedRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      clearTimeout(mountTimer);
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMore, hasMore, loading]);

  return (
    <div className="pb-20">
      <div>
        {events.map((event, index) => {
          const dateLabel = getDateLabel(event.created_at);
          const prevDateLabel = index > 0 ? getDateLabel(events[index - 1].created_at) : null;
          const showDateSeparator = dateLabel !== prevDateLabel;

          return (
            <div key={event.id}>
              {showDateSeparator && (
                <div className={index > 0 ? 'mt-10 mb-6' : 'mb-6'}>
                  <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-[0.08em]">
                    {dateLabel}
                  </span>
                </div>
              )}
              <div className={index > 0 && !showDateSeparator ? 'mt-8' : ''}>
                {renderEvent(event, currentUserId)}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div ref={observerTarget} className="py-8 text-center">
          {loading && (
            <p className="text-[14px] text-text-disabled">...</p>
          )}
        </div>
      )}

      {!hasMore && events.length > 0 && (
        <div className="py-12 text-center">
          <div className="w-8 h-px bg-border mx-auto mb-4" />
          <p className="text-[14px] text-text-disabled">Fin du fil</p>
        </div>
      )}
    </div>
  );
}

