'use server';

import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
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

    if (idOrUsername.startsWith('user_') || idOrUsername.length === 36) {
      // Looks like UUID
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
    return { success: false, error: String(err) };
  }
}

// Ajouter un commentaire
