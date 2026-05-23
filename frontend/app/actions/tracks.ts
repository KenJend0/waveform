'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export type AlbumTrackItem = {
  id: string;
  title: string;
  track_no: number | null;
  disc_no: number | null;
  duration_ms: number | null;
};

export type TrackDetail = {
  id: string;
  title: string;
  duration_ms: number | null;
  track_no: number | null;
  disc_no: number | null;
  mbid: string | null;
  album_id: string;
  album_title: string;
  album_type: string;
  cover_url: string | null;
  release_date: string | null;
  artist_id: string;
  artist_name: string;
};

export async function getTrack(id: string): Promise<TrackDetail | null> {
  const supabase = await createSupabaseServer();

  const { data, error } = await (supabase as any)
    .from('tracks')
    .select(`
      id,
      title,
      duration_ms,
      track_no,
      disc_no,
      mbid,
      album_id,
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
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const album = data.albums as any;
  const artist = album?.artists as any;

  return {
    id: data.id,
    title: data.title,
    duration_ms: data.duration_ms ?? null,
    track_no: data.track_no ?? null,
    disc_no: data.disc_no ?? null,
    mbid: data.mbid ?? null,
    album_id: album?.id || data.album_id,
    album_title: album?.title || 'Inconnu',
    album_type: album?.type || 'Album',
    cover_url: album?.cover_url || null,
    release_date: album?.release_date || null,
    artist_id: artist?.id || album?.artist_id || '',
    artist_name: artist?.name || 'Inconnu',
  };
}

export async function getAlbumTracks(albumId: string): Promise<AlbumTrackItem[]> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('tracks')
    .select('id, title, track_no, disc_no, duration_ms')
    .eq('album_id', albumId)
    .order('disc_no', { ascending: true, nullsFirst: true })
    .order('track_no', { ascending: true, nullsFirst: true });

  if (error || !data) return [];
  return data as AlbumTrackItem[];
}
