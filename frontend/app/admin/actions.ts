'use server';

import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Supprime les métadonnées existantes pour bypasser le TTL — l'enrichissement est déclenché côté client via /api/enrich */
export async function clearAlbumMetadata(albumId: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return false;

  const supabase = createSupabaseAdmin();
  await Promise.all([
    supabase.from('album_metadata').delete().eq('album_id', albumId),
    supabase.from('album_genres').delete().eq('album_id', albumId),
  ]);

  return true;
}

/** Enregistre manuellement un lien Spotify pour un album. */
export async function setAlbumSpotifyUrl(albumId: string, spotifyUrl: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return false;

  const supabase = createSupabaseAdmin();
  await supabase
    .from('album_metadata')
    .upsert(
      { album_id: albumId, spotify_url: spotifyUrl || null, fetched_at: new Date().toISOString() },
      { onConflict: 'album_id' }
    );

  revalidatePath('/admin');
  return true;
}
