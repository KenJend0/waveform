'use server';

import { getAuthUser, createSupabaseServer } from '@/lib/supabase/server';
import { checkActionRateLimit } from '@/lib/serverRateLimit';

export type SavedAlbumUI = {
  id: string;
  album_id: string;
  album_title: string;
  artist_id: string;
  artist_name: string;
  cover_url: string | null;
  release_date: string | null;
  saved_at: string;
};

/**
 * Get user saved albums
 */
export async function getUserSavedAlbums(
  userId: string,
  limit?: number
): Promise<SavedAlbumUI[]> {
  const user = await getAuthUser();
  if (!user || user.id !== userId) return [];

  const supabase = await createSupabaseServer();
  const safeLimit = typeof limit === 'number' ? Math.min(Math.max(limit, 1), 100) : undefined;

  // albums.type n'est pas dans les types générés (colonne ajoutée hors migration suivie) — cast en any.
  let query = (supabase as any)
    .from('saved_albums')
    .select(`
      id,
      album_id,
      saved_at,
      albums (
        id,
        title,
        cover_url,
        release_date,
        type,
        artist_id,
        artists (
          id,
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (safeLimit) {
    query = query.limit(safeLimit);
  }

  const { data: saved, error } = await query;

  if (error || !saved) {
    console.error('getUserSavedAlbums error:', error);
    return [];
  }

  type SavedAlbumRow = {
    id: string;
    album_id: string;
    saved_at: string;
    albums: { id: string; title: string; cover_url: string | null; release_date: string | null; type: string | null; artist_id: string; artists?: { id: string; name: string } } | null;
  };

  return (saved as SavedAlbumRow[]).filter((s) => s.albums?.type !== 'Single').map((s) => {
    const album = s.albums;
    const artist = album?.artists;
    return {
      id: s.id,
      album_id: s.album_id,
      album_title: album?.title || 'Unknown',
      artist_id: album?.artist_id || '',
      artist_name: artist?.name || 'Unknown',
      cover_url: album?.cover_url || null,
      release_date: album?.release_date || null,
      saved_at: s.saved_at,
    };
  });
}

/**
 * Toggle save album (add/remove from "À écouter" list)
 */
export async function toggleSaveAlbum(albumId: string): Promise<{ saved: boolean }> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const rlError = await checkActionRateLimit(user.id, 'save');
  if (rlError) throw new Error(rlError);

  const supabase = await createSupabaseServer();

  // Check if already saved
  const { data: existing } = await supabase
    .from('saved_albums')
    .select('id')
    .eq('user_id', user.id)
    .eq('album_id', albumId)
    .maybeSingle();

  if (existing) {
    // Remove
    await supabase
      .from('saved_albums')
      .delete()
      .eq('user_id', user.id)
      .eq('album_id', albumId);
    return { saved: false };
  } else {
    // Add
    await supabase.from('saved_albums').insert({
      user_id: user.id,
      album_id: albumId,
    });

    return { saved: true };
  }
}

/**
 * Save album to library if not already saved (idempotent, no toggle).
 * Used by the import flow to auto-add to the "à écouter" list.
 */
export async function saveAlbumOnce(albumId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createSupabaseServer();

  const { data: existing } = await supabase
    .from('saved_albums')
    .select('id')
    .eq('user_id', user.id)
    .eq('album_id', albumId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('saved_albums').insert({
      user_id: user.id,
      album_id: albumId,
    });
  }
}

/**
 * Check if album is saved by current user.
 * Accepts an optional userId to avoid a redundant getAuthUser() call when the caller already has the user.
 */
export async function isAlbumSaved(albumId: string, userId?: string): Promise<boolean> {
  const resolvedUserId = userId ?? (await getAuthUser())?.id;
  if (!resolvedUserId) return false;

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('saved_albums')
    .select('id')
    .eq('user_id', resolvedUserId)
    .eq('album_id', albumId)
    .maybeSingle();

  return !!data;
}
