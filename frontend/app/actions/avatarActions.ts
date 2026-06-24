'use server';

import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import sharp from 'sharp';

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

    const MAX_SIZE = 3 * 1024 * 1024; // 3 MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Invalid file type — JPEG, PNG or WebP only');
    }
    if (file.size > MAX_SIZE) {
      throw new Error('File too large — max 3 MB');
    }

    const arrayBuffer = await file.arrayBuffer();
    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await sharp(Buffer.from(arrayBuffer))
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new Error('Invalid image file');
    }

    // Use admin client to bypass Storage RLS
    const admin = createSupabaseAdmin();

    const { error: uploadError } = await admin.storage
      .from('avatars')
      .upload(`${userId}.jpg`, jpegBuffer, {
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage
      .from('avatars')
      .getPublicUrl(`${userId}.jpg`);

    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // Update profiles.avatar_url (admin bypasses RLS)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { ok: true, avatarUrl };
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    const msg = error?.message || 'Failed to upload avatar';
    return { ok: false, error: msg };
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
    return { ok: false, error: 'Failed to delete avatar' };
  }
}
