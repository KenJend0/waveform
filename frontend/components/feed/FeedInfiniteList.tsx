'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { FeedEvent, getMyFeed } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedCardReviewCreated from './cards/FeedCardReviewCreated';
import FeedCardAlbumSaved from './cards/FeedCardAlbumSaved';
import FeedCardUserFollowed from './cards/FeedCardUserFollowed';
import FeedCardReviewLiked from './cards/FeedCardReviewLiked';
import FeedCardCommentCreated from './cards/FeedCardCommentCreated';
import FeedCardUnratedListen from './cards/FeedCardUnratedListen';
import FeedCardCommentReply from './cards/FeedCardCommentReply';
import FeedCardTrackReviewCreated from './cards/FeedCardTrackReviewCreated';
import FeedCardTrackReviewLiked from './cards/FeedCardTrackReviewLiked';
import FeedCardTrackCommentCreated from './cards/FeedCardTrackCommentCreated';
import { ActorLink } from './cards/FeedActorLink';
import { showToast } from '@/components/Toast';

interface FeedInfiniteListProps {
  initialEvents: FeedEvent[];
  initialCursor: string | null;
  currentUserId?: string;
}

type SavedFeedState = {
  scrollY?: number;
  events?: FeedEvent[];
  cursor?: string | null;
  hasMore?: boolean;
};

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
    case 'COMMENT_REPLY':
      return `reply-${event.id}`;
    case 'USER_FOLLOWED':
      return `follow-${event.actor.id}-${event.followee?.id}`;
    case 'ALBUM_SAVED':
      return `saved-${event.actor.id}-${event.album?.id}`;
    case 'TRACK_REVIEW_CREATED':
      return `track-review-${event.actor.id}-${event.entry_id}`;
    default:
      return event.id;
  }
}

/** Stable key for "same calendar day", used to keep like-grouping scoped to one day. */
function getCalendarDayKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Instagram-style time buckets for the section headers — coarser than a per-day split. */
function getDateBucket(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays <= 7) return '7 derniers jours';
  if (diffDays <= 30) return '30 derniers jours';
  return 'Antérieur';
}

// ── Groupage des likes consécutifs ──────────────────────────────────────────

type LikeGroup = {
  type: 'LIKE_GROUP';
  id: string;
  actor: FeedEvent['actor'];
  created_at: string;
  items: Array<{ title: string; href: string; isMyEntry: boolean }>;
};

type RenderItem = FeedEvent | LikeGroup;

// The "critique" card (REVIEW_CREATED/TRACK_REVIEW_CREATED with text) straddles
// its top border with a label — two of them back to back need extra clearance
// so the lower card's label doesn't cut into the upper card's border.
function isCritiqueCard(item: RenderItem): boolean {
  if (item.type === 'LIKE_GROUP') return false;
  return (item.type === 'REVIEW_CREATED' || item.type === 'TRACK_REVIEW_CREATED') && !!item.review_excerpt;
}

function groupEvents(events: FeedEvent[], currentUserId?: string): RenderItem[] {
  const result: RenderItem[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];
    const isLike = event.type === 'REVIEW_LIKED' || event.type === 'TRACK_REVIEW_LIKED';

    if (!isLike) {
      result.push(event);
      i++;
      continue;
    }

    const startIdx = i;
    const items: Array<{ title: string; href: string; isMyEntry: boolean }> = [];

    while (
      i < events.length &&
      (events[i].type === 'REVIEW_LIKED' || events[i].type === 'TRACK_REVIEW_LIKED') &&
      events[i].actor.id === event.actor.id &&
      getCalendarDayKey(events[i].created_at) === getCalendarDayKey(event.created_at)
    ) {
      const e = events[i];
      const title = e.type === 'TRACK_REVIEW_LIKED'
        ? (e.track?.title ?? e.album?.title ?? '–')
        : (e.album?.title ?? '–');
      const href = e.type === 'REVIEW_LIKED'
        ? (e.liked_entry_id ? `/diary/${e.liked_entry_id}` : `/albums/${e.album?.id ?? ''}`)
        : (e.liked_entry_id ? `/track-diary/${e.liked_entry_id}` : '#');
      const isMyEntry = e.entry_owner_id === currentUserId;
      items.push({ title, href, isMyEntry });
      i++;
    }

    if (items.length < 2) {
      result.push(events[startIdx]);
    } else {
      result.push({ type: 'LIKE_GROUP', id: event.id, actor: event.actor, created_at: event.created_at, items });
    }
  }

  return result;
}

