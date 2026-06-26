'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Disc3, Heart } from 'lucide-react';
import { FeedEvent, FeedScope, getMyFeed, markActivitySeen } from '@/app/actions/feed';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import { CoverImage } from '@/components/CoverImage';
import { useAuth } from '@/lib/AuthContext';
import { getTimeAgo } from '@/lib/utils/formatDate';
import FeedCardReviewCreated from './cards/FeedCardReviewCreated';
import FeedCardUserFollowed from './cards/FeedCardUserFollowed';
import FeedCardReviewLiked from './cards/FeedCardReviewLiked';
import FeedCardCommentCreated from './cards/FeedCardCommentCreated';
import FeedCardUnratedListen from './cards/FeedCardUnratedListen';
import FeedCardCommentReply from './cards/FeedCardCommentReply';
import FeedCardTrackReviewCreated from './cards/FeedCardTrackReviewCreated';
import FeedCardTrackReviewLiked from './cards/FeedCardTrackReviewLiked';
import FeedCardTrackCommentCreated from './cards/FeedCardTrackCommentCreated';
import { ActorLink } from './cards/FeedActorLink';
import { FeedAvatarGlyph } from './cards/FeedAvatarGlyph';
import { showToast } from '@/components/Toast';

interface FeedInfiniteListProps {
  initialNotifications: FeedEvent[];
  initialNotificationsCursor: string | null;
  initialActivity: FeedEvent[];
  initialActivityCursor: string | null;
  currentUserId?: string;
  lastSeenActivityAt?: string | null;
}

type SavedFeedState = {
  scrollY?: number;
  scope?: FeedTab;
  notifications?: FeedEvent[];
  notificationsCursor?: string | null;
  notificationsHasMore?: boolean;
  activity?: FeedEvent[];
  activityCursor?: string | null;
  activityHasMore?: boolean;
};

type FeedTab = Extract<FeedScope, 'notifications' | 'activity'>;

type FeedBucketState = {
  events: FeedEvent[];
  cursor: string | null;
  hasMore: boolean;
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
  items: LikeGroupItem[];
};

type ListenGroupItem = {
  id: string;
  kind: 'album' | 'track';
  title: string;
  subtitle?: string;
  albumTitle?: string;
  href: string;
  coverUrl?: string | null;
  rating?: number | null;
};

type LikeGroupItem = ListenGroupItem & {
  isMyEntry: boolean;
};

type ListenGroup = {
  type: 'LISTEN_GROUP';
  id: string;
  actor: FeedEvent['actor'];
  created_at: string;
  items: ListenGroupItem[];
};

type RenderItem = FeedEvent | LikeGroup | ListenGroup;

const FEED_TABS: Array<{ id: FeedTab; label: string }> = [
  { id: 'notifications', label: 'Pour moi' },
  { id: 'activity', label: 'Réseau' },
];

function getTabEmptyLabel(tab: FeedTab): string {
  if (tab === 'notifications') return 'Aucune notification dans les événements chargés.';
  return 'Aucune activité réseau dans les événements chargés.';
}

function countEventsAfter(events: FeedEvent[], lastSeenAt?: string | null): number {
  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  if (!Number.isFinite(lastSeenTime)) return 0;
  return events.filter((event) => new Date(event.created_at).getTime() > lastSeenTime).length;
}

// The "critique" card (REVIEW_CREATED/TRACK_REVIEW_CREATED with text) straddles
// its top border with a label — two of them back to back need extra clearance
// so the lower card's label doesn't cut into the upper card's border.
function isCritiqueCard(item: RenderItem): boolean {
  if (item.type === 'LIKE_GROUP' || item.type === 'LISTEN_GROUP') return false;
  return (item.type === 'REVIEW_CREATED' || item.type === 'TRACK_REVIEW_CREATED') && !!item.review_excerpt;
}

function isCompactableListen(event: FeedEvent): boolean {
  if (event.type === 'UNRATED_LISTEN') return true;
  if (event.type === 'REVIEW_CREATED' || event.type === 'TRACK_REVIEW_CREATED') {
    return !event.review_excerpt;
  }
  return false;
}

