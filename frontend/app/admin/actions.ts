'use server';

import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import { enrichAlbumMetadata } from '@/app/actions/metadata';
import { revalidatePath } from 'next/cache';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export async function reEnrichAlbum(formData: FormData) {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return;

  const albumId = formData.get('albumId') as string;
  const mbid = formData.get('mbid') as string;
  const title = formData.get('title') as string;
  const artist = formData.get('artist') as string;

  if (!albumId || !mbid) return;

  const supabase = createSupabaseAdmin();

  // Supprime les métadonnées existantes pour bypasser le TTL
  await Promise.all([
    supabase.from('album_metadata').delete().eq('album_id', albumId),
    supabase.from('album_genres').delete().eq('album_id', albumId).eq('source', 'lastfm'),
    supabase.from('album_genres').delete().eq('album_id', albumId).eq('source', 'musicbrainz'),
  ]);

  await enrichAlbumMetadata(albumId, mbid, title, artist);
  revalidatePath('/admin');
}
