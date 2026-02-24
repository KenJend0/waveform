'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { fanoutEvent } from './feed';
import { ensureProfile } from './profile';

/**
 * Toggle follow: insert if not exists, delete if exists
 * Resolve idOrUsername to profile.id
 * Prevent self-follow
 */
export async function toggleFollow(idOrUsername: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

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
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'User not found' };
      }

      targetId = profile.id;
    }

    // Prevent self-follow
    if (targetId === user.id) {
      return { success: false, error: 'Cannot follow yourself' };
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('followee_id', targetId)
      .single();

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
        await fanoutEvent('follow', { followerId: user.id, followeeId: targetId }, [
          targetId,
        ]);
      } catch (fanoutErr) {
        console.error('Fanout follow error:', fanoutErr);
      }

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

  // Fetch already-followed user IDs to exclude them
  const { data: followed } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id);

  const followedIds = new Set<string>((followed || []).map((f) => f.followee_id));

  // Users with recent public activity, deduped and not already followed
  const { data: recentEntries } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('is_public', true)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const suggestedIds: string[] = [];
  if (recentEntries?.length) {
    const seen = new Set<string>();
    for (const entry of recentEntries) {
      if (
        !seen.has(entry.user_id) &&
        !followedIds.has(entry.user_id) &&
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

  // Fallback: recently joined users not already followed
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', user.id)
    .not('username', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit + followedIds.size);

  return ((profiles as SuggestedUser[]) || [])
    .filter((p) => !followedIds.has(p.id))
    .slice(0, limit);
}

// Ajouter un commentaire
