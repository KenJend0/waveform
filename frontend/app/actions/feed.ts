'use server';

import { createSupabaseServer, createSupabaseAdmin, createSupabaseAnon } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/server';

/**
 * Frontend event types (MVP, no DB change)
 * Mapped from DB types: diary/follow/like/comment
 */
export type FeedEventType = 'REVIEW_CREATED' | 'UNRATED_LISTEN' | 'REVIEW_LIKED' | 'USER_FOLLOWED' | 'COMMENT_CREATED' | 'COMMENT_REPLY' | 'TRACK_REVIEW_CREATED' | 'TRACK_REVIEW_LIKED' | 'TRACK_COMMENT_CREATED';
export type FeedScope = 'all' | 'notifications' | 'activity';

export type FeedActor = {
  id: string;
  username: string;
  avatar_url: string | null;
};

/**
 * Feed event payload for frontend display
 */
export interface FeedEvent {
  id: string;
  type: FeedEventType;
  actor: FeedActor;
  followee?: FeedActor;
  album?: {
    id: string;
    title: string;
    cover_url: string | null;
    artist_id?: string;
    artist_name?: string;
  };
  rating?: number;
  review_excerpt?: string;
  review_is_long?: boolean;
  entry_id?: string; // For actions (like/comment)
  liked_entry_id?: string; // For REVIEW_LIKED to avoid confusion
  likes_count?: number; // For REVIEW_CREATED
  is_liked?: boolean; // For REVIEW_CREATED
  comments_count?: number; // For REVIEW_CREATED
  entry_owner_id?: string; // Owner of the liked/commented diary entry
  target_has_review?: boolean; // Whether the liked/commented entry has review text
  current_user_also_commented?: boolean; // For COMMENT_CREATED: current user has also commented on same entry
  comment_id?: string; // For COMMENT_REPLY: ID of the reply comment (used for deep-linking)
  is_reply?: boolean; // Comment event is a reply to the current user's comment
  track?: {
    id: string;
    title: string;
    album_id: string;
    album_title: string;
    cover_url: string | null;
    artist_id?: string;
    artist_name?: string;
  };
  created_at: string;
  _dedup_key?: string; // For client-side deduplication
  // Aggregation: set when multiple actors performed the same action on the same target
  actors?: FeedActor[];   // Up to 5 actors for display
  actors_count?: number;  // Real total (may exceed actors.length)
}

/**
 * Read-only: Get user's feed
 *
 * Returns events from:
 * - User's own actions
 * - Actions from followed users
 *
 * Enriches with necessary joins (profiles, albums, diary_entries)
 * Uses cursor-based pagination to avoid skips/duplicates on offset shift.
 */
