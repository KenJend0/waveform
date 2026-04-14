'use server';

import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { fetchCoverUrl } from '@/app/actions/musicbrainz';

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

/** Rafraîchit la cover d'un album depuis CoverArt Archive.
 *  Essaie d'abord l'endpoint release-group (mbid actuel), puis release en fallback
 *  car les vieux albums peuvent avoir un release MBID stocké au lieu du release-group MBID.
 */
export async function refreshAlbumCover(albumId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return { success: false, error: 'Non autorisé' };

  const supabase = createSupabaseAdmin();
  const { data: album } = await supabase
    .from('albums')
    .select('mbid')
    .eq('id', albumId)
    .maybeSingle();

  if (!album?.mbid) return { success: false, error: 'Pas de MBID pour cet album' };

  // Essai 1 : release-group (cas nominal pour les imports récents)
  let coverUrl = await fetchCoverUrl(album.mbid, 'release-group');
  // Essai 2 : release (cas des vieux imports où le MBID stocké est celui d'une release)
  if (!coverUrl) coverUrl = await fetchCoverUrl(album.mbid, 'release');

  if (!coverUrl) return { success: false, error: 'Cover introuvable sur CoverArt Archive' };

  const { error } = await supabase
    .from('albums')
    .update({ cover_url: coverUrl })
    .eq('id', albumId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/albums/${albumId}`);
  return { success: true };
}

/** Enregistre manuellement les liens de streaming (Spotify, Apple Music, Deezer). */
export async function setAlbumStreamingUrls(
  albumId: string,
  urls: { spotify: string | null; appleMusic: string | null; deezer: string | null }
): Promise<boolean> {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) return false;

  const supabase = createSupabaseAdmin();
  await supabase
    .from('album_metadata')
    .upsert(
      {
        album_id: albumId,
        spotify_url: urls.spotify ?? null,
        apple_music_url: urls.appleMusic ?? null,
        deezer_url: urls.deezer ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'album_id' }
    );

  revalidatePath('/admin');
  return true;
}