function toListenGroupItem(event: FeedEvent): ListenGroupItem {
  if (event.type === 'TRACK_REVIEW_CREATED') {
    const track = event.track;
    return {
      id: event.id,
      kind: 'track',
      title: track?.title ?? 'Écoute',
      subtitle: track?.artist_name ?? track?.album_title,
      albumTitle: track?.album_title,
      href: event.entry_id ? `/track-diary/${event.entry_id}` : (track?.id ? `/tracks/${track.id}` : '#'),
      coverUrl: track?.cover_url ?? event.album?.cover_url,
      rating: event.rating,
    };
  }

  return {
    id: event.id,
    kind: 'album',
    title: event.album?.title ?? 'Écoute',
    subtitle: event.album?.artist_name,
    href: event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album?.id ?? ''}`,
    coverUrl: event.album?.cover_url,
    rating: event.rating,
  };
}

function formatPreviewTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? '';
  if (titles.length === 2) return `${titles[0]} et ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} et ${titles[titles.length - 1]}`;
}

function groupEvents(events: FeedEvent[], currentUserId?: string): RenderItem[] {
  const MS_3H = 3 * 60 * 60 * 1000;
  const result: RenderItem[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];
    const isListen = isCompactableListen(event);

    if (isListen) {
      const startIdx = i;
      const items: ListenGroupItem[] = [];
      const anchor = new Date(event.created_at).getTime();

      while (
        i < events.length &&
        isCompactableListen(events[i]) &&
        events[i].actor.id === event.actor.id &&
        getCalendarDayKey(events[i].created_at) === getCalendarDayKey(event.created_at) &&
        anchor - new Date(events[i].created_at).getTime() <= MS_3H
      ) {
        items.push(toListenGroupItem(events[i]));
        i++;
      }

      if (items.length < 3) {
        result.push(...events.slice(startIdx, i));
      } else {
        result.push({
          type: 'LISTEN_GROUP',
          id: `listen-group-${event.actor.id}-${event.created_at}-${items.length}`,
          actor: event.actor,
          created_at: event.created_at,
          items,
        });
      }
      continue;
    }

    const isLike = event.type === 'REVIEW_LIKED' || event.type === 'TRACK_REVIEW_LIKED';

    if (!isLike) {
      result.push(event);
      i++;
      continue;
    }

    const startIdx = i;
    const items: LikeGroupItem[] = [];

    while (
      i < events.length &&
      (events[i].type === 'REVIEW_LIKED' || events[i].type === 'TRACK_REVIEW_LIKED') &&
      events[i].actor.id === event.actor.id &&
      getCalendarDayKey(events[i].created_at) === getCalendarDayKey(event.created_at) &&
      new Date(event.created_at).getTime() - new Date(events[i].created_at).getTime() <= MS_3H
    ) {
      const e = events[i];
      const isTrack = e.type === 'TRACK_REVIEW_LIKED';
      const title = isTrack
        ? (e.track?.title ?? e.album?.title ?? 'Écoute')
        : (e.album?.title ?? 'Écoute');
      const href = !isTrack
        ? (e.liked_entry_id ? `/diary/${e.liked_entry_id}` : `/albums/${e.album?.id ?? ''}`)
        : (e.liked_entry_id ? `/track-diary/${e.liked_entry_id}` : '#');
      const isMyEntry = e.entry_owner_id === currentUserId;
      items.push({
        id: e.id,
        kind: isTrack ? 'track' : 'album',
        title,
        subtitle: isTrack ? (e.track?.artist_name ?? e.track?.album_title) : e.album?.artist_name,
        albumTitle: e.track?.album_title,
        href,
        coverUrl: isTrack ? (e.track?.cover_url ?? e.album?.cover_url) : e.album?.cover_url,
        rating: e.rating,
        isMyEntry,
      });
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

function ListenGroupCover({ src, size, iconSize }: { src?: string | null; size: number; iconSize: number }) {
  const placeholder = (
    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
      <Disc3 size={iconSize} className="text-text-disabled" />
    </div>
  );

  if (!src) return placeholder;

  return (
    <CoverImage
      src={src}
      alt=""
      width={size}
      height={size}
      className="w-full h-full object-cover"
      placeholder={placeholder}
    />
  );
}

function ListenGroupCoverStack({ items }: { items: ListenGroupItem[] }) {
  const shown = items.slice(0, 3);

  return (
    <div className="relative w-11 h-[52px] flex-shrink-0 ml-auto" aria-hidden="true">
      {shown.map((item, index) => (
        <div
          key={item.id}
          className="absolute w-11 h-11 rounded-cover-sm overflow-hidden bg-background-secondary border border-background"
          style={{
            right: 0,
            top: index * 4,
            zIndex: shown.length - index,
          }}
        >
          <ListenGroupCover src={item.coverUrl} size={44} iconSize={16} />
          {index > 0 && (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(28,28,28,${0.05 * index})` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating?: number | null }) {
  if (rating == null) return null;

  return (
    <span className="inline-flex items-baseline gap-0.5 bg-paper-hi border border-accent rounded-badge px-1.5 py-0.5 text-accent font-display italic text-[13px] leading-none flex-shrink-0">
      {Math.round(rating)}
      <span className="font-sans not-italic text-[7.5px] tracking-[0.16em] uppercase opacity-70">/10</span>
    </span>
  );
}

