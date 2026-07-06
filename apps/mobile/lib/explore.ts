import { supabase } from './supabase';

/**
 * Miroir mobile de apps/web/app/actions/explore.ts — 100% RLS/anon, pas d'Edge
 * Function nécessaire (confirmé avant de porter). Pas de `getTasteMatchScore`
 * (utilisé uniquement par la page profil web pour un badge non repris côté
 * mobile pour l'instant).
 */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export type ProfileTier = 'anonymous' | 'new' | 'established';

/** Seuil de 3 entrées de journal — même seuil que le web. */
export async function getProfileTier(): Promise<ProfileTier> {
  const userId = await currentUserId();
  if (!userId) return 'anonymous';

  const { count } = await supabase
    .from('diary_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return (count ?? 0) >= 3 ? 'established' : 'new';
}

export type TrendingAlbum = {
  id: string;
  album_id: string;
  album_title: string;
  artist_name: string;
  cover_url: string;
  discover_kind: string;
  score?: number;
  delta?: number | null;
};

export type DiscoveryAlbum = {
  album_id: string;
  title: string;
  artist: string;
  cover_url: string;
  via_username?: string | null;
};

export type DiscoveryResult = {
  albums: DiscoveryAlbum[];
  mode: 'bubble' | 'discover';
  hasTasteProfile: boolean;
};

export type ForYouAlbum = {
  album_id: string;
  title: string;
  artist: string;
  cover_url: string;
};

export type ForYouTrack = {
  track_id: string;
  track_title: string;
  artist: string;
  album_id: string;
  artist_id: string;
  cover_url: string | null;
};

export type SimilarUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  taste_match: number;
  shared_albums_count: number;
  shared_covers: string[];
};

const REC_POOL_SIZE = 12;

