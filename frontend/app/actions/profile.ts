'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { findBannedUsernameWord } from '@/lib/bannedWords';

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,32}$/;

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
      .select('id, username, bio, avatar_url')
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

    // Si pas de profil, créer avec upsert (ignoreDuplicates protège contre les race conditions)
    const defaultUsername = user.id.substring(0, 8);

    await supabase
      .from('profiles')
      .upsert({ id: user.id, username: defaultUsername }, { onConflict: 'id', ignoreDuplicates: true });

    const { data: newProfile, error: selectError2 } = await supabase
      .from('profiles')
      .select('id, username, bio, avatar_url')
      .eq('id', user.id)
      .single();

    if (selectError2) throw selectError2;

    return {
      ok: true,
      profile: newProfile,
      created: true,
    };
  } catch (error: any) {
    console.error('Error ensuring profile:', error);
    return {
      ok: false,
      error: 'An error occurred',
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
      return { ok: false, error: 'An error occurred' };
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
  bio?: string | null;
}) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  const bio = input.bio ?? null;

  if (bio && bio.length > 500) {
    return { ok: false, error: 'bio_too_long' };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ bio })
    .eq('id', user.id);

  if (error) {
    return { ok: false, error: 'An error occurred' };
  }

  revalidatePath('/me');
  revalidatePath('/settings');

  return { ok: true };
}

/**
 * Sets the username during onboarding without consuming the one-time username change right.
 * Only works if the user still has the auto-generated UUID-based username.
 */
export async function setOnboardingUsername(newUsername: string) {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const trimmed = newUsername.trim();
  if (!USERNAME_REGEX.test(trimmed)) return { ok: false, error: 'invalid_username' };
  if (findBannedUsernameWord(trimmed)) return { ok: false, error: 'Ce pseudo contient du contenu inapproprié.' };

  const supabase = await createSupabaseServer();

  // Only allowed if still on the auto-generated username
  const { data: current } = await supabase
    .from('profiles')
    .select('username, username_changed')
    .eq('id', user.id)
    .maybeSingle();

  if ((current as any)?.username_changed) {
    return { ok: false, error: 'already_onboarded' };
  }

  // Check availability
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmed)
    .neq('id', user.id)
    .maybeSingle();

  if (existing) return { ok: false, error: 'username_taken' };

  // Set username but do NOT set username_changed — preserves the user's one-time change right
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ username: trimmed })
    .eq('id', user.id);

  if (updateError) return { ok: false, error: 'An error occurred' };

  // No revalidatePath here — would trigger a server component re-render during the onboarding
  // flow, causing the page to redirect to /feed before the user finishes.
  return { ok: true, username: trimmed };
}

export async function checkUsernameAvailability(username: string) {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: 'not_authenticated' };
  }

  if (!USERNAME_REGEX.test(username)) {
    return { ok: true, available: false, error: 'invalid_username' };
  }
  if (findBannedUsernameWord(username)) {
    return { ok: true, available: false, error: 'username_banned' };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return { ok: false, error: 'An error occurred' };
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
  if (findBannedUsernameWord(trimmed)) return { ok: false, error: 'Ce pseudo contient du contenu inapproprié.' };

  const supabase = await createSupabaseServer();

  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('username, username_changed')
    .eq('id', user.id)
    .maybeSingle();

  // Ignore error if username_changed column doesn't exist
  if (currentError && currentError.code !== 'PGRST116' && !currentError.message?.includes('username_changed')) {
    return { ok: false, error: 'An error occurred' };
  }

  if ((current as any)?.username_changed) {
    return { ok: false, error: 'username_change_already_used' };
  }

  if ((current as any)?.username && (current as any).username === trimmed) {
    return { ok: false, error: 'username_same' };
  }

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', trimmed)
    .neq('id', user.id)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    return { ok: false, error: 'An error occurred' };
  }

  if (existing) {
    return { ok: false, error: 'username_taken' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ username: trimmed, username_changed: true })
    .eq('id', user.id);

  if (updateError) {
    return { ok: false, error: 'An error occurred' };
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

    const supabaseAdmin = createSupabaseAdmin();

    // Remove avatar from Storage before cascading the account deletion
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.avatar_url) {
      await supabaseAdmin.storage
        .from('avatars')
        .remove([`${user.id}.jpg`]);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: 'An error occurred' };

    return { ok: true };
  } catch (err) {
    console.error('deleteAccount error:', err);
    return { ok: false, error: 'An error occurred' };
  }
}