export async function getMyFeed({
  limit = 20,
  cursor = null,
  scope = 'all',
}: {
  limit?: number;
  /** ISO timestamp of the last event seen — pass to fetch the next page */
  cursor?: string | null;
  scope?: FeedScope;
} = {}) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated', events: [], nextCursor: null };
    }

    const supabase = await createSupabaseServer();

    // Fetch blocked user IDs to exclude their events from the feed
    const { data: blockedRows } = await (supabase as any)
      .from('user_blocks')
      .select('blocked_id');
    const blockedIds = ((blockedRows ?? []) as Array<{ blocked_id: string }>).map((r) => r.blocked_id);

    // Feed is fan-out at write time, so we only read events where user_id = auth.uid()
    // No need to fetch followers or use .in() — all relevant events are already here

    const queryLimit = scope === 'all' ? limit : Math.max(limit * 5, 100);
    const maxBatches = scope === 'all' ? 1 : 5;
    const rawEvents: any[] = [];
    let scanCursor = cursor;
    let reachedEnd = false;

    for (let batch = 0; batch < maxBatches; batch++) {
      // Fetch feed_events for current user, with joins
      let query = (supabase as any)
      .from('feed_events')
      .select(
        `
        id,
        user_id,
        actor_id,
        followee_id,
        type,
        entry_id,
        album_id,
        comment_id,
        track_comment_id,
        payload,
        created_at,
        actor:profiles!actor_id (
          id,
          username,
          avatar_url
        ),
        followee:profiles!followee_id (
          id,
          username,
          avatar_url
        ),
        album:albums (
          id,
          title,
          cover_url,
          artist_id,
          artist:artists (
            name
          )
        ),
        entry:diary_entries (
          id,
          user_id,
          rating,
          review_body,
          album_id,
          likes_count,
          comments_count,
          album:albums (
            id,
            title,
            cover_url,
            artist_id,
            artist:artists (
              name
            )
          )
        ),
        track_comment:track_diary_comments!feed_events_track_comment_id_fkey (
          id,
          parent_comment_id,
          user_id
        )
      `
        )
      .eq('user_id', user.id)
      .neq('type', 'discover')
      .neq('actor_id', user.id) // Don't show own actions — user already knows what they did
      .order('created_at', { ascending: false })
      .limit(queryLimit);

      // Exclude events from blocked users
      if (blockedIds.length > 0) {
        query = query.not('actor_id', 'in', `(${blockedIds.join(',')})`);
      }

      // Cursor: only fetch events older than the last seen timestamp
      if (scanCursor) {
        query = query.lt('created_at', scanCursor);
      }

      const { data: batchEvents, error } = await query;

      if (error) {
        return { success: false, error: 'An error occurred', events: [], nextCursor: null };
      }

      if (!batchEvents || batchEvents.length === 0) {
        reachedEnd = true;
        break;
      }

      rawEvents.push(...batchEvents);
      scanCursor = batchEvents[batchEvents.length - 1].created_at;

      if (batchEvents.length < queryLimit) {
        reachedEnd = true;
        break;
      }
    }

    if (rawEvents.length === 0) {
      return { success: true, events: [], nextCursor: null };
    }

    // Only fetch which entries the current user has liked (small targeted query)
    const entryIds = (rawEvents || [])
      .filter((e: any) => e.entry_id)
      .map((e: any) => e.entry_id);

    const { data: likedData } = entryIds.length > 0
      ? await supabase
          .from('diary_likes')
          .select('entry_id')
          .in('entry_id', entryIds)
          .eq('user_id', user.id)
      : { data: [] };

    const likedEntryIds = new Set((likedData || []).map((l) => l.entry_id));

    const { data: statsData } = entryIds.length > 0
      ? await supabase
          .from('diary_entry_stats')
          .select('entry_id, likes_count, comments_count')
          .in('entry_id', entryIds)
      : { data: [] };

    const statsMap = new Map(
      (statsData || []).map((stats) => [
        stats.entry_id,
        {
          likes_count: stats.likes_count ?? 0,
          comments_count: stats.comments_count ?? 0,
        },
      ])
    );

    // Also fetch which entries the current user has commented on (for COMMENT_CREATED flag)
    const { data: commentedData } = entryIds.length > 0
      ? await supabase
          .from('diary_comments')
          .select('entry_id')
          .in('entry_id', entryIds)
          .eq('user_id', user.id)
      : { data: [] };

    const commentedEntryIds = new Set((commentedData || []).map((c) => c.entry_id));

    // Track diary entry stats (for TRACK_REVIEW_CREATED events)
    const trackEntryIds = (rawEvents || [])
      .filter((e: any) => e.type === 'track_diary_entry' && e.payload?.trackEntryId)
      .map((e: any) => e.payload.trackEntryId);

    const allTrackInteractionEntryIds = Array.from(new Set(
      (rawEvents || [])
        .filter((e: any) => ['track_diary_entry', 'track_like', 'track_comment'].includes(e.type) && e.payload?.trackEntryId)
        .map((e: any) => e.payload.trackEntryId)
    ));

    // Track entries commented on by others (for TRACK_COMMENT_CREATED "also commented" flag)
    const trackCommentEventEntryIds = (rawEvents || [])
      .filter((e: any) => e.type === 'track_comment' && e.payload?.trackEntryId)
      .map((e: any) => e.payload.trackEntryId);

    const [{ data: trackStatsData }, { data: trackLikedData }, { data: trackCommentedData }, { data: trackEntryReviewData }] = await Promise.all([
      trackEntryIds.length > 0
        ? (supabase as any).from('track_diary_entry_stats').select('entry_id, likes_count, comments_count').in('entry_id', trackEntryIds)
        : Promise.resolve({ data: [] }),
      trackEntryIds.length > 0
        ? (supabase as any).from('track_diary_likes').select('entry_id').in('entry_id', trackEntryIds).eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      trackCommentEventEntryIds.length > 0
        ? (supabase as any).from('track_diary_comments').select('entry_id').in('entry_id', trackCommentEventEntryIds).eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      allTrackInteractionEntryIds.length > 0
        ? (supabase as any).from('track_diary_entries').select('id, rating, review_body').in('id', allTrackInteractionEntryIds)
        : Promise.resolve({ data: [] }),
    ]);

    const trackStatsMap = new Map(
      ((trackStatsData || []) as Array<{ entry_id: string; likes_count: number | null; comments_count: number | null }>)
        .map((s) => [s.entry_id, s])
    );
    const trackLikedIds = new Set(((trackLikedData || []) as Array<{ entry_id: string }>).map((l) => l.entry_id));
    const trackCommentedEntryIds = new Set(((trackCommentedData || []) as Array<{ entry_id: string }>).map((c) => c.entry_id));
    const trackEntryMap = new Map(
      ((trackEntryReviewData || []) as Array<{ id: string; rating: number | null; review_body: string | null }>)
        .map((entry) => [entry.id, entry])
    );

    // Map DB events to frontend types
    const events: FeedEvent[] = (rawEvents || [])
      .map((raw: any) => {
        const mapped = mapFeedEvent(raw);
        // Attach fresh counts + is_liked for album reviews
        if (mapped && mapped.type === 'REVIEW_CREATED' && mapped.entry_id) {
          const stats = statsMap.get(mapped.entry_id);
          mapped.likes_count = stats?.likes_count ?? 0;
          mapped.comments_count = stats?.comments_count ?? 0;
          mapped.is_liked = likedEntryIds.has(mapped.entry_id);
        }
        // Attach fresh counts + is_liked for track reviews
        if (mapped && mapped.type === 'TRACK_REVIEW_CREATED' && mapped.entry_id) {
          const stats = trackStatsMap.get(mapped.entry_id);
          mapped.likes_count = stats?.likes_count ?? 0;
          mapped.comments_count = stats?.comments_count ?? 0;
          mapped.is_liked = trackLikedIds.has(mapped.entry_id);
        }
        if (mapped && (mapped.type === 'TRACK_REVIEW_LIKED' || mapped.type === 'TRACK_COMMENT_CREATED') && mapped.entry_id) {
          const trackEntry = trackEntryMap.get(mapped.entry_id);
          mapped.target_has_review = Boolean(String(trackEntry?.review_body ?? '').trim());
          if (mapped.type === 'TRACK_REVIEW_LIKED') {
            mapped.rating = trackEntry?.rating ?? undefined;
          }
          if (mapped.type === 'TRACK_COMMENT_CREATED' && raw.track_comment) {
            mapped.comment_id = mapped.comment_id ?? raw.track_comment.id ?? undefined;
            mapped.is_reply = mapped.is_reply || Boolean(raw.track_comment.parent_comment_id);
          }
        }
        // Attach "also commented" flag for comment events from other users
        if (mapped && mapped.type === 'COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
          mapped.current_user_also_commented = commentedEntryIds.has(mapped.entry_id);
        }
        if (mapped && mapped.type === 'TRACK_COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
          mapped.current_user_also_commented = trackCommentedEntryIds.has(mapped.entry_id);
        }
        return mapped;
      })
      .filter(Boolean) as FeedEvent[];

    const scopedEvents = events
      .filter((event) => eventMatchesScope(event, scope, user.id))
      .slice(0, limit);

    const aggregated = aggregateFeedEvents(scopedEvents, user.id);

    // Cursor for the next page: created_at of the oldest raw event scanned.
    // For scoped tabs, this prevents looping over events filtered out from the tab.
    const nextCursor = !reachedEnd && rawEvents.length > 0
      ? rawEvents[rawEvents.length - 1].created_at
      : null;

    return { success: true, events: aggregated, nextCursor };
  } catch (err) {
    console.error('getFeedEvents error:', err);
    return { success: false, error: 'An error occurred', events: [], nextCursor: null };
  }
}

