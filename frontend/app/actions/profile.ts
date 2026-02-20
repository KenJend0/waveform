'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{2,32}$/;

/**
 * Ensures a user profile exists in the database
 * Creates a default profile if none exists (first login)
 * 
 * Returns deterministic defaults consistent across calls:
 * - username: First 8 chars of UUID (deterministic, no conflicts)
 * - display_name: From user metadata, email prefix, or "User"
 */
export async function ensureProfile() {
  try {
    // Get authenticated user via server-side session
    const user = await getAuthUser();

    if (!user) {
      return {
        ok: false,
        error: 'Not authenticated',
      };
    }

    const supabase = await createSupabaseServer();

    // Check if profile exists
    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    // If exists, return it
    if (existing) {
      return {
        ok: true,
        profile: existing,
        created: false,
      };
    }

    // If not, create it with deterministic defaults
    const email = user.email || '';
    const defaultUsername = user.id.substring(0, 8); // First 8 chars of UUID
    
    // Try to get display_name from Supabase user metadata first
    let defaultDisplayName = email.split('@')[0] || 'User'; // Email prefix as fallback
    if ((user.user_metadata as any)?.display_name) {
      defaultDisplayName = (user.user_metadata as any).display_name;
    }

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: defaultUsername,
        display_name: defaultDisplayName,
      })
      .select('id, username, display_name, bio, avatar_url')
      .single();

    if (insertError) {
      throw insertError;
    }

    return {
      ok: true,
      profile: newProfile,
      created: true,
    };
  } catch (error: any) {
    console.error('Error ensuring profile:', error);
    return {
      ok: false,
      error: error.message || 'Failed to ensure profile',
    };
  }
}

type ProfileSettings = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  username_changed: boolean | null;
  email: string;
};

export async function getMyProfileSettings() {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  const supabase = await createSupabaseServer();

  // Try with username_changed first; fall back without it if column doesn't exist
  let data: any = null;
  let usernameChanged: boolean | null = null;

  const { data: fullData, error: fullError } = await supabase
    .from('profiles')
    .select('id, display_name, username, bio, avatar_url, username_changed')
    .eq('id', user.id)
    .maybeSingle();

  if (fullError && fullError.code !== 'PGRST116') {
    // Likely the column doesn't exist — retry without it
    const { data: partialData, error: partialError } = await supabase
      .from('profiles')
      .select('id, display_name, username, bio, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (partialError && partialError.code !== 'PGRST116') {
      return { ok: false, error: partialError.message };
    }
    data = partialData;
  } else {
    data = fullData;
    usernameChanged = (fullData as any)?.username_changed ?? null;
  }

  const profile: ProfileSettings = {
    id: data?.id || user.id,
    display_name: data?.display_name ?? null,
    username: data?.username ?? null,
    bio: data?.bio ?? null,
    avatar_url: data?.avatar_url ?? null,
    username_changed: usernameChanged,
    email: user.email || '',
  };

  return { ok: true, profile };
}

export async function updateProfileSettings(input: {
  display_name?: string | null;
  bio?: string | null;
}) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  const displayName = input.display_name ?? null;
  const bio = input.bio ?? null;

  if (displayName && displayName.length > 255) {
    return { ok: false, error: 'display_name_too_long' };
  }
  if (bio && bio.length > 500) {
    return { ok: false, error: 'bio_too_long' };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      bio: bio,
    })
    .eq('id', user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/me');
  revalidatePath('/settings');

  return { ok: true };
}

export async function checkUsernameAvailability(username: string) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return { ok: true, available: false, error: 'invalid_username' };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return { ok: false, error: error.message };
  }

  return { ok: true, available: !data };
}

export async function changeUsername(newUsername: string) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  const trimmed = newUsername.trim();

  if (!USERNAME_REGEX.test(trimmed)) {
    return { ok: false, error: 'invalid_username' };
  }

  const supabase = await createSupabaseServer();

  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('username, username_changed')
    .eq('id', user.id)
    .maybeSingle();

  // Ignore error if username_changed column doesn't exist
  if (currentError && currentError.code !== 'PGRST116' && !currentError.message?.includes('username_changed')) {
    return { ok: false, error: currentError.message };
  }

  if ((current as any)?.username_changed) {
    return { ok: false, error: 'username_change_already_used' };
  }

  if (current?.username && current.username === trimmed) {
    return { ok: false, error: 'username_same' };
  }

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmed)
    .neq('id', user.id)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    return { ok: false, error: existingError.message };
  }

  if (existing) {
    return { ok: false, error: 'username_taken' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ username: trimmed, username_changed: true })
    .eq('id', user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath('/me');
  revalidatePath('/settings');

  return { ok: true, username: trimmed };
}

/**
 * Permanently delete the authenticated user's account.
 * Cascades via DB: auth.users → profiles → all user data.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { ok: false, error: 'not_authenticated' };

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

