'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export type StatsEntry = {
  album_id: string;
  listened_at: string;
  rating: number | null;
  album_title: string;
  artist_id: string;
  artist_name: string;
  cover_url: string | null;
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

  // 1. Fetch all diary entries (lightweight, no review body)
  const { data: rawEntries } = await supabase
    .from('diary_entries')
    .select(`
      album_id,
      listened_at,
      rating,
      albums (
        id,
        title,
        cover_url,
        artists ( id, name )
      )
    `)
    .eq('user_id', userId)
    .order('listened_at', { ascending: true });

  const entries: StatsEntry[] = (rawEntries ?? []).map((e: any) => ({
    album_id: e.album_id,
    listened_at: e.listened_at,
    rating: e.rating ?? null,
    album_title: e.albums?.title ?? '',
    artist_id: e.albums?.artists?.id ?? '',
    artist_name: e.albums?.artists?.name ?? '',
    cover_url: e.albums?.cover_url ?? null,
  }));

  const albumIds = [...new Set(entries.map((e) => e.album_id))];

  // 2. Fetch genre data + candidate stats in parallel
  const [genreResult, statsResult] = await Promise.all([
    albumIds.length > 0
      ? supabase
          .from('album_genres')
          .select('album_id, weight, genres ( slug )')
          .in('album_id', albumIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('album_stats_mat')
      .select('album_id, avg_rating, listeners_count')
      .gte('avg_rating', 7.0)
      .gte('listeners_count', 5)
      .order('avg_rating', { ascending: false })
      .limit(200),
  ]);

  const genreData: StatsGenreEntry[] = (genreResult.data ?? [])
    .map((g: any) => ({
      album_id: g.album_id,
      genre_slug: g.genres?.slug ?? '',
      weight: g.weight ?? 1,
    }))
    .filter((g) => g.genre_slug !== '');

  // 3. Filter candidates not in user's diary
  const userAlbumSet = new Set(albumIds);
  const candidates = (statsResult.data ?? [])
    .filter((r: any) => !userAlbumSet.has(r.album_id))
    .slice(0, 40);

  let anglesMorts: AnglesMortsAlbum[] = [];

  if (candidates.length > 0) {
    const candidateIds = candidates.map((r: any) => r.album_id);
    const avgRatingMap = new Map(candidates.map((r: any) => [r.album_id, r.avg_rating as number]));

    const { data: albumRows } = await supabase
      .from('albums')
      .select('id, title, cover_url, mbid, artists ( name )')
      .in('id', candidateIds);

    anglesMorts = (albumRows ?? []).map((a: any) => ({
      id: a.id,
      title: a.title,
      artist_name: a.artists?.name ?? '',
      cover_url: a.cover_url ?? null,
      mbid: a.mbid ?? null,
      avg_rating: avgRatingMap.get(a.id) ?? 0,
    }));
  }

  return { entries, genreData, anglesMorts };
}