/**
 * Collapses repeated notification events targeting the current user into
 * aggregated cards. Two conditions must both be met to aggregate:
 *   1. Consecutive — no other event type interrupts the group in the feed
 *   2. Within 24h — first and last event of the group are ≤ 24h apart
 *
 * Handles:
 *   - USER_FOLLOWED  (followee === currentUser)
 *   - REVIEW_LIKED / TRACK_REVIEW_LIKED (entry_owner === currentUser) — grouped per entry
 *   - COMMENT_CREATED / TRACK_COMMENT_CREATED (entry_owner === currentUser) — grouped per entry
 *
 * Single-actor events are left untouched.
 * Events are sorted desc by created_at; the aggregate inherits the most-recent
 * timestamp (first in group).
 */
function isNotificationFeedEvent(event: FeedEvent, currentUserId: string): boolean {
  if (event.type === 'USER_FOLLOWED') return event.followee?.id === currentUserId;
  if (event.type === 'COMMENT_REPLY') return true;
  if (event.type === 'REVIEW_LIKED' || event.type === 'TRACK_REVIEW_LIKED') {
    return event.entry_owner_id === currentUserId;
  }
  if (event.type === 'COMMENT_CREATED' || event.type === 'TRACK_COMMENT_CREATED') {
    if (event.is_reply) return true;
    return event.entry_owner_id === currentUserId;
  }
  return false;
}

