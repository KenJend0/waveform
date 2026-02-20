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
 */
export async function getMyFeed({
  limit = 20,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated', events: [] };
    }

    const supabase = await createSupabaseServer();

    // Feed is fan-out at write time, so we only read events where user_id = auth.uid()
    // No need to fetch followers or use .in() — all relevant events are already here

    // Fetch feed_events for current user, with joins
    const { data: rawEvents, error } = await supabase
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
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message, events: [] };
    }

    if (!rawEvents || rawEvents.length === 0) {
      return { success: true, events: [] };
    }

    // Get like stats for all entries
    const entryIds = (rawEvents || [])
      .filter((e: any) => e.entry_id)
      .map((e: any) => e.entry_id);

    const { data: statsData } = entryIds.length > 0
      ? await supabase
          .from('diary_likes')
          .select('entry_id, user_id')
          .in('entry_id', entryIds)
      : { data: [] };

    const likeStats = new Map<string, { count: number; userLiked: Set<string> }>();
    (statsData || []).forEach((like: any) => {
      if (!likeStats.has(like.entry_id)) {
        likeStats.set(like.entry_id, { count: 0, userLiked: new Set() });
      }
      const stat = likeStats.get(like.entry_id)!;
      stat.count++;
      stat.userLiked.add(like.user_id);
    });

    // Get comment counts for all entries
    const { data: commentsData } = entryIds.length > 0
      ? await supabase
          .from('diary_comments')
          .select('entry_id, user_id')
          .in('entry_id', entryIds)
      : { data: [] };

    const commentStats = new Map<string, number>();
    const commentersByEntry = new Map<string, Set<string>>();
    (commentsData || []).forEach((comment: any) => {
      commentStats.set(comment.entry_id, (commentStats.get(comment.entry_id) || 0) + 1);
      if (!commentersByEntry.has(comment.entry_id)) {
        commentersByEntry.set(comment.entry_id, new Set());
      }
      commentersByEntry.get(comment.entry_id)!.add(comment.user_id);
    });

    // Map DB events to frontend types
    const events: FeedEvent[] = (rawEvents || [])
      .map((raw: any) => {
        const mapped = mapFeedEvent(raw);
        // Attach like stats if it's a review
        if (mapped && mapped.type === 'REVIEW_CREATED' && mapped.entry_id) {
          const stat = likeStats.get(mapped.entry_id);
          mapped.likes_count = stat?.count || 0;
          mapped.is_liked = stat?.userLiked.has(user.id) || false;
          mapped.comments_count = commentStats.get(mapped.entry_id) || 0;
        }
        // Attach "also commented" flag for comment events from other users
        if (mapped && mapped.type === 'COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
          const commenters = commentersByEntry.get(mapped.entry_id);
          mapped.current_user_also_commented = commenters?.has(user.id) || false;
        }
        return mapped;
      })
      .filter(Boolean) as FeedEvent[];

    return { success: true, events };
  } catch (err) {
    return { success: false, error: String(err), events: [] };
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
      return { success: false, error: insertError.message };
    }

    return { success: true, fanned: recipientIds.length };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
