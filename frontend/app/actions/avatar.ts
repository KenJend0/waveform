'use server';

import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';

/**
 * Create signed upload URL for avatar
 * Returns Supabase Storage signed URL + path
 */
export async function createAvatarUpload() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createSupabaseServer();

    // Generate unique filename: user_id/avatar_timestamp.jpg
    const filename = `${user.id}/avatar_${Date.now()}.jpg`;
    const bucketName = 'avatars';

    // Create signed upload URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filename, {
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      uploadUrl: data.signedUrl,
      path: filename,
      bucketName,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Confirm avatar upload + update profile
 * Called after successful file upload to Storage
 */
export async function confirmAvatarUpload(path: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createSupabaseServer();

    // Generate public URL (Supabase Storage)
    const bucketName = 'avatars';
    const avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${path}`;

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, avatarUrl };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Delete avatar (owner only)
 * Removes from Storage + clears profile.avatar_url
 */
export async function deleteMyAvatar() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createSupabaseServer();

    // Get current avatar URL
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.avatar_url) {
      return { success: false, error: 'No avatar found' };
    }

    // Extract path from URL: ...avatars/user_id/avatar_xxx.jpg
    const avatarUrl = profile.avatar_url;
    const bucketName = 'avatars';

    // Parse path from URL
    const urlParts = avatarUrl.split(`/${bucketName}/`);
    if (urlParts.length < 2) {
      return { success: false, error: 'Invalid avatar URL' };
    }

    const filePath = urlParts[1];

    // Delete from Storage
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Clear profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