function eventMatchesScope(event: FeedEvent, scope: FeedScope, currentUserId: string): boolean {
  if (scope === 'all') return true;
  const isNotification = isNotificationFeedEvent(event, currentUserId);
  return scope === 'notifications' ? isNotification : !isNotification;
}

function aggregateFeedEvents(events: FeedEvent[], currentUserId: string): FeedEvent[] {
  const MS_24H = 24 * 60 * 60 * 1000;
  const result: FeedEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const e = events[i];

    // USER_FOLLOWED targeting currentUser
    if (e.type === 'USER_FOLLOWED' && e.followee?.id === currentUserId && e.actor.id !== currentUserId) {
      const group = [e];
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'USER_FOLLOWED' &&
        events[j].followee?.id === currentUserId &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        group.push(events[j++]);
      }
      result.push(group.length > 1
        ? { ...e, actors: group.slice(0, 5).map(ev => ev.actor), actors_count: group.length, _dedup_key: `agg-follow-${currentUserId}` }
        : e
      );
      i = j;
      continue;
    }

    // REVIEW_LIKED targeting currentUser's entry — consecutive likes on the same entry
    if (e.type === 'REVIEW_LIKED' && e.entry_owner_id === currentUserId && e.liked_entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seenActors = new Set<string>([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'REVIEW_LIKED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].liked_entry_id === e.liked_entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seenActors.has(events[j].actor.id)) {
          seenActors.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(group.length > 1
        ? { ...e, actors: group.slice(0, 5).map(ev => ev.actor), actors_count: group.length, _dedup_key: `agg-like-${e.liked_entry_id}` }
        : e
      );
      i = j;
      continue;
    }

    // COMMENT_CREATED targeting currentUser's entry — consecutive comments on the same entry
    if (e.type === 'COMMENT_CREATED' && e.entry_owner_id === currentUserId && e.entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seenActors = new Set<string>([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'COMMENT_CREATED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].entry_id === e.entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seenActors.has(events[j].actor.id)) {
          seenActors.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(group.length > 1
        ? { ...e, actors: group.slice(0, 5).map(ev => ev.actor), actors_count: group.length, _dedup_key: `agg-comment-${e.entry_id}` }
        : e
      );
      i = j;
      continue;
    }

    // TRACK_REVIEW_LIKED targeting currentUser's entry — consecutive likes on the same track entry
    if (e.type === 'TRACK_REVIEW_LIKED' && e.entry_owner_id === currentUserId && e.liked_entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seenActors = new Set<string>([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'TRACK_REVIEW_LIKED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].liked_entry_id === e.liked_entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seenActors.has(events[j].actor.id)) {
          seenActors.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(group.length > 1
        ? { ...e, actors: group.slice(0, 5).map(ev => ev.actor), actors_count: group.length, _dedup_key: `agg-track-like-${e.liked_entry_id}` }
        : e
      );
      i = j;
      continue;
    }

    // TRACK_COMMENT_CREATED targeting currentUser's entry — consecutive comments on the same track entry
    if (e.type === 'TRACK_COMMENT_CREATED' && e.entry_owner_id === currentUserId && e.entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seenActors = new Set<string>([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'TRACK_COMMENT_CREATED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].entry_id === e.entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seenActors.has(events[j].actor.id)) {
          seenActors.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(group.length > 1
        ? { ...e, actors: group.slice(0, 5).map(ev => ev.actor), actors_count: group.length, _dedup_key: `agg-track-comment-${e.entry_id}` }
        : e
      );
      i = j;
      continue;
    }

    result.push(e);
    i++;
  }

  return result;
}

/**
 * Map DB event to frontend FeedEvent
 * Handles type mapping and data enrichment
 */
function mapFeedEvent(raw: any): FeedEvent | null {
  if (!raw.actor || !raw.actor.id) {
    return null; // Skip events with deleted actors
  }

  const baseEvent = {
    id: raw.id,
    actor: {
      id: raw.actor.id,
      username: raw.actor.username,
      avatar_url: raw.actor.avatar_url,
    },
    created_at: raw.created_at,
  };

  // Map types: diary_entry -> REVIEW_CREATED, follow -> USER_FOLLOWED, like -> REVIEW_LIKED
  switch (raw.type) {
    case 'diary':
    case 'diary_entry': {
      // Show BOTH rated reviews AND unrated listens — no silent filtering!
      if (!raw.entry) return null;

      // If has rating, it's a REVIEW_CREATED
      if (raw.entry.rating !== null) {
        return {
          ...baseEvent,
          type: 'REVIEW_CREATED',
          entry_id: raw.entry.id,
          album: raw.album ? {
            id: raw.album.id,
            title: raw.album.title,
            cover_url: raw.album.cover_url,
            artist_id: raw.album.artist_id ?? undefined,
            artist_name: raw.album.artist?.name ?? undefined,
          } : undefined,
          rating: raw.entry.rating,
          review_excerpt: raw.entry.review_body ?? undefined,
          review_is_long: (raw.entry.review_body?.length ?? 0) > 300,
        };
      } else {
        // No rating = UNRATED_LISTEN (user just logged the album, no opinion yet)
        return {
          ...baseEvent,
          type: 'UNRATED_LISTEN',
          entry_id: raw.entry.id,
          album: raw.album ? {
            id: raw.album.id,
            title: raw.album.title,
            cover_url: raw.album.cover_url,
            artist_id: raw.album.artist_id ?? undefined,
            artist_name: raw.album.artist?.name ?? undefined,
          } : undefined,
        };
      }
    }

    case 'follow':
      return {
        ...baseEvent,
        type: 'USER_FOLLOWED',
        followee: raw.followee ? {
          id: raw.followee.id,
          username: raw.followee.username,
          avatar_url: raw.followee.avatar_url,
        } : undefined,
      };

    case 'like': {
      // Simple: actor liked entry → album via entry
      const likeAlbum = raw.entry?.album || (raw.album ? { id: raw.album.id, title: raw.album.title, cover_url: raw.album.cover_url } : null);

      if (raw.entry && likeAlbum) {
        return {
          ...baseEvent,
          type: 'REVIEW_LIKED',
          liked_entry_id: raw.entry.id,
          entry_owner_id: raw.entry.user_id ?? undefined,
          rating: raw.entry.rating ?? undefined,
          target_has_review: Boolean(String(raw.entry.review_body ?? '').trim()),
          album: {
            id: likeAlbum.id,
            title: likeAlbum.title,
            cover_url: likeAlbum.cover_url,
            artist_id: likeAlbum.artist_id ?? raw.album?.artist_id ?? undefined,
            artist_name: likeAlbum.artist?.name ?? raw.album?.artist?.name ?? undefined,
          },
          _dedup_key: `like-${raw.actor.id}-${raw.entry.id}`,
        };
      }
      return null;
    }

    case 'comment': {
      // Simple: actor commented on entry → album via entry
      const commentAlbum = raw.entry?.album || (raw.album ? { id: raw.album.id, title: raw.album.title, cover_url: raw.album.cover_url } : null);

      if (raw.entry && commentAlbum) {
        if (raw.payload?.parentCommentId) {
          return {
            ...baseEvent,
            type: 'COMMENT_REPLY',
            entry_id: raw.entry.id,
            comment_id: raw.comment_id ?? undefined,
            album: {
              id: commentAlbum.id,
              title: commentAlbum.title,
              cover_url: commentAlbum.cover_url,
              artist_id: commentAlbum.artist_id ?? raw.album?.artist_id ?? undefined,
              artist_name: commentAlbum.artist?.name ?? raw.album?.artist?.name ?? undefined,
            },
            is_reply: true,
          };
        }

        return {
          ...baseEvent,
          type: 'COMMENT_CREATED',
          entry_id: raw.entry.id,
          entry_owner_id: raw.entry.user_id ?? undefined,
          target_has_review: Boolean(String(raw.entry.review_body ?? '').trim()),
          album: {
            id: commentAlbum.id,
            title: commentAlbum.title,
            cover_url: commentAlbum.cover_url,
            artist_id: commentAlbum.artist_id ?? raw.album?.artist_id ?? undefined,
            artist_name: commentAlbum.artist?.name ?? raw.album?.artist?.name ?? undefined,
          },
        };
      }
      return null;
    }

    case 'track_diary_entry': {
      const p = raw.payload;
      if (!p || !p.trackId) return null;
      return {
        ...baseEvent,
        type: 'TRACK_REVIEW_CREATED',
        entry_id: p.trackEntryId ?? undefined,
        track: {
          id: p.trackId,
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
          artist_id: p.artistId ?? raw.album?.artist_id ?? undefined,
          artist_name: p.artistName ?? raw.album?.artist?.name ?? undefined,
        },
        album: p.albumId ? {
          id: p.albumId,
          title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
          artist_id: p.artistId ?? raw.album?.artist_id ?? undefined,
        } : undefined,
        rating: p.rating ?? undefined,
        review_excerpt: p.reviewBody ?? undefined,
        review_is_long: (p.reviewBody?.length ?? 0) > 300,
      };
    }

    case 'comment_reply': {
      const replyAlbum = raw.entry?.album || (raw.album ? { id: raw.album.id, title: raw.album.title, cover_url: raw.album.cover_url } : null);

      if (replyAlbum) {
        return {
          ...baseEvent,
          type: 'COMMENT_REPLY',
          entry_id: raw.entry?.id ?? undefined,
          comment_id: raw.comment_id ?? undefined,
          is_reply: true,
          album: {
            id: replyAlbum.id,
            title: replyAlbum.title,
            cover_url: replyAlbum.cover_url,
            artist_id: replyAlbum.artist_id ?? raw.album?.artist_id ?? undefined,
            artist_name: replyAlbum.artist?.name ?? raw.album?.artist?.name ?? undefined,
          },
        };
      }
      return null;
    }

    case 'track_like': {
      const p = raw.payload;
      if (!p || !p.trackEntryId) return null;
      return {
        ...baseEvent,
        type: 'TRACK_REVIEW_LIKED',
        entry_id: p.trackEntryId ?? undefined,
        liked_entry_id: p.trackEntryId ?? undefined,
        entry_owner_id: p.entryOwnerId ?? undefined,
        track: {
          id: p.trackId || '',
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
        },
        _dedup_key: `track-like-${raw.actor?.id}-${p.trackEntryId}`,
      };
    }

    case 'track_comment': {
      const p = raw.payload;
      if (!p || !p.trackEntryId) return null;
      return {
        ...baseEvent,
        type: 'TRACK_COMMENT_CREATED',
        entry_id: p.trackEntryId ?? undefined,
        comment_id: raw.track_comment?.id ?? p.commentId ?? undefined,
        entry_owner_id: p.entryOwnerId ?? undefined,
        is_reply: Boolean(raw.track_comment?.parent_comment_id ?? p.parentCommentId),
        track: {
          id: p.trackId || '',
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
        },
      };
    }

    default:
      return null;
  }
}

/**
 * Private: Fanout event to feed_events
 * Append-only: INSERT only, never UPDATE/DELETE
 * 
 * Targets:
 * - If no targets provided: followers of actor_id
 * - If targets provided: explicit list
 * 
 * Never exposed to client
 */
/**
 * Get all actors who followed a given user within 24h of an anchor timestamp.
 * Used by the feed aggregation bottom sheet for USER_FOLLOWED cards.
 */
export async function getFollowActors(followeeId: string, anchorTime: string): Promise<FeedActor[]> {
  try {
    const supabase = await createSupabaseServer();
    const windowStart = new Date(new Date(anchorTime).getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('feed_events')
      .select('actor:profiles!actor_id(id, username, avatar_url)')
      .eq('type', 'follow')
      .eq('followee_id', followeeId)
      .gte('created_at', windowStart)
      .lte('created_at', anchorTime)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((r) => r.actor).filter((a): a is FeedActor => a != null);
  } catch {
    return [];
  }
}

/**
 * Get all actors who commented on a diary entry.
 * Used by the feed aggregation bottom sheet for COMMENT_CREATED cards.
 */
export async function getCommentActors(entryId: string): Promise<FeedActor[]> {
  try {
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from('diary_comments')
      .select('user:profiles!user_id(id, username, avatar_url)')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    // Supabase type-infers `user` as an array here despite the FK alias resolving
    // to a single row at runtime — same join shape as getFollowActors above.
    const rows = data as unknown as Array<{ user: FeedActor | null }>;
    return rows.map((r) => r.user).filter((a): a is FeedActor => a != null);
  } catch {
    return [];
  }
}

/**
 * Get all actors who commented on a track diary entry.
 * Used by the feed aggregation bottom sheet for TRACK_COMMENT_CREATED cards.
 */
export async function getTrackCommentActors(entryId: string): Promise<FeedActor[]> {
  try {
    const supabase = await createSupabaseServer();

    const { data: comments, error } = await (supabase as any)
      .from('track_diary_comments')
      .select('user_id')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false });

    if (error || !comments || comments.length === 0) return [];

    const userIds = [...new Set((comments as Array<{ user_id: string }>).map((c) => c.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return userIds.map((id) => profileMap.get(id)).filter((a): a is FeedActor => a != null);
  } catch {
    return [];
  }
}

/**
 * Get all actors who liked a track diary entry.
 * Used by the feed aggregation bottom sheet for TRACK_REVIEW_LIKED cards.
 */
export async function getTrackEntryLikes(entryId: string): Promise<FeedActor[]> {
  try {
    const supabase = await createSupabaseServer();

    const { data: likes, error } = await (supabase as any)
      .from('track_diary_likes')
      .select('user_id')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false });

    if (error || !likes || likes.length === 0) return [];

    const userIds = [...new Set((likes as Array<{ user_id: string }>).map((l) => l.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return userIds.map((id) => profileMap.get(id)).filter((a): a is FeedActor => a != null);
  } catch {
    return [];
  }
}

/**
 * Backfill: when a user follows someone, insert that person's last N feed_events
 * into the follower's feed so it's not empty right away.
 * Only inserts events that don't already exist (upsert by actor_id + type + entry_id + album_id).
 */
export async function backfillFolloweeEvents(followerId: string, followeeId: string, limit = 20) {
  try {
    const supabaseAdmin = createSupabaseAdmin();

    // Read directly from diary_entries — reliable regardless of fan-out history
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('diary_entries')
      .select('id, album_id, rating, created_at')
      .eq('user_id', followeeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entriesError || !entries || entries.length === 0) return;

    const rows = entries.map((e) => ({
      user_id: followerId,
      actor_id: followeeId,
      followee_id: null,
      type: 'diary_entry' as const,
      entry_id: e.id,
      album_id: e.album_id ?? null,
      created_at: e.created_at,
      payload: {},
    }));

    // Insert only — duplicate key errors are caught by the outer try/catch
    await supabaseAdmin
      .from('feed_events')
      .insert(rows);
  } catch (err) {
    console.error('backfillFolloweeEvents error:', err);
  }
}

export async function fanoutEvent(
  type: 'diary_entry' | 'like' | 'comment' | 'comment_reply' | 'follow' | 'track_diary_entry' | 'track_like' | 'track_comment',
  payload: Record<string, unknown>,
  targets?: string[]
) {
  try {
    // Use user-level client for READ queries (respects RLS)
    const supabase = await createSupabaseServer();
    
    // Use service_role client for WRITE to feed_events (bypasses RLS, system append-only)
    const supabaseAdmin = createSupabaseAdmin();

    // Determine who receives the event
    let recipientIds: string[];
    let actorId: string | null = null;

    if (targets && targets.length > 0) {
      recipientIds = targets;
      actorId = (payload.userId || payload.followerId) as string;
    } else {
      // Get followers of actor
      actorId = (payload.userId || payload.followerId) as string;
      if (!actorId) {
        return { success: false, error: 'No actor specified' };
      }

      const { data: followers, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followee_id', actorId);

      if (followersError) {
        return { success: false, error: followersError.message };
      }

      recipientIds = followers.map((f) => f.follower_id);
    }

    // Toujours ajouter l'acteur lui-même (pour son propre feed)
    if (actorId && !recipientIds.includes(actorId)) {
      recipientIds.push(actorId);
    }

    // Bound fanout to avoid runaway inserts for viral accounts
    recipientIds = recipientIds.slice(0, 5000);

    if (recipientIds.length === 0) {
      return { success: true, fanned: 0 };
    }

    // Insert feed_events for each recipient
    const events = recipientIds.map((userId) => ({
      user_id: userId,
      actor_id: actorId!,
      type,
      entry_id: (payload.entryId || null) as string | null,
      album_id: (payload.albumId || null) as string | null,
      comment_id: (type === 'comment' || type === 'comment_reply' ? payload.commentId || null : null) as string | null,
      track_comment_id: (type === 'track_comment' ? payload.commentId || null : null) as string | null,
      followee_id: type === 'follow' ? (payload.followeeId as string | null) : null,
      payload: payload || {},
    }));

    // Ensure payloads are JSON-serializable and cast to a safe type for insert
    const safeEvents = events.map((ev) => ({
      ...ev,
      payload: ev.payload ? JSON.parse(JSON.stringify(ev.payload)) : null,
    }));

    // Utilise le client user-level (session authentifiée) pour l'insert.
    // La policy RLS "feed_insert_as_actor" autorise les inserts où actor_id = auth.uid(),
    // ce qui permet à l'acteur d'écrire dans les feeds de ses followers.
    // Fallback sur supabaseAdmin si le client user-level n'a pas de session.
    const insertClient = supabase ?? supabaseAdmin;
    const { error: insertError } = await insertClient
      .from('feed_events')
      .insert(safeEvents);

    if (insertError) {
      // Retry avec supabaseAdmin si le client user-level échoue (ex: pas de session)
      if (insertClient !== supabaseAdmin) {
        const { error: adminError } = await supabaseAdmin
          .from('feed_events')
          .insert(safeEvents);
        if (adminError) {
          console.error('fanoutEvent insert error (admin):', adminError.message, { type, code: adminError.code });
          return { success: false, error: 'An error occurred' };
        }
      } else {
        console.error('fanoutEvent insert error:', insertError.message, { type, code: insertError.code });
        return { success: false, error: 'An error occurred' };
      }
    }

    return { success: true, fanned: recipientIds.length };
  } catch (err) {
    console.error('fanoutEvent error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Public feed for unauthenticated visitors — recent public diary entries
 * with album and author info. No auth required.
 */
export type PublicFeedEntry = {
  id: string;
  rating: number | null;
  review_body: string | null;
  listened_at: string | null;
  created_at: string;
  author: { id: string; username: string; avatar_url: string | null };
  album: { id: string; title: string; cover_url: string | null; artist_name: string };
};

export async function getPublicFeed(limit = 30): Promise<PublicFeedEntry[]> {
  try {
    const supabase = createSupabaseAnon();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const maxUniqueAuthors = Math.max(limit, 1);
    const scanLimit = Math.max(limit * 5, 100);

    // Step 1: fetch diary entries
    const { data: entries, error: entriesError } = await supabase
      .from('diary_entries')
      .select('id, rating, review_body, listened_at, created_at, user_id, album_id')
      .eq('is_public', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(scanLimit);

    if (entriesError || !entries || entries.length === 0) {
      if (entriesError) console.error('getPublicFeed entries error:', entriesError.message, entriesError.details);
      return [];
    }

    // Keep only the latest entry per author, then cap to requested unique authors.
    const latestByUser = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
      if (!latestByUser.has(entry.user_id)) {
        latestByUser.set(entry.user_id, entry);
      }
      if (latestByUser.size >= maxUniqueAuthors) break;
    }

    const uniqueEntries = Array.from(latestByUser.values());

    const userIds = [...new Set(uniqueEntries.map((e) => e.user_id))];
    const albumIds = [...new Set(uniqueEntries.map((e) => e.album_id))];

    // Step 2: fetch profiles and albums in parallel
    const [{ data: profiles }, { data: albums }] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
      supabase.from('albums').select('id, title, cover_url, artist_id').in('id', albumIds),
    ]);

    const artistIds = [...new Set((albums ?? []).map((a) => a.artist_id).filter((id): id is string => id != null))];
    const { data: artists } = artistIds.length > 0
      ? await supabase.from('artists').select('id, name').in('id', artistIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const albumMap = new Map((albums ?? []).map((a) => [a.id, a]));
    const artistMap = new Map((artists ?? []).map((a) => [a.id, a]));

    return uniqueEntries
      .filter((e) => profileMap.has(e.user_id) && albumMap.has(e.album_id))
      .map((e) => {
        const profile = profileMap.get(e.user_id)!;
        const album = albumMap.get(e.album_id)!;
        const artist = artistMap.get(album.artist_id ?? '');
        return {
          id: e.id,
          rating: e.rating ?? null,
          review_body: e.review_body ?? null,
          listened_at: e.listened_at ?? null,
          created_at: e.created_at,
          author: {
            id: profile.id,
            username: profile.username ?? '',
            avatar_url: profile.avatar_url ?? null,
          },
          album: {
            id: album.id,
            title: album.title ?? '',
            cover_url: album.cover_url ?? null,
            artist_name: artist?.name ?? '',
          },
        };
      });
  } catch (err) {
    console.error('getPublicFeed unexpected error:', err);
    return [];
  }
}

/**
 * Marque l'activité comme vue par l'utilisateur courant (visite de /feed).
 * N'écrit jamais dans feed_events — uniquement profiles.last_seen_activity_at.
 */
export async function markActivitySeen() {
  try {
    const user = await getAuthUser();
    if (!user) return { ok: false as const };

    const supabase = await createSupabaseServer();
    await (supabase as any)
      .from('profiles')
      .update({ last_seen_activity_at: new Date().toISOString() })
      .eq('id', user.id);

    return { ok: true as const };
  } catch (err) {
    console.error('markActivitySeen error:', err);
    return { ok: false as const };
  }
}

/**
 * Y a-t-il un événement (provenant d'un autre utilisateur) plus récent
 * que la dernière visite de /feed ? Utilisé pour le badge "non lu" sur la nav.
 */
export async function hasUnseenActivity(): Promise<boolean> {
  try {
    const user = await getAuthUser();
    if (!user) return false;

    const supabase = await createSupabaseServer();

    // last_seen_activity_at n'est pas dans les types générés (migration récente) — cast en any.
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('last_seen_activity_at')
      .eq('id', user.id)
      .maybeSingle();

    const since = profile?.last_seen_activity_at ?? new Date(0).toISOString();

    const { count } = await supabase
      .from('feed_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('type', 'discover')
      .neq('actor_id', user.id)
      .gt('created_at', since)
      .limit(1);

    return (count ?? 0) > 0;
  } catch (err) {
    console.error('hasUnseenActivity error:', err);
    return false;
  }
}