function ListenGroupCard({ group, currentUserId }: { group: ListenGroup; currentUserId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(group.created_at);
  const isMe = currentUserId === group.actor.id;
  const total = group.items.length;
  const ratedCount = group.items.filter(item => item.rating != null).length;
  const trackItems = group.items.filter(item => item.kind === 'track');
  const albumTitleCounts = new Map<string, number>();
  for (const item of trackItems) {
    if (!item.albumTitle) continue;
    albumTitleCounts.set(item.albumTitle, (albumTitleCounts.get(item.albumTitle) ?? 0) + 1);
  }
  const dominantAlbum = [...albumTitleCounts.entries()].find(([, count]) => count >= 3 && count === trackItems.length)?.[0];
  const previewTitles = formatPreviewTitles(group.items.slice(0, 3).map(item => item.title));

  const action = dominantAlbum
    ? `a noté ${total} titres de ${dominantAlbum} dont`
    : ratedCount === total
      ? `a noté ${total} écoutes dont`
      : ratedCount === 0
        ? `a ajouté ${total} écoutes dont`
        : `a ajouté ${total} écoutes dont`;

  const toggleFromSummary = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a')) return;
    setExpanded(prev => !prev);
  };

  return (
    <div className="relative px-3 py-2">
      <div className="flex items-center gap-3">
        <Link href={`/u/${group.actor.username}`} className="flex-shrink-0">
          <UserAvatar userId={group.actor.id} src={group.actor.avatar_url} size={32} />
        </Link>

        <div
          role="button"
          tabIndex={0}
          onClick={(e) => toggleFromSummary(e.target)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded(prev => !prev);
            }
          }}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-baseline gap-1 text-label text-text-tertiary leading-tight">
            <p className="truncate min-w-0">
              {isMe ? (
                <span>{action.replace('a ', 'Tu as ')}</span>
              ) : (
                <>
                  <ActorLink username={group.actor.username} />
                  <span>{` ${action}`}</span>
                </>
              )}
            </p>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 text-meta leading-snug">
            <p className="truncate min-w-0 font-display italic text-text-warm">{previewTitles}</p>
            <span className="flex-shrink-0 font-sans not-italic text-text-disabled" suppressHydrationWarning>{'· '}{timeAgo}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? 'Replier les écoutes' : 'Déplier les écoutes'}
          className="w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-accent hover:bg-paper-hi transition-colors duration-150"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? 'Replier les écoutes' : 'Déplier les écoutes'}
          className="flex-shrink-0 p-0"
        >
          <ListenGroupCoverStack items={group.items} />
        </button>
      </div>

      {expanded && (
        <div className="mt-2 ml-11 border-l border-rule pl-3 space-y-1.5">
          {group.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2 py-1 rounded-sm hover:text-accent-deep transition-colors duration-150"
            >
              <div className="w-8 h-8 rounded-cover-sm overflow-hidden bg-background-secondary flex-shrink-0">
                <ListenGroupCover src={item.coverUrl} size={32} iconSize={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display italic text-sm text-text-warm leading-snug truncate">{item.title}</p>
                {item.subtitle && <p className="text-[12px] text-text-tertiary leading-tight truncate">{item.subtitle}</p>}
              </div>
              <RatingBadge rating={item.rating} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function LikeGroupCard({ group, currentUserId }: { group: LikeGroup; currentUserId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(group.created_at);
  const isMe = currentUserId === group.actor.id;
  const total = group.items.length;
  const myCount = group.items.filter(i => i.isMyEntry).length;
  const previewTitles = formatPreviewTitles(group.items.slice(0, 3).map(item => item.title));

  const action = isMe
    ? `Tu as aimé ${total} écoutes dont`
    : myCount === total
      ? `a aimé ${total} de tes écoutes dont`
      : myCount === 0
        ? `a aimé ${total} écoutes dont`
        : `a aimé ${total} écoutes dont ${myCount} des tiennes`;

  const toggleFromSummary = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest('a')) return;
    setExpanded(prev => !prev);
  };

  return (
    <div className="relative px-3 py-2">
      <div className="flex items-center gap-3">
        <Link href={`/u/${group.actor.username}`} className="flex-shrink-0">
          <FeedAvatarGlyph userId={group.actor.id} avatarUrl={group.actor.avatar_url} size={32} glyph="like" />
        </Link>

        <div
          role="button"
          tabIndex={0}
          onClick={(e) => toggleFromSummary(e.target)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded(prev => !prev);
            }
          }}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-baseline gap-1 text-label text-text-tertiary leading-tight">
            <p className="truncate min-w-0">
              {isMe ? (
                <span>{action}</span>
              ) : (
                <>
                  <ActorLink username={group.actor.username} />
                  <span>{` ${action}`}</span>
                </>
              )}
            </p>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 text-meta leading-snug">
            <p className="truncate min-w-0 font-display italic text-text-warm">{previewTitles}</p>
            <span className="flex-shrink-0 font-sans not-italic text-text-disabled" suppressHydrationWarning>{'· '}{timeAgo}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? 'Replier les écoutes aimées' : 'Déplier les écoutes aimées'}
          className="w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-like hover:bg-paper-hi transition-colors duration-150"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? 'Replier les écoutes aimées' : 'Déplier les écoutes aimées'}
          className="flex-shrink-0 p-0"
        >
          <ListenGroupCoverStack items={group.items} />
        </button>
      </div>

      {expanded && (
        <div className="mt-2 ml-11 border-l border-rule pl-3 space-y-1.5">
          {group.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2 py-1 rounded-sm hover:text-accent-deep transition-colors duration-150"
            >
              <div className="w-8 h-8 rounded-cover-sm overflow-hidden bg-background-secondary flex-shrink-0">
                <ListenGroupCover src={item.coverUrl} size={32} iconSize={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display italic text-sm text-text-warm leading-snug truncate">{item.title}</p>
                {item.subtitle && <p className="text-[12px] text-text-tertiary leading-tight truncate">{item.subtitle}</p>}
              </div>
              <RatingBadge rating={item.rating} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedNewSeparator({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-rule" />
      <span className="rounded-full border border-rule bg-paper-hi px-3 py-1 font-display italic text-[14px] leading-none text-accent">
        {label}
      </span>
      <div className="h-px flex-1 bg-rule" />
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
  if (candidate.scope !== undefined && candidate.scope !== 'notifications' && candidate.scope !== 'activity') return false;
  if (candidate.notifications !== undefined && !Array.isArray(candidate.notifications)) return false;
  if (candidate.notificationsCursor !== undefined && candidate.notificationsCursor !== null && typeof candidate.notificationsCursor !== 'string') return false;
  if (candidate.notificationsHasMore !== undefined && typeof candidate.notificationsHasMore !== 'boolean') return false;
  if (candidate.activity !== undefined && !Array.isArray(candidate.activity)) return false;
  if (candidate.activityCursor !== undefined && candidate.activityCursor !== null && typeof candidate.activityCursor !== 'string') return false;
  if (candidate.activityHasMore !== undefined && typeof candidate.activityHasMore !== 'boolean') return false;

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

export default function FeedInfiniteList({
  initialNotifications,
  initialNotificationsCursor,
  initialActivity,
  initialActivityCursor,
  currentUserId,
  lastSeenActivityAt,
}: FeedInfiniteListProps) {
  const { refreshUnseenActivity } = useAuth();
  const storageKey = getFeedScrollKey(currentUserId);

  // Lazy init: restore from sessionStorage on back-navigation, else use server props
  const [restoredState] = useState(() => getSavedFeedState(storageKey));
  const initialLastSeenRef = useRef(lastSeenActivityAt);

  const [buckets, setBuckets] = useState<Record<FeedTab, FeedBucketState>>(() => ({
    notifications: {
      events: restoredState?.notifications ?? initialNotifications,
      cursor: restoredState?.notificationsCursor ?? initialNotificationsCursor,
      hasMore: restoredState?.notificationsHasMore ?? Boolean(initialNotificationsCursor),
    },
    activity: {
      events: restoredState?.activity ?? initialActivity,
      cursor: restoredState?.activityCursor ?? initialActivityCursor,
      hasMore: restoredState?.activityHasMore ?? Boolean(initialActivityCursor),
    },
  }));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>(restoredState?.scope ?? 'notifications');
  const [seenUnreadTabs, setSeenUnreadTabs] = useState<Set<FeedTab>>(() => new Set());
  const observerTarget = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const bucketsRef = useRef(buckets);
  const activeTabRef = useRef<FeedTab>(restoredState?.scope ?? 'notifications');
  const markSeenInFlightRef = useRef(false);

  // Keep refs in sync to avoid stale closures in the callback
  useEffect(() => {
    bucketsRef.current = buckets;
  }, [buckets]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const unreadNotificationsCount = countEventsAfter(buckets.notifications.events, initialLastSeenRef.current);
  const unreadNetworkCount = countEventsAfter(buckets.activity.events, initialLastSeenRef.current);
  const unreadCounts: Record<FeedTab, number> = {
    notifications: unreadNotificationsCount,
    activity: unreadNetworkCount,
  };

  useEffect(() => {
    if (unreadCounts[activeTab] === 0 || seenUnreadTabs.has(activeTab)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextSeenTabs = new Set(seenUnreadTabs);
      nextSeenTabs.add(activeTab);
      setSeenUnreadTabs(nextSeenTabs);

      const unreadTabs = FEED_TABS
        .map((tab) => tab.id)
        .filter((tab) => unreadCounts[tab] > 0);
      const allUnreadTabsSeen = unreadTabs.length > 0 && unreadTabs.every((tab) => nextSeenTabs.has(tab));

      if (allUnreadTabsSeen && !markSeenInFlightRef.current) {
        markSeenInFlightRef.current = true;
        markActivitySeen()
          .then(() => refreshUnseenActivity())
          .catch(() => {
            markSeenInFlightRef.current = false;
          });
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeTab, refreshUnseenActivity, seenUnreadTabs, unreadNotificationsCount, unreadNetworkCount]);

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
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    const navElement = target.closest('[data-feed-nav-href]') as HTMLElement | null;
    const href = anchor?.href ?? navElement?.dataset.feedNavHref;
    if (!href) return;
    try {
      const url = new URL(href, window.location.origin);
      if (url.pathname.startsWith('/diary/') || url.pathname.startsWith('/track-diary/')) {
        sessionStorage.setItem(storageKey, JSON.stringify({
          scrollY: window.scrollY,
          scope: activeTabRef.current,
          notifications: bucketsRef.current.notifications.events,
          notificationsCursor: bucketsRef.current.notifications.cursor,
          notificationsHasMore: bucketsRef.current.notifications.hasMore,
          activity: bucketsRef.current.activity.events,
          activityCursor: bucketsRef.current.activity.cursor,
          activityHasMore: bucketsRef.current.activity.hasMore,
        }));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const loadMore = useCallback(async () => {
    const scope = activeTabRef.current;
    const bucket = bucketsRef.current[scope];
    if (loading || !bucket.hasMore) return;

    setLoading(true);
    try {
      const result = await getMyFeed({
        limit: 20,
        cursor: bucket.cursor,
        scope,
      });

      if (result.success) {
        // Deduplicate against the latest events snapshot for this tab
        const dedupMap = new Set(bucket.events.map(getDedupKey));
        const newEvents = result.events.filter((e) => !dedupMap.has(getDedupKey(e)));

        setBuckets((prev) => {
          const current = prev[scope];
          const merged = [...current.events, ...newEvents];
          const next = {
            ...prev,
            [scope]: {
              events: merged,
              cursor: result.nextCursor ?? null,
              hasMore: Boolean(result.nextCursor),
            },
          };
          bucketsRef.current = next;
          return next;
        });
      } else {
        setBuckets((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            hasMore: false,
          },
        }));
      }
    } catch (error) {
      console.error("Error loading more events:", error);
      showToast("Erreur lors du chargement du fil", "error");
      setBuckets((prev) => ({
        ...prev,
        [scope]: {
          ...prev[scope],
          hasMore: false,
        },
      }));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    // Avoid firing loadMore immediately during hydration (can cause duplicate fetch)
    const mountTimer = setTimeout(() => {
      mountedRef.current = true;
    }, 300);

    const observer = new IntersectionObserver(
      entries => {
        const activeBucket = bucketsRef.current[activeTabRef.current];
        if (entries[0].isIntersecting && activeBucket.hasMore && !loading && mountedRef.current) {
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
  }, [loadMore, loading, activeTab]);

  const activeBucket = buckets[activeTab];
  const renderItems = groupEvents(activeBucket.events, currentUserId);
  const lastSeenTime = initialLastSeenRef.current ? new Date(initialLastSeenRef.current).getTime() : null;
  const firstItemTime = renderItems.length > 0 ? new Date(renderItems[0].created_at).getTime() : null;
  const allItemsAreNew = lastSeenTime !== null && firstItemTime !== null && renderItems.every(item => new Date(item.created_at).getTime() > lastSeenTime);
  const showNewMarker = lastSeenTime !== null && Number.isFinite(lastSeenTime) && !allItemsAreNew;

  return (
    <div className="pb-20" onClick={handleContainerClick}>
      <div className="sticky top-0 z-20 -mx-3 mb-3 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-2 rounded-full border border-border bg-paper p-1">
          {FEED_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative rounded-full px-3 py-2 text-[13px] font-medium leading-none ${
                  active
                    ? 'bg-paper-hi text-accent-deep shadow-sm'
                    : 'text-text-tertiary'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {tab.label}
                  {unreadCounts[tab.id] > 0 && !seenUnreadTabs.has(tab.id) && (
                    <span className="min-w-4 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-paper-hi">
                      {unreadCounts[tab.id] > 9 ? '9+' : unreadCounts[tab.id]}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        {renderItems.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-meta text-text-disabled">{getTabEmptyLabel(activeTab)}</p>
          </div>
        )}

        {renderItems.map((item, index) => {
          const dateLabel = getDateBucket(item.created_at);
          const prevItem = index > 0 ? renderItems[index - 1] : null;
          const prevDateLabel = prevItem ? getDateBucket(prevItem.created_at) : null;
          const showDateSeparator = dateLabel !== prevDateLabel;
          const itemIsNew = showNewMarker && new Date(item.created_at).getTime() > lastSeenTime!;
          const prevItemIsNew = !!prevItem && showNewMarker && new Date(prevItem.created_at).getTime() > lastSeenTime!;
          const showNewSeparator = !itemIsNew && prevItemIsNew;
          const needsClearance = !!prevItem && isCritiqueCard(item) && isCritiqueCard(prevItem);
          const newSeparatorLabel = activeTab === 'notifications' ? 'Déjà vu' : 'Plus ancien';

          return (
            <div key={item.id}>
              {showNewSeparator && <FeedNewSeparator label={newSeparatorLabel} />}
              {showDateSeparator && (
                <div className={index > 0 ? 'mt-6 mb-2' : 'mb-2'}>
                  <span className="font-display italic text-[19px] text-accent leading-none">{dateLabel}</span>
                </div>
              )}
              <div className={index > 0 && !showDateSeparator ? (needsClearance ? 'mt-2' : 'mt-0.5') : ''}>
                {item.type === 'LIKE_GROUP'
                  ? <LikeGroupCard group={item} currentUserId={currentUserId} />
                  : item.type === 'LISTEN_GROUP'
                    ? <ListenGroupCard group={item} currentUserId={currentUserId} />
                  : renderEvent(item, currentUserId)
                }
              </div>
            </div>
          );
        })}
      </div>

      {activeBucket.hasMore && (
        <div ref={observerTarget} className="py-8 text-center">
          {loading && (
            <p className="text-meta text-text-disabled">...</p>
          )}
        </div>
      )}

      {!activeBucket.hasMore && activeBucket.events.length > 0 && (
        <div className="py-12 text-center">
          <div className="w-8 h-px bg-border mx-auto mb-4" />
          <p className="text-meta text-text-disabled">Fin du fil</p>
        </div>
      )}
    </div>
  );
}

