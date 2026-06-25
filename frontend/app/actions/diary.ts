'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { logAuthedProductEvent } from '@/lib/productEvents';
import { fanoutEvent } from './feed';
import { checkActionRateLimit } from '@/lib/serverRateLimit';
import { findBannedContentWord } from '@/lib/bannedWords';

export interface UpsertDiaryEntryInput {
  albumId: string;
  listenedAt: string;
  reviewTitle?: string;
  reviewBody?: string;
  rating?: number;
  relisten?: boolean;
  isPublic?: boolean;
  avatarUrl?: string | null;
  /** Provenance de la note — 'for_you' si l'utilisateur arrive d'une suggestion "Pour toi" */
  source?: string;
}

/**
 * Upsert diary entry (user_id, album_id, listened_at)
 * Calls fanoutEvent for followers
 */
export async function upsertDiaryEntry(input: UpsertDiaryEntryInput) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const rlError = await checkActionRateLimit(user.id, 'diary_write');
    if (rlError) return { success: false, error: rlError };

    const supabase = await createSupabaseServer();

    // Validation
    if (!input.albumId || !input.listenedAt) {
      return { success: false, error: 'albumId and listenedAt required' };
    }

    if (input.rating !== undefined && (input.rating < 0 || input.rating > 10)) {
      return { success: false, error: 'Rating must be 0-10' };
    }

    if (input.reviewTitle && input.reviewTitle.length > 200) {
      return { success: false, error: 'Review title too long — max 200 characters' };
    }

    if (input.reviewBody && input.reviewBody.length > 5000) {
      return { success: false, error: 'Review body too long — max 5000 characters' };
    }
    if (input.reviewTitle && findBannedContentWord(input.reviewTitle)) {
      return { success: false, error: 'Ce titre contient du contenu inapproprié.' };
    }
    if (input.reviewBody && findBannedContentWord(input.reviewBody)) {
      return { success: false, error: 'Cette critique contient du contenu inapproprié.' };
    }

    const entryPayload = {
      user_id: user.id,
      album_id: input.albumId,
      listened_at: input.listenedAt,
      review_title: input.reviewTitle || null,
      review_body: input.reviewBody || null,
      rating: input.rating ?? null,
      re_listen: input.relisten || false,
      is_public: input.isPublic ?? true,
      rec_source: input.source ?? null,
    };

    let data: any;

    if (input.relisten) {
      // Re-listen: always INSERT a new entry (never overwrite an existing one)
      const { data: inserted, error } = await supabase
        .from('diary_entries')
        .insert(entryPayload)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Vous avez déjà une écoute à cette date. Choisissez une autre date.' };
        }
        return { success: false, error: 'An error occurred' };
      }
      data = inserted;
    } else {
      // First listen: upsert (update if same date, create otherwise)
      const { data: upserted, error } = await supabase
        .from('diary_entries')
        .upsert(entryPayload, { onConflict: 'user_id,album_id,listened_at' })
        .select()
        .single();

      if (error) {
        return { success: false, error: 'An error occurred' };
      }
      data = upserted;
    }

    // Fanout to followers — supprime d'abord les events existants pour cette
    // entrée (un upsert qui met juste à jour une note déjà notée le même jour
    // ne doit pas dupliquer l'event dans le feed des followers).
    try {
      await createSupabaseAdmin()
        .from('feed_events')
        .delete()
        .eq('type', 'diary_entry')
        .eq('entry_id', data.id);

      await fanoutEvent('diary_entry', {
        entryId: data.id,
        albumId: input.albumId,
        userId: user.id,
      });
    } catch (fanoutErr) {
      console.error('Fanout error:', fanoutErr);
    }

    await logAuthedProductEvent('album_logged', {
      surface: 'diary',
      properties: {
        album_id: input.albumId,
        entry_id: data.id,
        has_review: Boolean(input.reviewTitle || input.reviewBody),
        has_rating: input.rating !== undefined && input.rating !== null,
        is_relisten: Boolean(input.relisten),
        is_public: input.isPublic ?? true,
        rec_source: input.source ?? null,
      },
    });

    return { success: true, data };
  } catch (err) {
    console.error('upsertDiaryEntry error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Update an existing diary entry by its id (owner only)
 */
export async function updateDiaryEntry(input: {
  entryId: string;
  listenedAt: string;
  reviewBody?: string;
  rating?: number | null;
}) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (!input.listenedAt) return { success: false, error: 'listenedAt required' };

    if (input.rating !== undefined && input.rating !== null && (input.rating < 0 || input.rating > 10)) {
      return { success: false, error: 'Rating must be 0-10' };
    }

    if (input.reviewBody && input.reviewBody.length > 5000) {
      return { success: false, error: 'Review body too long — max 5000 characters' };
    }
    if (input.reviewBody && findBannedContentWord(input.reviewBody)) {
      return { success: false, error: 'Cette critique contient du contenu inapproprié.' };
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from('diary_entries')
      .update({
        listened_at: input.listenedAt,
        review_body: input.reviewBody || null,
        rating: input.rating ?? null,
      })
      .eq('id', input.entryId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (error || !data) return { success: false, error: 'An error occurred' };

    return { success: true, data };
  } catch (err) {
    console.error('updateDiaryEntry error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Delete diary entry (owner only)
 * Also deletes related feed_events
 */
export async function deleteDiaryEntry(entryId: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createSupabaseServer();

    // Verify ownership
    const { data: entry, error: fetchError } = await supabase
      .from('diary_entries')
      .select('user_id')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchError || !entry) {
      return { success: false, error: 'Entry not found' };
    }

    if (entry.user_id !== user.id) {
      return { success: false, error: 'Forbidden' };
    }

    // Delete feed_events linked to entry
    await supabase
      .from('feed_events')
      .delete()
      .eq('entry_id', entryId);

    // Delete entry
    const { error: deleteError } = await supabase
      .from('diary_entries')
      .delete()
      .eq('id', entryId);

    if (deleteError) {
      return { success: false, error: 'An error occurred' };
    }

    revalidatePath('/me');
    revalidatePath('/u/[username]', 'page');

    return { success: true };
  } catch (err) {
    console.error('deleteDiaryEntry error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

// Ajouter un commentaire (ou une réponse si parentCommentId est fourni)
export async function addComment(entryId: string, body: string, parentCommentId?: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const rlError = await checkActionRateLimit(user.id, 'comment');
  if (rlError) throw new Error(rlError);

  if (!body.trim()) {
    throw new Error('Comment body cannot be empty');
  }

  if (body.trim().length > 1000) {
    throw new Error('Comment too long — max 1000 characters');
  }
  if (findBannedContentWord(body)) {
    throw new Error('Ce commentaire contient du contenu inapproprié.');
  }

  const supabase = await createSupabaseServer();

  // Verify the parent entry is visible to this user (public or owned by them)
  const { data: entryCheck, error: entryCheckError } = await supabase
    .from('diary_entries')
    .select('id, user_id, is_public, album_id')
    .eq('id', entryId)
    .maybeSingle();

  if (entryCheckError || !entryCheck) {
    throw new Error('Entry not found');
  }

  if (!entryCheck.is_public && entryCheck.user_id !== user.id) {
    throw new Error('Entry not found');
  }

  // Prevent interaction with content from a blocked user
  if (entryCheck.user_id !== user.id) {
    const { data: block } = await (supabase as any)
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', entryCheck.user_id)
      .maybeSingle();
    if (block) throw new Error('Action impossible');
  }

  // Validate parentCommentId: it must belong to this entry and must not itself be a reply
  // Use admin client to bypass RLS — we already checked entry visibility above
  let parentCommentAuthorId: string | null = null;
  if (parentCommentId) {
    const supabaseAdmin = createSupabaseAdmin();
    const { data: parentComment, error: parentError } = await supabaseAdmin
      .from('diary_comments')
      .select('id, entry_id, parent_comment_id, user_id')
      .eq('id', parentCommentId)
      .maybeSingle();

    if (parentError || !parentComment) {
      throw new Error('Parent comment not found');
    }
    if (parentComment.entry_id !== entryId) {
      throw new Error('Parent comment does not belong to this entry');
    }
    // Only 1 level of nesting allowed
    if (parentComment.parent_comment_id) {
      throw new Error('Cannot reply to a reply');
    }
    parentCommentAuthorId = parentComment.user_id;
  }

  const { data: insertedComment, error } = await supabase
    .from('diary_comments')
    .insert({
      entry_id: entryId,
      user_id: user.id,
      body,
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    })
    .select('id')
    .single();

  if (error || !insertedComment) {
    throw new Error('An error occurred');
  }

  const newCommentId = insertedComment.id;

  await logAuthedProductEvent('comment_created', {
    surface: 'diary',
    properties: {
      entry_id: entryId,
      body_length: body.trim().length,
      is_reply: Boolean(parentCommentId),
    },
  });

  if (parentCommentId && parentCommentAuthorId) {
    // Reply: notify only the author of the parent comment (skip self-replies)
    if (parentCommentAuthorId !== user.id) {
      try {
        await fanoutEvent('comment_reply', {
          userId: user.id,
          entryId: entryId,
          albumId: (entryCheck as any).album_id ?? null,
          commentId: newCommentId,
          parentCommentId,
        }, [parentCommentAuthorId]);
      } catch (fanoutErr) {
        console.error('comment_reply fanout error:', fanoutErr);
      }
    }
  } else {
    // Top-level comment: fanout to entry owner + previous commenters + actor's followers
    const [{ data: previousCommenters }, { data: actorFollowers }] = await Promise.all([
      supabase.from('diary_comments').select('user_id').eq('entry_id', entryId).neq('user_id', user.id).limit(500),
      supabase.from('follows').select('follower_id').eq('followee_id', user.id).limit(1000),
    ]);

    try {
      const targetSet = new Set<string>([entryCheck.user_id]);
      (previousCommenters || []).forEach((c: any) => targetSet.add(c.user_id));
      (actorFollowers || []).forEach((f: any) => targetSet.add(f.follower_id));
      targetSet.delete(user.id);

      await fanoutEvent('comment', {
        userId: user.id,
        entryId: entryId,
        commentId: newCommentId,
      }, [...targetSet]);
    } catch (fanoutErr) {
      console.error('Comment fanout error:', fanoutErr);
    }
  }
}

// Supprimer un commentaire
export async function deleteComment(commentId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const supabaseAdmin = createSupabaseAdmin();
  const { data: comment, error: fetchError } = await supabaseAdmin
    .from('diary_comments')
    .select('user_id')
    .eq('id', commentId)
    .maybeSingle();

  if (fetchError || !comment) {
    throw new Error('Comment not found');
  }

  if (comment.user_id !== user.id) {
    throw new Error('Not authorized to delete this comment');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('diary_comments')
    .delete()
    .eq('id', commentId);

  if (deleteError) {
    throw new Error('An error occurred');
  }
}

// Toggle like/unlike une entrée
export async function toggleDiaryLike(entryId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const rlError = await checkActionRateLimit(user.id, 'like');
  if (rlError) throw new Error(rlError);

  const supabase = await createSupabaseServer();

  // Vérifier si un like existe déjà
  const { data: existingLike, error: fetchError } = await supabase
    .from('diary_likes')
    .select('*')
    .eq('entry_id', entryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error('An error occurred');
  }

  // Get entry to find the owner
  const { data: entry, error: entryError } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('id', entryId)
    .maybeSingle();

  if (entryError || !entry) {
    throw new Error('Entry not found');
  }

  // Prevent interaction with content from a blocked user
  if (entry.user_id !== user.id) {
    const { data: block } = await (supabase as any)
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', entry.user_id)
      .maybeSingle();
    if (block) throw new Error('Action impossible');
  }

  const supabaseAdmin = createSupabaseAdmin();

  if (existingLike) {
    // Unlike: delete the like and remove related feed_events
    const { error: deleteError } = await supabase
      .from('diary_likes')
      .delete()
      .eq('entry_id', entryId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw new Error('An error occurred');
    }

    await supabaseAdmin
      .from('feed_events')
      .delete()
      .eq('type', 'like')
      .eq('actor_id', user.id)
      .eq('entry_id', entryId);
  } else {
    // Like: add the like
    const { error: insertError } = await supabase.from('diary_likes').insert({
      entry_id: entryId,
      user_id: user.id,
    });

    if (insertError) {
      throw new Error('An error occurred');
    }

    // Ensure no duplicate like events before fanout
    await supabaseAdmin
      .from('feed_events')
      .delete()
      .eq('type', 'like')
      .eq('actor_id', user.id)
      .eq('entry_id', entryId);

    try {
      // Fanout to: entry owner + actor's followers (for discovery in their feeds)
      const { data: actorFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followee_id', user.id);

      const targetSet = new Set<string>([entry.user_id]);
      (actorFollowers || []).forEach((f: any) => targetSet.add(f.follower_id));
      targetSet.delete(user.id); // fanoutEvent always adds actor to its own feed

      await fanoutEvent('like', {
        userId: user.id,
        entryId: entryId,
      }, [...targetSet]);
    } catch (fanoutErr) {
      console.error('Fanout error:', fanoutErr);
      // Don't throw, like was successful even if fanout failed
    }

    await logAuthedProductEvent('review_liked', {
      surface: 'diary',
      properties: {
        entry_id: entryId,
        owner_id: entry.user_id,
      },
    });
  }
}

/**
 * Get users who liked a diary entry
 */
export async function getEntryLikes(entryId: string): Promise<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>> {
  const supabase = await createSupabaseServer();

  // Step 1: get user_ids from diary_likes (no FK to profiles in schema)
  const { data: likes, error: likesError } = await supabase
    .from('diary_likes')
    .select('user_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false });

  if (likesError) {
    console.error('getEntryLikes error:', likesError);
    return [];
  }

  if (!likes || likes.length === 0) return [];

  const userIds = likes.map((l: any) => l.user_id);

  // Step 2: fetch profiles for those user_ids
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    console.error('getEntryLikes profiles error:', profilesError);
    return [];
  }

  // Preserve order from likes query
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  return userIds.map((id: string) => profileMap.get(id)).filter(Boolean);
}

/**
 * Get comments for a diary entry (lightweight, for client refresh)
 */
export async function getEntryComments(entryId: string): Promise<DiaryEntryComment[]> {
  const currentUser = await getAuthUser();
  const supabase = await createSupabaseServer();

  // Verify the parent entry is visible (RLS on diary_entries enforces this,
  // and the RLS patch on diary_comments mirrors it at DB level)
  const { data: entryCheck } = await supabase
    .from('diary_entries')
    .select('id, user_id, is_public')
    .eq('id', entryId)
    .maybeSingle();

  if (!entryCheck) return [];
  if (!entryCheck.is_public && entryCheck.user_id !== currentUser?.id) return [];

  const { data: commentsData, error } = await supabase
    .from('diary_comments')
    .select('id, body, created_at, user_id, parent_comment_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getEntryComments error:', error);
    return [];
  }

  const userIds = [...new Set((commentsData || []).map((c) => c.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map(
    (profilesData || []).map((p) => [p.id, p])
  );

  const allComments: DiaryEntryComment[] = (commentsData || []).map((c) => {
    const profile = profilesMap.get(c.user_id);
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      parent_comment_id: c.parent_comment_id ?? null,
      author: {
        id: c.user_id,
        username: profile?.username || 'unknown',
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
      },
      is_mine: currentUser?.id === c.user_id,
      replies: [],
    };
  });

  // Build tree: attach replies to their parent
  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const topLevel: DiaryEntryComment[] = [];
  for (const comment of allComments) {
    if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
      commentMap.get(comment.parent_comment_id)!.replies.push(comment);
    } else {
      topLevel.push(comment);
    }
  }
  return topLevel;
}

// ============================================================================
// PROFILE DATA FETCHING
// ============================================================================

export type DiaryEntryUI = {
  id: string;
  album_id: string;
  album_title: string;
  artist_id: string;
  artist_name: string;
  cover_url: string | null;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
  release_date: string | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

/**
 * Get user diary entries with album info
 */
export async function getUserDiary(
  userId: string,
  offset = 0,
  limit = 50
): Promise<DiaryEntryUI[]> {
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select(`
      id,
      album_id,
      rating,
      review_body,
      listened_at,
      created_at,
      albums (
        id,
        title,
        cover_url,
        release_date,
        artist_id,
        artists (
          id,
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('listened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Get likes count from the stats view
  const entryIds = (entries || []).map(e => e.id);
  const { data: statsData } = await supabase
    .from('diary_entry_stats')
    .select('entry_id, likes_count, comments_count')
    .in('entry_id', entryIds);

  const likesMap = new Map((statsData || []).map(s => [s.entry_id, s.likes_count || 0]));
  const commentsMap = new Map((statsData || []).map(s => [s.entry_id, s.comments_count || 0]));

  if (error || !entries) {
    console.error('getUserDiary error:', error);
    return [];
  }

  // Get user's likes if authenticated — filtered to visible entries only
  let likedEntryIds = new Set<string>();
  if (currentUser && entryIds.length > 0) {
    const { data: likes } = await supabase
      .from('diary_likes')
      .select('entry_id')
      .eq('user_id', currentUser.id)
      .in('entry_id', entryIds);
    likedEntryIds = new Set((likes || []).map(l => l.entry_id));
  }

  return entries.map((e) => {
    const album = e.albums as any;
    const artist = album?.artists as any;
    return {
      id: e.id,
      album_id: e.album_id,
      album_title: album?.title || 'Unknown',
      artist_id: album?.artist_id || '',
      artist_name: artist?.name || 'Unknown',
      cover_url: album?.cover_url || null,
      rating: e.rating,
      review_body: e.review_body,
      listened_at: e.listened_at,
      created_at: e.created_at,
      release_date: album?.release_date || null,
      likes_count: likesMap.get(e.id) || 0,
      comments_count: commentsMap.get(e.id) || 0,
      is_liked: likedEntryIds.has(e.id),
    };
  });
}

/**
 * Get user reviews (diary entries with review_body) - filtered server-side
 */
export async function getUserReviews(userId: string): Promise<DiaryEntryUI[]> {
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select(`
      id,
      album_id,
      rating,
      review_body,
      listened_at,
      created_at,
      albums (
        id,
        title,
        cover_url,
        release_date,
        artist_id,
        artists (
          id,
          name
        )
      )
    `)
    .eq('user_id', userId)
    .not('review_body', 'is', null)
    .order('listened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !entries) {
    console.error('getUserReviews error:', error);
    return [];
  }

  // Get likes count from the stats view
  const entryIds = entries.map(e => e.id);
  const { data: statsData } = await supabase
    .from('diary_entry_stats')
    .select('entry_id, likes_count, comments_count')
    .in('entry_id', entryIds);

  const likesMap = new Map((statsData || []).map(s => [s.entry_id, s.likes_count || 0]));
  const commentsMap = new Map((statsData || []).map(s => [s.entry_id, s.comments_count || 0]));

  // Get user's likes if authenticated — filtered to visible entries only
  let likedEntryIds = new Set<string>();
  if (currentUser && entryIds.length > 0) {
    const { data: likes } = await supabase
      .from('diary_likes')
      .select('entry_id')
      .eq('user_id', currentUser.id)
      .in('entry_id', entryIds);
    likedEntryIds = new Set((likes || []).map(l => l.entry_id));
  }

  return entries.map((e) => {
    const album = e.albums as any;
    const artist = album?.artists as any;
    return {
      id: e.id,
      album_id: e.album_id,
      album_title: album?.title || 'Unknown',
      artist_id: album?.artist_id || '',
      artist_name: artist?.name || 'Unknown',
      cover_url: album?.cover_url || null,
      rating: e.rating,
      review_body: e.review_body,
      listened_at: e.listened_at,
      created_at: e.created_at,
      release_date: album?.release_date || null,
      likes_count: likesMap.get(e.id) || 0,
      comments_count: commentsMap.get(e.id) || 0,
      is_liked: likedEntryIds.has(e.id),
    };
  });
}

// ============================================================================
// REVUES UNIFIÉES (albums + titres avec review_body)
// ============================================================================

export type UnifiedReview = {
  id: string;
  type: 'album' | 'track';
  href: string;          // /diary/[id] ou /track-diary/[id]
  title: string;         // album_title ou track_title
  subtitle: string;      // artist_name (+ album pour tracks)
  artist_id: string;
  cover_url: string | null;
  rating: number | null;
  review_body: string;
  listened_at: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

export async function getUserReviewsUnified(userId: string): Promise<UnifiedReview[]> {
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  const [albumReviews, trackReviews] = await Promise.all([
    // Album reviews
    supabase
      .from('diary_entries')
      .select(`id, rating, review_body, listened_at, created_at, album_id, albums(id, title, cover_url, artist_id, artists(id, name))`)
      .eq('user_id', userId)
      .not('review_body', 'is', null)
      .neq('review_body', '')
      .order('created_at', { ascending: false })
      .limit(100),
    // Track reviews
    (supabase as any)
      .from('track_diary_entries')
      .select(`id, rating, review_body, listened_at, created_at, track_id, album_id, tracks(id, title, albums(id, title, cover_url, artist_id, artists(id, name)))`)
      .eq('user_id', userId)
      .not('review_body', 'is', null)
      .neq('review_body', '')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const allIds = (albumReviews.data ?? []).map((e: any) => e.id);
  let likedIds = new Set<string>();
  if (currentUser && allIds.length > 0) {
    const { data: likes } = await supabase
      .from('diary_likes')
      .select('entry_id')
      .eq('user_id', currentUser.id)
      .in('entry_id', allIds);
    likedIds = new Set((likes ?? []).map((l: any) => l.entry_id));
  }

  const { data: statsData } = allIds.length > 0
    ? await supabase.from('diary_entry_stats').select('entry_id, likes_count, comments_count').in('entry_id', allIds)
    : { data: [] };
  const statsMap = new Map((statsData ?? []).map((s: any) => [s.entry_id, s]));

  const albumItems: UnifiedReview[] = (albumReviews.data ?? []).map((e: any) => {
    const album = e.albums as any;
    const artist = album?.artists as any;
    const stats = statsMap.get(e.id);
    return {
      id: e.id,
      type: 'album',
      href: `/diary/${e.id}`,
      title: album?.title || 'Inconnu',
      subtitle: artist?.name || 'Inconnu',
      artist_id: artist?.id || album?.artist_id || '',
      cover_url: album?.cover_url || null,
      rating: e.rating,
      review_body: e.review_body,
      listened_at: e.listened_at,
      created_at: e.created_at,
      likes_count: stats?.likes_count ?? 0,
      comments_count: stats?.comments_count ?? 0,
      is_liked: likedIds.has(e.id),
    };
  });

  const trackIds = (trackReviews.data ?? []).map((e: any) => e.id);
  let trackLikedIds = new Set<string>();
  if (currentUser && trackIds.length > 0) {
    const { data: trackLikes } = await (supabase as any)
      .from('track_diary_likes')
      .select('entry_id')
      .eq('user_id', currentUser.id)
      .in('entry_id', trackIds);
    trackLikedIds = new Set((trackLikes ?? []).map((l: any) => l.entry_id));
  }
  const { data: trackStatsData } = trackIds.length > 0
    ? await (supabase as any).from('track_diary_entry_stats').select('entry_id, likes_count, comments_count').in('entry_id', trackIds)
    : { data: [] };
  const trackStatsMap = new Map((trackStatsData ?? []).map((s: any) => [s.entry_id, s]));

  const trackItems: UnifiedReview[] = (trackReviews.data ?? []).map((e: any) => {
    const track = e.tracks as any;
    const album = track?.albums as any;
    const artist = album?.artists as any;
    const stats = trackStatsMap.get(e.id) as any;
    return {
      id: e.id,
      type: 'track',
      href: `/track-diary/${e.id}`,
      title: track?.title || 'Inconnu',
      subtitle: artist?.name || 'Inconnu',
      artist_id: artist?.id || '',
      cover_url: album?.cover_url || null,
      rating: e.rating,
      review_body: e.review_body,
      listened_at: e.listened_at,
      created_at: e.created_at,
      likes_count: stats?.likes_count ?? 0,
      comments_count: stats?.comments_count ?? 0,
      is_liked: trackLikedIds.has(e.id),
    };
  });

  return [...albumItems, ...trackItems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ============================================================================
// ALBUM REVIEWS (for album page + reviews modal)
// ============================================================================

export type AlbumReview = {
  id: string;
  user_id: string;
  rating: number | null;
  review_body: string | null;
  created_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type AlbumReviewsTab = 'all' | 'friends' | 'my';

export async function getAlbumReviewsPreview(
  albumId: string,
  limit: number = 3
): Promise<AlbumReview[]> {
  const supabase = await createSupabaseServer();

  const { data: rows, error } = await supabase
    .from('diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('album_id', albumId)
    .not('review_body', 'is', null)
    .neq('review_body', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !rows) {
    console.error('getAlbumReviewsPreview error:', error);
    return [];
  }

  const userIds = [...new Set(rows.map((row: any) => row.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map(
    (profilesData || []).map((p: any) => [p.id, p])
  );

  return rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    rating: row.rating,
    review_body: row.review_body,
    created_at: row.created_at,
    display_name: profilesMap.get(row.user_id)?.display_name || null,
    username: profilesMap.get(row.user_id)?.username || null,
    avatar_url: profilesMap.get(row.user_id)?.avatar_url || null,
  }));
}

export async function getAlbumReviewsPage(input: {
  albumId: string;
  tab: AlbumReviewsTab;
  offset?: number;
  limit?: number;
  orderBy?: 'recent' | 'top';
}): Promise<{ items: AlbumReview[]; hasMore: boolean; userId: string | null; hasFollowing: boolean }> {
  const { albumId, tab, offset = 0, limit = 12, orderBy = 'recent' } = input;
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  let followingIds: string[] = [];
  let hasFollowing = false;
  if (currentUser) {
    const { data: follows } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', currentUser.id);
    followingIds = (follows || []).map((f: any) => f.followee_id);
    hasFollowing = followingIds.length > 0;
  }

  if ((tab === 'friends' || tab === 'my') && !currentUser) {
    return { items: [], hasMore: false, userId: null, hasFollowing };
  }

  if (tab === 'friends' && !hasFollowing) {
    return { items: [], hasMore: false, userId: currentUser?.id || null, hasFollowing };
  }

  let query = supabase
    .from('diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('album_id', albumId)
    .not('review_body', 'is', null)
    .neq('review_body', '');

  if (orderBy === 'top') {
    query = query.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (tab === 'my' && currentUser) {
    query = query.eq('user_id', currentUser.id);
  } else if (tab === 'friends' && hasFollowing) {
    query = query.in('user_id', followingIds);
  }

  const { data: rows, error } = await query.range(offset, offset + limit);

  if (error || !rows) {
    console.error('getAlbumReviewsPage error:', error);
    return { items: [], hasMore: false, userId: currentUser?.id || null, hasFollowing };
  }

  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  const userIds = [...new Set(sliced.map((row: any) => row.user_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map(
    (profilesData || []).map((p: any) => [p.id, p])
  );

  return {
    items: sliced.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      rating: row.rating,
      review_body: row.review_body,
      created_at: row.created_at,
      display_name: profilesMap.get(row.user_id)?.display_name || null,
      username: profilesMap.get(row.user_id)?.username || null,
      avatar_url: profilesMap.get(row.user_id)?.avatar_url || null,
    })),
    hasMore,
    userId: currentUser?.id || null,
    hasFollowing,
  };
}

// ============================================================================
// DIARY ENTRY DETAIL (for /diary/[entry_id] page)
// ============================================================================

export type DiaryEntryComment = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  is_mine: boolean;
  replies: DiaryEntryComment[];
};

export type DiaryEntryDetail = {
  id: string;
  rating: number | null;
  review_title: string | null;
  review_body: string | null;
  listened_at: string;
  re_listen: boolean;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  album: {
    id: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
  };
  artist: {
    id: string;
    name: string;
  };
  stats: {
    likes_count: number;
    comments_count: number;
  };
  has_liked: boolean;
  comments: DiaryEntryComment[];
};

export type GetDiaryEntryResult =
  | { success: true; data: DiaryEntryDetail }
  | { success: false; error: string };

/**
 * Get full diary entry details for /diary/[entry_id] page
 * Respects RLS: public entries OR private entries owned by current user
 */
export async function getDiaryEntry(entryId: string): Promise<GetDiaryEntryResult> {
  try {
    const supabase = await createSupabaseServer();
    const currentUser = await getAuthUser();

    // Fetch diary entry with author, album, artist
    const { data: entry, error: entryError } = await supabase
      .from('diary_entries')
      .select(`
        id,
        rating,
        review_title,
        review_body,
        listened_at,
        re_listen,
        is_public,
        user_id,
        albums (
          id,
          title,
          cover_url,
          release_date,
          artists (
            id,
            name
          )
        )
      `)
      .eq('id', entryId)
      .maybeSingle();

    if (entryError || !entry) {
      return { success: false, error: 'Entry not found' };
    }

    // RLS check: public or owned by current user
    if (!entry.is_public && entry.user_id !== currentUser?.id) {
      return { success: false, error: 'Entry not found' };
    }

    // Fetch author profile
    const { data: authorProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', entry.user_id)
      .maybeSingle();

    if (profileError || !authorProfile) {
      return { success: false, error: 'Author not found' };
    }

    // Fetch stats from view
    const { data: statsData } = await supabase
      .from('diary_entry_stats')
      .select('likes_count, comments_count')
      .eq('entry_id', entryId)
      .maybeSingle();

    const stats = {
      likes_count: statsData?.likes_count || 0,
      comments_count: statsData?.comments_count || 0,
    };

    // Check if current user has liked
    let hasLiked = false;
    if (currentUser) {
      const { data: likeData } = await supabase
        .from('diary_likes')
        .select('user_id')
        .eq('entry_id', entryId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      hasLiked = !!likeData;
    }

    // Fetch comments — RLS patch (Phase 1) enforces parent-entry visibility
    const { data: commentsData } = await supabase
      .from('diary_comments')
      .select('id, body, created_at, user_id, parent_comment_id')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true });

    // Batch-fetch profiles for comment authors
    const commentUserIds = [...new Set((commentsData || []).map((c) => c.user_id))];
    const { data: commentProfiles } = commentUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', commentUserIds)
      : { data: [] };

    const commentProfilesMap = new Map(
      (commentProfiles || []).map((p) => [p.id, p])
    );

    const allComments: DiaryEntryComment[] = (commentsData || []).map((c) => {
      const profile = commentProfilesMap.get(c.user_id);
      return {
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        parent_comment_id: c.parent_comment_id ?? null,
        author: {
          id: c.user_id,
          username: profile?.username || 'unknown',
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
        },
        is_mine: currentUser?.id === c.user_id,
        replies: [],
      };
    });

    // Build tree: attach replies to their parent
    const commentMap = new Map(allComments.map((c) => [c.id, c]));
    const comments: DiaryEntryComment[] = [];
    for (const comment of allComments) {
      if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
        commentMap.get(comment.parent_comment_id)!.replies.push(comment);
      } else {
        comments.push(comment);
      }
    }

    const album = entry.albums as any;
    const artist = album?.artists as any;

    return {
      success: true,
      data: {
        id: entry.id,
        rating: entry.rating,
        review_title: entry.review_title,
        review_body: entry.review_body,
        listened_at: entry.listened_at,
        re_listen: entry.re_listen,
        author: {
          id: authorProfile.id,
          username: authorProfile.username || 'unknown',
          display_name: authorProfile.display_name,
          avatar_url: authorProfile.avatar_url,
        },
        album: {
          id: album?.id || '',
          title: album?.title || 'Unknown Album',
          cover_url: album?.cover_url || null,
          release_date: album?.release_date || null,
        },
        artist: {
          id: artist?.id || '',
          name: artist?.name || 'Unknown Artist',
        },
        stats,
        has_liked: hasLiked,
        comments,
      },
    };
  } catch (err) {
    console.error('getDiaryEntry error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Get the most recent diary entry for a given album by the current user.
 * Used on the /add page to detect re-listens and show previous rating.
 */
export async function getLatestDiaryEntryForAlbum(
  albumId: string
): Promise<{ rating: number | null; listenedAt: string } | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from('diary_entries')
    .select('rating, listened_at')
    .eq('user_id', user.id)
    .eq('album_id', albumId)
    .order('listened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    rating: data.rating ?? null,
    listenedAt: data.listened_at,
  };
}
