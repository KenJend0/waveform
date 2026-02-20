'use server';

import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';

export async function uploadAvatar(
  userId: string,
  formData: FormData
) {
  try {
    // Verify the caller is the actual authenticated user
    const user = await getAuthUser();
    if (!user || user.id !== userId) {
      throw new Error('Not authorized');
    }

    const file = formData.get('file') as File | null;
    if (!file) throw new Error('No file provided');

    const arrayBuffer = await file.arrayBuffer();

    // Use admin client to bypass Storage RLS
    const admin = createSupabaseAdmin();

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(`${userId}.jpg`, arrayBuffer, {
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage
      .from('avatars')
      .getPublicUrl(`${userId}.jpg`);

    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    // Update profiles.avatar_url (admin bypasses RLS)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { ok: true, avatarUrl: urlData.publicUrl };
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    return { ok: false, error: error.message || 'Failed to upload avatar' };
  }
}

export async function deleteAvatar(userId: string) {
  try {
    const user = await getAuthUser();
    if (!user || user.id !== userId) {
      throw new Error('Not authorized');
    }

    const admin = createSupabaseAdmin();

    const { error: deleteError } = await admin.storage
      .from('avatars')
      .remove([`${userId}.jpg`]);

    if (deleteError) throw deleteError;

    const { error: updateError } = await admin
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { ok: true };
  } catch (error: any) {
    console.error('Avatar delete error:', error);
    return { ok: false, error: error.message || 'Failed to delete avatar' };
  }
}
