'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { fanoutEvent, backfillFolloweeEvents } from './feed';
import { ensureProfile } from './profile';
import { logAuthedProductEvent } from '@/lib/productEvents';
import { checkActionRateLimit } from '@/lib/serverRateLimit';

/**
 * Toggle follow: insert if not exists, delete if exists
 * Resolve idOrUsername to profile.id
 * Prevent self-follow
 */
export async function toggleFollow(idOrUsername: string, source?: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const rlError = await checkActionRateLimit(user.id, 'follow');
    if (rlError) return { success: false, error: rlError };

    // Ensure current user's profile exists
    await ensureProfile();

    const supabase = await createSupabaseServer();

    // Resolve username/id to profile id
    let targetId: string;

    // Detect UUIDs with a regex instead of brittle length/startsWith heuristics.
    // Supabase UUIDs follow the standard 8-4-4-4-12 hex format.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUsername)) {
      targetId = idOrUsername;
    } else {
      // Resolve by username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', idOrUsername)
        .maybeSingle();

      if (profileError || !profile) {
        return { success: false, error: 'User not found' };
      }

      targetId = profile.id;
    }

    // Prevent self-follow
    if (targetId === user.id) {
      return { success: false, error: 'Cannot follow yourself' };
    }

    // Prevent following a blocked user (or a user who blocked you)
    const { data: blockCheck } = await (supabase as any)
      .from('user_blocks')
      .select('blocker_id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${user.id})`)
      .limit(1);

    if (blockCheck && blockCheck.length > 0) {
      return { success: false, error: 'Action impossible' };
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('followee_id', targetId)
      .maybeSingle();

    const supabaseAdmin = createSupabaseAdmin();

    if (existing) {
      // Unfollow
      const { error: deleteError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followee_id', targetId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // Clean up all follow feed events for this pair (actor + followee)
      await supabaseAdmin
        .from('feed_events')
        .delete()
        .eq('type', 'follow')
        .eq('actor_id', user.id)
        .eq('followee_id', targetId);

      return { success: true, following: false };
    } else {
      // Follow
      const { error: insertError } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          followee_id: targetId,
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      // Remove any stale follow events for this pair before inserting fresh ones
      await supabaseAdmin
        .from('feed_events')
        .delete()
        .eq('type', 'follow')
        .eq('actor_id', user.id)
        .eq('followee_id', targetId);

      // Fanout
      try {
        await Promise.all([
          fanoutEvent('follow', { followerId: user.id, followeeId: targetId }, [targetId]),
          backfillFolloweeEvents(user.id, targetId),
        ]);
      } catch (fanoutErr) {
        console.error('Fanout follow error:', fanoutErr);
      }

      await logAuthedProductEvent('user_followed', {
        surface: source ?? 'follow_button',
        properties: {
          target_id: targetId,
        },
      });

      return { success: true, following: true };
    }
  } catch (err) {
    console.error('toggleFollow error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

export type SuggestedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Returns up to `limit` suggested profiles to follow.
 * Prioritises users with recent public diary entries.
 * Excludes the current user and users already followed.
 */
export async function getSuggestedUsers(limit = 5): Promise<SuggestedUser[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = await createSupabaseServer();

  // Fetch already-followed and blocked user IDs to exclude them
  const [{ data: followed }, { data: blocked }] = await Promise.all([
    supabase.from('follows').select('followee_id').eq('follower_id', user.id),
    (supabase as any).from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
  ]);

  const followedIds = new Set<string>((followed || []).map((f) => f.followee_id));
  const blockedIds = new Set<string>(((blocked || []) as Array<{ blocked_id: string }>).map((b) => b.blocked_id));

  // Users with recent public activity, deduped and not already followed
  const { data: recentEntries } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const excludedIds = new Set([...followedIds, ...blockedIds]);

  const suggestedIds: string[] = [];
  if (recentEntries?.length) {
    const seen = new Set<string>();
    for (const entry of recentEntries) {
      if (
        !seen.has(entry.user_id) &&
        !excludedIds.has(entry.user_id) &&
        suggestedIds.length < limit
      ) {
        seen.add(entry.user_id);
        suggestedIds.push(entry.user_id);
      }
    }
  }

  if (suggestedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', suggestedIds)
      .not('username', 'is', null);
    return (profiles as SuggestedUser[]) || [];
  }

  // Fallback: recently joined users not already followed or blocked
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', user.id)
    .not('username', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit + excludedIds.size);

  return ((profiles as SuggestedUser[]) || [])
    .filter((p) => !excludedIds.has(p.id))
    .slice(0, limit);
}

/**
 * Toggle block: block if not blocked, unblock if already blocked.
 * Blocking also removes any follows between the two users.
 */
export async function toggleBlock(userId: string): Promise<{ success: boolean; blocking?: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    if (userId === user.id) return { success: false, error: 'Cannot block yourself' };

    const rlError = await checkActionRateLimit(user.id, 'block');
    if (rlError) return { success: false, error: rlError };

    const supabase = await createSupabaseServer();

    const { data: existing } = await (supabase as any)
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .maybeSingle();

    if (existing) {
      // Unblock
      await (supabase as any)
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      return { success: true, blocking: false };
    } else {
      // Block
      const { error: blockError } = await (supabase as any)
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: userId });

      if (blockError) return { success: false, error: blockError.message };

      // Remove follows in both directions
      await supabase
        .from('follows')
        .delete()
        .or(`and(follower_id.eq.${user.id},followee_id.eq.${userId}),and(follower_id.eq.${userId},followee_id.eq.${user.id})`);

      // Clean up feed events from blocked user
      const supabaseAdmin = createSupabaseAdmin();
      await supabaseAdmin
        .from('feed_events')
        .delete()
        .eq('user_id', user.id)
        .eq('actor_id', userId);

      return { success: true, blocking: true };
    }
  } catch (err) {
    console.error('toggleBlock error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

// Ajouter un commentaire