/** Pioche déterministe-par-jour — voir explore.ts (web) pour le raisonnement complet. */
function pickDailyRotation<T>(pool: T[], seedKey: string, take: number): T[] {
  if (pool.length <= take) return pool;
  const today = new Date().toISOString().slice(0, 10);
  const seedStr = `${seedKey}:${today}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
  }
  let seed = hash >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, take);
}

export async function getTrendingThisWeek(limit = 10): Promise<TrendingAlbum[]> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_trending_albums', {
    result_limit: limit,
  });

  if (!rpcError && rpcRows) {
    const rows = rpcRows as Array<{
      album_id: string; album_title: string | null; artist_name: string | null;
      cover_url: string | null; activity_count: number | null; delta: number | null;
    }>;
    return rows.map((row) => ({
      id: `trending-${row.album_id}`,
      album_id: row.album_id,
      album_title: row.album_title || 'Unknown',
      artist_name: row.artist_name || 'Unknown',
      cover_url: row.cover_url || '',
      discover_kind: 'trending_week',
      score: row.activity_count ?? 0,
      delta: row.delta ?? null,
    }));
  }

  console.warn('getTrendingThisWeek RPC fallback:', rpcError?.message);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: currEntries }, { data: currSaves },
    { data: prevEntries }, { data: prevSaves },
  ] = await Promise.all([
    supabase.from('diary_entries').select('album_id, albums(id, title, cover_url, artists(name))').gte('created_at', sevenDaysAgo).eq('is_public', true).limit(200),
    supabase.from('list_items').select('album_id, albums(id, title, cover_url, artists(name)), user_lists!inner(is_default)').eq('user_lists.is_default', true).not('album_id', 'is', null).gte('added_at', sevenDaysAgo).limit(200),
    supabase.from('diary_entries').select('album_id').gte('created_at', eightDaysAgo).lt('created_at', oneDayAgo).eq('is_public', true).limit(200),
    supabase.from('list_items').select('album_id, user_lists!inner(is_default)').eq('user_lists.is_default', true).not('album_id', 'is', null).gte('added_at', eightDaysAgo).lt('added_at', oneDayAgo).limit(200),
  ]);

  const albumScores = new Map<string, { score: number; title: string; artist_name: string; cover_url: string | null }>();
  for (const entry of [...((currEntries ?? []) as any[]), ...((currSaves ?? []) as any[])]) {
    const album = entry.albums;
    if (!album?.id) continue;
    const existing = albumScores.get(album.id);
    if (existing) existing.score += 1;
    else albumScores.set(album.id, { score: 1, title: album.title || 'Unknown', artist_name: album.artists?.name || 'Unknown', cover_url: album.cover_url });
  }

  const prevScores = new Map<string, number>();
  for (const entry of [...((prevEntries ?? []) as any[]), ...((prevSaves ?? []) as any[])]) {
    if (!entry.album_id) continue;
    prevScores.set(entry.album_id, (prevScores.get(entry.album_id) ?? 0) + 1);
  }
  const prevRankMap = new Map(
    [...prevScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id], i) => [id, i + 1])
  );

  return [...albumScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([albumId, info], index) => {
      const currentRank = index + 1;
      const prevRank = prevRankMap.get(albumId);
      return {
        id: `trending-${albumId}`,
        album_id: albumId,
        album_title: info.title,
        artist_name: info.artist_name,
        cover_url: info.cover_url || '',
        discover_kind: 'trending_week',
        score: info.score,
        delta: prevRank !== undefined ? prevRank - currentRank : null,
      };
    });
}

export async function getForYouSuggestions(limit = 6): Promise<ForYouAlbum[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const [{ data: feedback }, { data: ratedAlbums }] = await Promise.all([
    supabase.from('recommendation_feedback').select('album_id').eq('user_id', userId),
    supabase.from('diary_entries').select('album_id').eq('user_id', userId),
  ]);
  const dismissedIds = new Set(((feedback ?? []) as Array<{ album_id: string | null }>).map((f) => f.album_id).filter((id): id is string => id != null));
  const ratedAlbumIds = new Set((ratedAlbums ?? []).map((r) => r.album_id).filter(Boolean));

  const fetchPrecomputed = async (method: string) => {
    const { data } = await supabase
      .from('user_recommendations')
      .select('album_id, rank, albums(id, title, cover_url, artists(name))')
      .eq('user_id', userId)
      .eq('method', method)
      .order('rank')
      .limit(REC_POOL_SIZE + dismissedIds.size + ratedAlbumIds.size);
    const pool = ((data ?? []) as any[])
      .filter((row) => !dismissedIds.has(row.album_id) && !ratedAlbumIds.has(row.album_id))
      .slice(0, REC_POOL_SIZE);
    return pickDailyRotation(pool, `${userId}:albums:${method}`, limit);
  };

  const hybridPrecomputed = await fetchPrecomputed('hybrid');
  const precomputed = hybridPrecomputed.length > 0 ? hybridPrecomputed : await fetchPrecomputed('cosine_cf');

  if (precomputed && precomputed.length > 0) {
    return precomputed.map((row: any) => {
      const album = row.albums;
      return {
        album_id: row.album_id,
        title: album?.title || 'Unknown',
        artist: album?.artists?.name || 'Unknown',
        cover_url: album?.cover_url || '',
      };
    });
  }

  // Fallback Jaccard — actif tant que le batch ML n'a pas tourné pour cet user
  const [{ data: myEntries }, { data: myAllEntries }] = await Promise.all([
    supabase.from('diary_entries').select('album_id').eq('user_id', userId).gte('rating', 8),
    supabase.from('diary_entries').select('album_id').eq('user_id', userId),
  ]);

  const myLikedIds = (myEntries ?? []).map((e) => e.album_id).filter(Boolean) as string[];
  if (myLikedIds.length === 0) return [];

  const { data: intersectionEntries } = await supabase
    .from('diary_entries')
    .select('user_id, album_id')
    .in('album_id', myLikedIds)
    .neq('user_id', userId)
    .gte('rating', 8);

  const intersectionSizes = new Map<string, number>();
  for (const e of intersectionEntries ?? []) {
    if (!e.user_id) continue;
    intersectionSizes.set(e.user_id, (intersectionSizes.get(e.user_id) ?? 0) + 1);
  }

  const neighborIds = [...intersectionSizes.entries()].filter(([, size]) => size >= 3).map(([id]) => id);
  if (neighborIds.length === 0) return [];

  const myAllAlbumIds = new Set((myAllEntries ?? []).map((e) => e.album_id).filter(Boolean));

  const { data: recommendations } = await supabase
    .from('diary_entries')
    .select('user_id, album_id, rating, albums(id, title, cover_url, artists(name))')
    .in('user_id', neighborIds)
    .gte('rating', 8)
    .limit(500);

  const scores = new Map<string, { neighborCount: number; total: number; title: string; artist: string; cover: string }>();
  for (const entry of (recommendations ?? []) as any[]) {
    if (!entry.album_id || myAllAlbumIds.has(entry.album_id) || dismissedIds.has(entry.album_id)) continue;
    const album = entry.albums;
    if (!album?.id) continue;
    const existing = scores.get(album.id);
    if (existing) {
      existing.neighborCount += 1;
      existing.total += entry.rating || 0;
    } else {
      scores.set(album.id, {
        neighborCount: 1,
        total: entry.rating || 0,
        title: album.title || 'Unknown',
        artist: album.artists?.name || 'Unknown',
        cover: album.cover_url || '',
      });
    }
  }

  if (scores.size === 0) return [];

  const pool = [...scores.entries()]
    .sort((a, b) => b[1].neighborCount - a[1].neighborCount || b[1].total / b[1].neighborCount - a[1].total / a[1].neighborCount)
    .slice(0, REC_POOL_SIZE);
  const topScores = pickDailyRotation(pool, `${userId}:albums:jaccard`, limit);

  return topScores.map(([albumId, info]) => ({
    album_id: albumId,
    title: info.title,
    artist: info.artist,
    cover_url: info.cover,
  }));
}

export async function dismissRecommendation(albumId: string): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { success: false };

  const { error } = await supabase
    .from('recommendation_feedback')
    .upsert({ user_id: userId, album_id: albumId }, { onConflict: 'user_id,album_id' });

  return { success: !error };
}

export async function dismissTrackRecommendation(trackId: string): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { success: false };

  const { error } = await supabase
    .from('recommendation_feedback')
    .upsert({ user_id: userId, track_id: trackId }, { onConflict: 'user_id,track_id' });

  return { success: !error };
}

export async function getDiscoveryAlbums(limit = 6): Promise<DiscoveryResult> {
  let knownArtistIds = new Set<string>();
  let followedIds: string[] = [];
  let dismissedIds = new Set<string>();
  const userId = await currentUserId();

  if (userId) {
    const [{ data: myAlbums }, { data: following }, { data: feedback }] = await Promise.all([
      supabase.from('diary_entries').select('albums(artist_id)').eq('user_id', userId),
      supabase.from('follows').select('followee_id').eq('follower_id', userId),
      supabase.from('recommendation_feedback').select('album_id').eq('user_id', userId).not('album_id', 'is', null),
    ]);
    for (const e of (myAlbums ?? []) as any[]) {
      const album = e.albums;
      if (album?.artist_id) knownArtistIds.add(album.artist_id);
    }
    followedIds = (following ?? []).map((f) => f.followee_id).filter(Boolean) as string[];
    dismissedIds = new Set(((feedback ?? []) as Array<{ album_id: string | null }>).map((f) => f.album_id).filter((id): id is string => id != null));
  }

  // Cas 1 — signal social : albums bien notés par des comptes suivis
  if (userId && followedIds.length > 0) {
    const { data: followedEntries } = await supabase
      .from('diary_entries')
      .select('user_id, album_id, rating, albums(id, title, cover_url, artist_id, artists(name))')
      .in('user_id', followedIds)
      .gte('rating', 7)
      .order('rating', { ascending: false })
      .limit(200);

    const followerUserIds = [...new Set(((followedEntries ?? []) as any[]).map((e) => e.user_id).filter(Boolean))] as string[];
    const { data: followerProfiles } = followerUserIds.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', followerUserIds)
      : { data: [] };
    const usernameMap = new Map((followerProfiles ?? []).map((p) => [p.id, p.username]));

    const seenAlbumIds = new Set<string>();
    const socialAlbums: DiscoveryAlbum[] = [];
    for (const entry of (followedEntries ?? []) as any[]) {
      const album = entry.albums;
      if (!album?.id || seenAlbumIds.has(album.id)) continue;
      if (knownArtistIds.has(album.artist_id)) continue;
      if (dismissedIds.has(album.id)) continue;
      seenAlbumIds.add(album.id);
      socialAlbums.push({
        album_id: album.id,
        title: album.title || 'Unknown',
        artist: album.artists?.name || 'Unknown',
        cover_url: album.cover_url || '',
        via_username: entry.user_id ? usernameMap.get(entry.user_id) ?? null : null,
      });
      if (socialAlbums.length >= limit) break;
    }

    if (socialAlbums.length > 0) {
      return { albums: socialAlbums, mode: 'bubble', hasTasteProfile: knownArtistIds.size > 0 };
    }
  }

  // Cas 2 — repli : note moyenne pondérée par confiance
  const { data: stats } = await supabase
    .from('album_stats_mat')
    .select('album_id, avg_rating, listeners_count')
    .gte('avg_rating', 7)
    .gte('listeners_count', 2)
    .limit(150);

  if (!stats || stats.length === 0) return { albums: [], mode: 'discover', hasTasteProfile: knownArtistIds.size > 0 };

  const albumIds = stats.map((s) => s.album_id).filter(Boolean) as string[];

  const { data: albums } = await supabase
    .from('albums')
    .select('id, title, cover_url, artist_id, artists(name)')
    .in('id', albumIds);

  if (!albums) return { albums: [], mode: 'discover', hasTasteProfile: knownArtistIds.size > 0 };

  const statsMap = new Map(stats.map((s) => [s.album_id, s]));

  const ranked = (albums as any[])
    .filter((a) => !knownArtistIds.has(a.artist_id) && !dismissedIds.has(a.id))
    .map((a) => {
      const s = statsMap.get(a.id);
      const confidence = Math.log((s?.listeners_count ?? 1) + 1);
      return { album: a, score: (s?.avg_rating ?? 0) * confidence };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ album }) => ({
      album_id: album.id,
      title: album.title,
      artist: album.artists?.name || 'Unknown',
      cover_url: album.cover_url || '',
    }));

  return { albums: ranked, mode: 'discover', hasTasteProfile: knownArtistIds.size > 0 };
}

export async function getSimilarUsers(limit = 4): Promise<SimilarUser[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const [{ data: similarities }, { data: following }] = await Promise.all([
    supabase.from('user_similarity').select('user_b, score').eq('user_a', userId).order('score', { ascending: false }).limit(50),
    supabase.from('follows').select('followee_id').eq('follower_id', userId),
  ]);

  if (!similarities || similarities.length === 0) return [];

  const followedIds = new Set((following ?? []).map((f) => f.followee_id));
  const scoreMap = new Map(similarities.map((s) => [s.user_b, s.score]));

  const unfollowedSimilar = similarities.filter((s) => !followedIds.has(s.user_b)).slice(0, limit);
  if (unfollowedSimilar.length === 0) return [];

  const userIds = unfollowedSimilar.map((s) => s.user_b);

  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
  if (!profiles) return [];

  const similarUserIds = profiles.map((p) => p.id);
  const [{ data: myAlbums }, { data: theirAlbums }] = await Promise.all([
    supabase.from('diary_entries').select('album_id').eq('user_id', userId),
    supabase.from('diary_entries').select('user_id, album_id').in('user_id', similarUserIds),
  ]);

  const myAlbumSet = new Set((myAlbums ?? []).map((e) => e.album_id).filter(Boolean));
  const sharedAlbumsMap = new Map<string, string[]>();
  for (const entry of theirAlbums ?? []) {
    if (!entry.album_id || !entry.user_id) continue;
    if (myAlbumSet.has(entry.album_id)) {
      const existing = sharedAlbumsMap.get(entry.user_id) ?? [];
      existing.push(entry.album_id);
      sharedAlbumsMap.set(entry.user_id, existing);
    }
  }

  const allSharedAlbumIds = [...new Set([...sharedAlbumsMap.values()].flat())];
  const { data: sharedAlbumCovers } = allSharedAlbumIds.length > 0
    ? await supabase.from('albums').select('id, cover_url').in('id', allSharedAlbumIds)
    : { data: [] };
  const coverMap = new Map((sharedAlbumCovers ?? []).map((a) => [a.id, a.cover_url]));

  return profiles
    .filter((p) => p.username)
    .map((p) => {
      const sharedAlbumIds = sharedAlbumsMap.get(p.id) ?? [];
      return {
        user_id: p.id,
        username: p.username!,
        avatar_url: p.avatar_url ?? null,
        taste_match: Math.round((scoreMap.get(p.id) ?? 0) * 100),
        shared_albums_count: sharedAlbumIds.length,
        shared_covers: sharedAlbumIds.slice(0, 3).map((id) => coverMap.get(id)).filter(Boolean) as string[],
      };
    })
    .sort((a, b) => b.taste_match - a.taste_match);
}

export async function getForYouTracks(limit = 6): Promise<ForYouTrack[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const [{ data: feedback }, { data: ratedTracks }] = await Promise.all([
    supabase.from('recommendation_feedback').select('track_id').eq('user_id', userId).not('track_id', 'is', null),
    supabase.from('track_diary_entries').select('track_id').eq('user_id', userId),
  ]);
  const dismissedTrackIds = new Set(((feedback ?? []) as Array<{ track_id: string | null }>).map((f) => f.track_id).filter((id): id is string => id != null));
  const ratedTrackIds = new Set((ratedTracks ?? []).map((r) => r.track_id).filter(Boolean));

  const { data: rawData } = await supabase
    .from('user_track_recommendations')
    .select('track_id, rank, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, artists(name)))')
    .eq('user_id', userId)
    .eq('method', 'cosine_cf')
    .order('rank')
    .limit(REC_POOL_SIZE + dismissedTrackIds.size + ratedTrackIds.size);

  const trackPool = ((rawData ?? []) as any[])
    .filter((row) => !dismissedTrackIds.has(row.track_id) && !ratedTrackIds.has(row.track_id))
    .slice(0, REC_POOL_SIZE);
  const precomputed = pickDailyRotation(trackPool, `${userId}:tracks:cosine_cf`, limit);

  if (precomputed.length > 0) {
    return precomputed.map((row: any) => {
      const track = row.tracks;
      const album = track?.albums;
      return {
        track_id: row.track_id,
        track_title: track?.title || 'Unknown',
        artist: album?.artists?.name || 'Unknown',
        album_id: track?.album_id || '',
        artist_id: track?.artist_id || '',
        cover_url: album?.cover_url ?? null,
      };
    });
  }

  // Fallback Jaccard
  const [{ data: myEntries }, { data: myAllEntries }] = await Promise.all([
    supabase.from('track_diary_entries').select('track_id').eq('user_id', userId).gte('rating', 8),
    supabase.from('track_diary_entries').select('track_id').eq('user_id', userId),
  ]);

  const myLikedTrackIds = (myEntries ?? []).map((e) => e.track_id).filter(Boolean) as string[];
  if (myLikedTrackIds.length === 0) return [];

  const { data: intersectionEntries } = await supabase
    .from('track_diary_entries')
    .select('user_id, track_id')
    .in('track_id', myLikedTrackIds)
    .neq('user_id', userId)
    .gte('rating', 8);

  const intersectionSizes = new Map<string, number>();
  for (const e of intersectionEntries ?? []) {
    if (!e.user_id) continue;
    intersectionSizes.set(e.user_id, (intersectionSizes.get(e.user_id) ?? 0) + 1);
  }

  const neighborIds = [...intersectionSizes.entries()].filter(([, size]) => size >= 3).map(([id]) => id);
  if (neighborIds.length === 0) return [];

  const myAllTrackIds = new Set((myAllEntries ?? []).map((e) => e.track_id).filter(Boolean));

  const { data: recommendations } = await supabase
    .from('track_diary_entries')
    .select('user_id, track_id, rating, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, artists(name)))')
    .in('user_id', neighborIds)
    .gte('rating', 8)
    .limit(500);

  const scores = new Map<string, { neighborCount: number; total: number; title: string; artist: string; albumId: string; artistId: string; cover: string | null }>();

  for (const entry of (recommendations ?? []) as any[]) {
    if (!entry.track_id || myAllTrackIds.has(entry.track_id) || dismissedTrackIds.has(entry.track_id)) continue;
    const track = entry.tracks;
    if (!track?.id) continue;
    const album = track.albums;
    const existing = scores.get(track.id);
    if (existing) {
      existing.neighborCount += 1;
      existing.total += entry.rating || 0;
    } else {
      scores.set(track.id, {
        neighborCount: 1,
        total: entry.rating || 0,
        title: track.title || 'Unknown',
        artist: album?.artists?.name || 'Unknown',
        albumId: track.album_id || '',
        artistId: track.artist_id || '',
        cover: album?.cover_url ?? null,
      });
    }
  }

  if (scores.size === 0) return [];

  const trackScorePool = [...scores.entries()]
    .sort((a, b) => b[1].neighborCount - a[1].neighborCount || b[1].total / b[1].neighborCount - a[1].total / a[1].neighborCount)
    .slice(0, REC_POOL_SIZE);
  const topScores = pickDailyRotation(trackScorePool, `${userId}:tracks:jaccard`, limit);

  return topScores.map(([trackId, info]) => ({
    track_id: trackId,
    track_title: info.title,
    artist: info.artist,
    album_id: info.albumId,
    artist_id: info.artistId,
    cover_url: info.cover,
  }));
}