function LikeGroupCard({ group, currentUserId }: { group: LikeGroup; currentUserId?: string }) {
  const timeAgo = getTimeAgo(group.created_at);
  const isMe = currentUserId === group.actor.id;
  const total = group.items.length;
  const myCount = group.items.filter(i => i.isMyEntry).length;

  const action = isMe
    ? `Tu as aimé ${total} écoutes`
    : myCount === total
      ? `a aimé ${total} de tes écoutes`
      : myCount === 0
        ? `a aimé ${total} écoutes`
        : `a aimé ${total} écoutes dont ${myCount} des tiennes`;

  return (
    <div className="relative flex items-center gap-3 px-3 py-2">
      <UserAvatar userId={group.actor.id} src={group.actor.avatar_url} size={32} />
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 text-label text-text-tertiary leading-relaxed">
        {isMe ? (
          <span>{action}</span>
        ) : (
          <>
            <ActorLink username={group.actor.username} />
            <span>{action}</span>
          </>
        )}
        <span className="font-sans not-italic text-text-disabled" suppressHydrationWarning>{'· '}{timeAgo}</span>
        {group.items.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="inline-flex items-center gap-1.5 font-display italic text-sm text-text-warm bg-paper-hi border border-border rounded-full px-2.5 py-0.5 leading-none hover:border-accent transition-colors duration-150"
          >
            <Heart size={9} className="text-like fill-like flex-shrink-0" />
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  );
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
  if (event.type === 'COMMENT_REPLY') {
    return (
      <FeedCardCommentReply
        event={event as typeof event & { type: 'COMMENT_REPLY' }}
      />
    );
  }
  if (event.type === 'TRACK_REVIEW_CREATED') {
    return (
      <FeedCardTrackReviewCreated
        event={event as typeof event & { type: 'TRACK_REVIEW_CREATED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'TRACK_REVIEW_LIKED') {
    return (
      <FeedCardTrackReviewLiked
        event={event as typeof event & { type: 'TRACK_REVIEW_LIKED' }}
        currentUserId={currentUserId}
      />
    );
  }
  if (event.type === 'TRACK_COMMENT_CREATED') {
    return (
      <FeedCardTrackCommentCreated
        event={event as typeof event & { type: 'TRACK_COMMENT_CREATED' }}
        currentUserId={currentUserId}
      />
    );
  }
  return null;
}

const FEED_SCROLL_KEY = 'feed_scroll_state';

function getFeedScrollKey(currentUserId?: string) {
  return currentUserId ? `${FEED_SCROLL_KEY}:${currentUserId}` : FEED_SCROLL_KEY;
}

function isSavedFeedState(value: unknown): value is SavedFeedState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as SavedFeedState;
  if (candidate.scrollY !== undefined && typeof candidate.scrollY !== 'number') return false;
  if (candidate.cursor !== undefined && candidate.cursor !== null && typeof candidate.cursor !== 'string') return false;
  if (candidate.hasMore !== undefined && typeof candidate.hasMore !== 'boolean') return false;
  if (candidate.events !== undefined && !Array.isArray(candidate.events)) return false;

  return true;
}

function getSavedFeedState(storageKey: string): SavedFeedState | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (!isSavedFeedState(parsed)) {
      sessionStorage.removeItem(storageKey);
      return null;
    }

    return parsed;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

export default function FeedInfiniteList({ initialEvents, initialCursor, currentUserId }: FeedInfiniteListProps) {
  const storageKey = getFeedScrollKey(currentUserId);

  // Lazy init: restore from sessionStorage on back-navigation, else use server props
  const [restoredState] = useState(() => getSavedFeedState(storageKey));

  const [events, setEvents] = useState<FeedEvent[]>(restoredState?.events ?? initialEvents);
  const [cursor, setCursor] = useState<string | null>(restoredState?.cursor ?? initialCursor);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(restoredState?.hasMore ?? initialEvents.length >= 20);
  const observerTarget = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const eventsRef = useRef<FeedEvent[]>(restoredState?.events ?? initialEvents);
  const cursorRef = useRef<string | null>(restoredState?.cursor ?? initialCursor);
  const hasMoreRef = useRef<boolean>(restoredState?.hasMore ?? initialEvents.length >= 20);

  // Keep refs in sync to avoid stale closures in the callback
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Restore scroll position after back-navigation and clear saved state
  useEffect(() => {
    sessionStorage.removeItem(FEED_SCROLL_KEY);

    if (restoredState) {
      sessionStorage.removeItem(storageKey);
      const target = restoredState.scrollY ?? 0;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: target });
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save feed state when navigating to a diary entry
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname.startsWith('/diary/') || url.pathname.startsWith('/track-diary/')) {
        sessionStorage.setItem(storageKey, JSON.stringify({
          scrollY: window.scrollY,
          events: eventsRef.current,
          cursor: cursorRef.current,
          hasMore: hasMoreRef.current,
        }));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const result = await getMyFeed({
        limit: 20,
        cursor: cursorRef.current,
      });

      if (result.success && result.events.length > 0) {
        // Deduplicate against the latest events snapshot
        const dedupMap = new Set(eventsRef.current.map(getDedupKey));
        const newEvents = result.events.filter((e) => !dedupMap.has(getDedupKey(e)));

        setEvents((prev) => {
          const merged = [...prev, ...newEvents];
          eventsRef.current = merged;
          return merged;
        });
        setCursor(result.nextCursor ?? null);
        setHasMore(result.events.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more events:", error);
      showToast("Erreur lors du chargement du fil", "error");
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

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

  const renderItems = groupEvents(events, currentUserId);

  return (
    <div className="pb-20" onClick={handleContainerClick}>
      <div>
        {renderItems.map((item, index) => {
          const dateLabel = getDateBucket(item.created_at);
          const prevItem = index > 0 ? renderItems[index - 1] : null;
          const prevDateLabel = prevItem ? getDateBucket(prevItem.created_at) : null;
          const showDateSeparator = dateLabel !== prevDateLabel;
          const needsClearance = !!prevItem && isCritiqueCard(item) && isCritiqueCard(prevItem);

          return (
            <div key={item.id}>
              {showDateSeparator && (
                <div className={index > 0 ? 'mt-6 mb-2' : 'mb-2'}>
                  <span className="font-display italic text-[19px] text-accent leading-none">{dateLabel}</span>
                </div>
              )}
              <div className={index > 0 && !showDateSeparator ? (needsClearance ? 'mt-2' : 'mt-0.5') : ''}>
                {item.type === 'LIKE_GROUP'
                  ? <LikeGroupCard group={item} currentUserId={currentUserId} />
                  : renderEvent(item, currentUserId)
                }
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div ref={observerTarget} className="py-8 text-center">
          {loading && (
            <p className="text-meta text-text-disabled">...</p>
          )}
        </div>
      )}

      {!hasMore && events.length > 0 && (
        <div className="py-12 text-center">
          <div className="w-8 h-px bg-border mx-auto mb-4" />
          <p className="text-meta text-text-disabled">Fin du fil</p>
        </div>
      )}
    </div>
  );
}

