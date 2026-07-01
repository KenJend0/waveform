'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export type StatsEntry = {
  album_id: string;
  listened_at: string;
  rating: number | null;
  album_title: string;
  artist_id: string;
  artist_name: string;
};

export type StatsGenreEntry = {
  album_id: string;
  genre_slug: string;
  weight: number;
};

export type AnglesMortsAlbum = {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string | null;
  mbid: string | null;
  avg_rating: number;
};

export type StatsData = {
  entries: StatsEntry[];
  genreData: StatsGenreEntry[];
  anglesMorts: AnglesMortsAlbum[];
};

export async function getUserStatsData(userId: string): Promise<StatsData> {
  const supabase = await createSupabaseServer();

  // 1. Fetch diary entries + genres + angles morts in parallel
  //    Uses idx_diary_entries_user_listened (user_id, listened_at DESC)
  //    Uses idx_album_genres_album_id
  //    Uses get_angles_morts RPC (idx_album_stats_mat_rated + NOT EXISTS via idx_diary_entries_album_user)
  const [entriesResult, anglesMortsResult] = await Promise.all([
    supabase
      .from('diary_entries')
      .select(`
        album_id,
        listened_at,
        rating,
        albums (
          id,
          title,
          artists ( id, name )
        )
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: true }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('get_angles_morts', {
      p_user_id: userId,
      p_min_rating: 7.0,
      p_min_listeners: 5,
      p_limit: 5,
    }),
  ]);

  const entries: StatsEntry[] = (entriesResult.data ?? []).map((e: any) => ({
    album_id: e.album_id,
    listened_at: e.listened_at,
    rating: e.rating ?? null,
    album_title: e.albums?.title ?? '',
    artist_id: e.albums?.artists?.id ?? '',
    artist_name: e.albums?.artists?.name ?? '',
  }));

  const albumIds = [...new Set(entries.map((e) => e.album_id))];

  // 2. Fetch genres for user's albums (runs after we have albumIds)
  //    Uses idx_album_genres_album_id
  const genreResult = albumIds.length > 0
    ? await supabase
        .from('album_genres')
        .select('album_id, weight, genres ( slug )')
        .in('album_id', albumIds)
    : { data: [] };

  const genreData: StatsGenreEntry[] = (genreResult.data ?? [])
    .map((g: any) => ({
      album_id: g.album_id,
      genre_slug: g.genres?.slug ?? '',
      weight: g.weight ?? 1,
    }))
    .filter((g) => g.genre_slug !== '');

  const anglesMorts: AnglesMortsAlbum[] = (anglesMortsResult.data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    artist_name: r.artist_name,
    cover_url: r.cover_url ?? null,
    mbid: r.mbid ?? null,
    avg_rating: Number(r.avg_rating),
  }));

  return { entries, genreData, anglesMorts };
}
