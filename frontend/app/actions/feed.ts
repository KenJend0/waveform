'use server';

import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/server';

/**
 * Frontend event types (MVP, no DB change)
 * Mapped from DB types: diary/follow/discover/like/comment
 */
export type FeedEventType = 'REVIEW_CREATED' | 'UNRATED_LISTEN' | 'REVIEW_LIKED' | 'ALBUM_SAVED' | 'USER_FOLLOWED' | 'COMMENT_CREATED';

/**
 * Feed event payload for frontend display
 */
export interface FeedEvent {
  id: string;
  type: FeedEventType;
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  followee?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  album?: {
    id: string;
    title: string;
    cover_url: string | null;
  };
  rating?: number;
  review_excerpt?: string;
  entry_id?: string; // For actions (like/comment)
  liked_entry_id?: string; // For REVIEW_LIKED to avoid confusion
  likes_count?: number; // For REVIEW_CREATED
  is_liked?: boolean; // For REVIEW_CREATED
  comments_count?: number; // For REVIEW_CREATED
  entry_owner_id?: string; // Owner of the liked/commented diary entry
  current_user_also_commented?: boolean; // For COMMENT_CREATED: current user has also commented on same entry
  created_at: string;
  _dedup_key?: string; // For client-side deduplication
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
}: {
  limit?: number;
  /** ISO timestamp of the last event seen — pass to fetch the next page */
  cursor?: string | null;
} = {}) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated', events: [], nextCursor: null };
    }

    const supabase = await createSupabaseServer();

    // Feed is fan-out at write time, so we only read events where user_id = auth.uid()
    // No need to fetch followers or use .in() — all relevant events are already here

    // Fetch feed_events for current user, with joins
    let query = supabase
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
        created_at,
        actor:profiles!actor_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        followee:profiles!followee_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        album:albums (
          id,
          title,
          cover_url
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
            cover_url
          )
        )
      `
      )
      .eq('user_id', user.id)
      .neq('actor_id', user.id) // Don't show own actions — user already knows what they did
      .order('created_at', { ascending: false })
      .limit(limit);

    // Cursor: only fetch events older than the last seen timestamp
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: rawEvents, error } = await query;

    if (error) {
      return { success: false, error: 'An error occurred', events: [], nextCursor: null };
    }

    if (!rawEvents || rawEvents.length === 0) {
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

    const likedEntryIds = new Set((likedData || []).map((l: any) => l.entry_id));

    // Also fetch which entries the current user has commented on (for COMMENT_CREATED flag)
    const { data: commentedData } = entryIds.length > 0
      ? await supabase
          .from('diary_comments')
          .select('entry_id')
          .in('entry_id', entryIds)
          .eq('user_id', user.id)
      : { data: [] };

    const commentedEntryIds = new Set((commentedData || []).map((c: any) => c.entry_id));

    // Map DB events to frontend types
    const events: FeedEvent[] = (rawEvents || [])
      .map((raw: any) => {
        const mapped = mapFeedEvent(raw);
        // Attach denormalized counts + is_liked for reviews
        if (mapped && mapped.type === 'REVIEW_CREATED' && mapped.entry_id && raw.entry) {
          mapped.likes_count = raw.entry.likes_count ?? 0;
          mapped.comments_count = raw.entry.comments_count ?? 0;
          mapped.is_liked = likedEntryIds.has(mapped.entry_id);
        }
        // Attach "also commented" flag for comment events from other users
        if (mapped && mapped.type === 'COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
          mapped.current_user_also_commented = commentedEntryIds.has(mapped.entry_id);
        }
        return mapped;
      })
      .filter(Boolean) as FeedEvent[];

    // Cursor for the next page: created_at of the oldest event in this batch
    const nextCursor = events.length > 0 ? events[events.length - 1].created_at : null;

    return { success: true, events, nextCursor };
  } catch (err) {
    console.error('getFeedEvents error:', err);
    return { success: false, error: 'An error occurred', events: [], nextCursor: null };
  }
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
      display_name: raw.actor.display_name,
      avatar_url: raw.actor.avatar_url,
    },
    created_at: raw.created_at,
  };

  // Map types: diary_entry -> REVIEW_CREATED, follow -> USER_FOLLOWED, discover -> ALBUM_SAVED, like -> REVIEW_LIKED
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
          } : undefined,
          rating: raw.entry.rating,
          review_excerpt: raw.entry.review_body
            ? raw.entry.review_body.substring(0, 150)
            : undefined,
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
          display_name: raw.followee.display_name,
          avatar_url: raw.followee.avatar_url,
        } : undefined,
      };

    case 'discover':
      return {
        ...baseEvent,
        type: 'ALBUM_SAVED',
        album: raw.album ? {
          id: raw.album.id,
          title: raw.album.title,
          cover_url: raw.album.cover_url,
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
          album: {
            id: likeAlbum.id,
            title: likeAlbum.title,
            cover_url: likeAlbum.cover_url,
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
        return {
          ...baseEvent,
          type: 'COMMENT_CREATED',
          entry_id: raw.entry.id,
          entry_owner_id: raw.entry.user_id ?? undefined,
          album: {
            id: commentAlbum.id,
            title: commentAlbum.title,
            cover_url: commentAlbum.cover_url,
          },
        };
      }
      return null;
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
 * Backfill: when a user follows someone, insert that person's last N feed_events
 * into the follower's feed so it's not empty right away.
 * Only inserts events that don't already exist (upsert by actor_id + type + entry_id + album_id).
 */
export async function backfillFolloweeEvents(followerId: string, followeeId: string, limit = 20) {
  try {
    const supabase = await createSupabaseServer();
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch the followee's recent events that were already fanned out to any recipient
    // We use a single known recipient (the followee themselves) as a proxy
    const { data: sourceEvents, error } = await supabase
      .from('feed_events')
      .select('actor_id, followee_id, type, entry_id, album_id, created_at, payload')
      .eq('actor_id', followeeId)
      .eq('user_id', followeeId) // the followee's own copy of their events
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !sourceEvents || sourceEvents.length === 0) return;

    const rows = sourceEvents.map((e) => ({
      user_id: followerId,
      actor_id: e.actor_id,
      followee_id: e.followee_id ?? null,
      type: e.type,
      entry_id: e.entry_id ?? null,
      album_id: e.album_id ?? null,
      created_at: e.created_at,
      payload: e.payload ?? {},
    }));

    await supabaseAdmin
      .from('feed_events')
      .upsert(rows, { onConflict: 'user_id,actor_id,type,entry_id,album_id', ignoreDuplicates: true });
  } catch (err) {
    console.error('backfillFolloweeEvents error:', err);
  }
}

export async function fanoutEvent(
  type: 'diary_entry' | 'like' | 'comment' | 'follow' | 'discover',
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
      followee_id: type === 'follow' ? (payload.followeeId as string | null) : null,
      payload: payload || {},
    }));

    // Ensure payloads are JSON-serializable and cast to a safe type for insert
    const safeEvents = events.map((ev) => ({
      ...ev,
      payload: ev.payload ? JSON.parse(JSON.stringify(ev.payload)) : null,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('feed_events')
      .insert(safeEvents as any[]);

    if (insertError) {
      return { success: false, error: 'An error occurred' };
    }

    return { success: true, fanned: recipientIds.length };
  } catch (err) {
    console.error('fanoutEvent error:', err);
    return { success: false, error: 'An error occurred' };
  }
}
