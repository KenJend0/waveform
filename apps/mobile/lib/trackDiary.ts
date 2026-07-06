import { supabase } from './supabase';
import { parseFeaturedRows, type FeaturedCredit } from './creditedArtists';

/**
 * Journal d'écoute (titres) — miroir de apps/web/app/actions/track-diary.ts. Créer/
 * supprimer une écoute passe par l'Edge Function `log-listen` (même fonction que pour
 * les albums, discriminée par `kind: 'track'`) — voir lib/diary.ts pour le détail du
 * pattern (écriture + fanout feed_events, admin jamais exposé côté client).
 */

export type TrackReview = {
  id: string;
  user_id: string;
  rating: number | null;
  review_body: string | null;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

export type MyTrackDiaryEntry = {
  id: string;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
};

export type TrackDiaryEntryUI = {
  id: string;
  track_id: string;
  track_title: string;
  album_id: string;
  album_title: string;
  artist_id: string;
  artist_name: string;
  cover_url: string | null;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
};

export type TrackDiarySort = 'date_listened' | 'personal_rating';

export type TrackStat = {
  avg_rating: number | null;
  ratings_count: number;
  reviews_count: number;
  listeners_count: number;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getTrackStats(trackId: string): Promise<TrackStat | null> {
  const { data, error } = await supabase
    .from('track_stats')
    .select('avg_rating, ratings_count, reviews_count, listeners_count')
    .eq('track_id', trackId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    avg_rating: data.avg_rating ? Number(data.avg_rating) : null,
    ratings_count: data.ratings_count || 0,
    reviews_count: data.reviews_count || 0,
    listeners_count: data.listeners_count || 0,
  };
}

/** Toutes les écoutes de l'utilisateur courant pour ce titre, plus récentes d'abord. */
export async function getMyTrackDiaryEntries(trackId: string): Promise<MyTrackDiaryEntry[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('track_diary_entries')
    .select('id, rating, review_body, listened_at, created_at')
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMyTrackDiaryEntries error:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Crée ou met à jour une écoute — miroir de upsertTrackDiaryEntry (web). Le web n'a pas
 * de fonction "update" séparée : modifier une écoute réutilise cet upsert avec la même
 * date (onConflict user_id,track_id,listened_at), donc EditTrackDiaryEntryButton (web)
 * appelle exactement la même fonction. Délègue à l'Edge Function `log-listen` (écriture +
 * fanout feed_events, albumId/artistId résolus côté fonction depuis la DB — pas besoin
 * de les fournir ici, mais gardés dans le type d'entrée pour compat avec les appelants).
 */
export async function upsertTrackDiaryEntry(input: {
  trackId: string;
  albumId?: string;
  artistId?: string;
  listenedAt: string;
  rating: number;
  reviewBody?: string;
  source?: string;
}): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const { data, error } = await supabase.functions.invoke('log-listen', {
    body: {
      action: 'upsert',
      kind: 'track',
      trackId: input.trackId,
      listenedAt: input.listenedAt,
      rating: input.rating,
      reviewBody: input.reviewBody,
      source: input.source,
    },
  });

  if (error) {
    console.error('upsertTrackDiaryEntry error:', error.message);
    return { success: false, error: 'Une erreur est survenue' };
  }
  return data as { success: boolean; data?: { id: string }; error?: string };
}

export async function deleteTrackDiaryEntry(entryId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('log-listen', {
    body: { action: 'delete', kind: 'track', entryId },
  });

  if (error) {
    console.error('deleteTrackDiaryEntry error:', error.message);
    return { success: false, error: 'Une erreur est survenue' };
  }
  return data as { success: boolean; error?: string };
}

export async function getTrackReviewsPreview(trackId: string, limit = 3): Promise<TrackReview[]> {
  const { data: rows, error } = await supabase
    .from('track_diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('track_id', trackId)
    .not('review_body', 'is', null)
    .neq('review_body', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !rows) {
    console.error('getTrackReviewsPreview error:', error?.message);
    return [];
  }
  return attachProfiles(rows);
}

export type TrackReviewsTab = 'all' | 'friends' | 'my';

export async function getTrackReviewsPage(input: {
  trackId: string;
  tab: TrackReviewsTab;
  offset?: number;
  limit?: number;
  orderBy?: 'recent' | 'top';
}): Promise<{ items: TrackReview[]; hasMore: boolean; userId: string | null; hasFollowing: boolean }> {
  const { trackId, tab, offset = 0, limit = 12, orderBy = 'recent' } = input;
  const userId = await currentUserId();

  let followingIds: string[] = [];
  let hasFollowing = false;
  if (userId) {
    const { data: follows } = await supabase.from('follows').select('followee_id').eq('follower_id', userId);
    followingIds = (follows ?? []).map((f) => f.followee_id);
    hasFollowing = followingIds.length > 0;
  }

  if ((tab === 'friends' || tab === 'my') && !userId) {
    return { items: [], hasMore: false, userId: null, hasFollowing };
  }
  if (tab === 'friends' && !hasFollowing) {
    return { items: [], hasMore: false, userId, hasFollowing };
  }

  let query = supabase
    .from('track_diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('track_id', trackId)
    .not('review_body', 'is', null)
    .neq('review_body', '');

  query = orderBy === 'top'
    ? query.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });

  if (tab === 'my' && userId) query = query.eq('user_id', userId);
  else if (tab === 'friends' && hasFollowing) query = query.in('user_id', followingIds);

  const { data: rows, error } = await query.range(offset, offset + limit);

  if (error || !rows) {
    console.error('getTrackReviewsPage error:', error?.message);
    return { items: [], hasMore: false, userId, hasFollowing };
  }

  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  return { items: await attachProfiles(sliced), hasMore, userId, hasFollowing };
}

async function attachProfiles(
  rows: Array<{ id: string; user_id: string; rating: number | null; review_body: string | null; created_at: string }>
): Promise<TrackReview[]> {
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds)
    : { data: [] };

  const profilesMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((row) => ({
    ...row,
    username: profilesMap.get(row.user_id)?.username ?? null,
    avatar_url: profilesMap.get(row.user_id)?.avatar_url ?? null,
  }));
}

/** Toutes les écoutes d'un utilisateur (titre), paginées — miroir de getUserTrackDiary (web). */
export async function getUserTrackDiary(
  userId: string,
  offset = 0,
  limit = 50,
  sort: TrackDiarySort = 'date_listened',
  ratingFilter?: number | null
): Promise<TrackDiaryEntryUI[]> {
  const currentUser = await currentUserId();

  let query = supabase
    .from('track_diary_entries')
    .select(`
      id, track_id, album_id, rating, review_body, listened_at, created_at,
      tracks ( id, title, albums ( id, title, cover_url, artist_id, artists ( id, name ) ) )
    `)
    .eq('user_id', userId);

  if (currentUser !== userId) query = query.eq('is_public', true);
  if (ratingFilter != null) query = query.eq('rating', ratingFilter);

  if (sort === 'personal_rating') query = query.order('rating', { ascending: false, nullsFirst: false });
  else query = query.order('listened_at', { ascending: false });

  const { data: entries, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  if (error || !entries) {
    console.error('getUserTrackDiary error:', error?.message);
    return [];
  }

  return (entries as any[]).map((e) => {
    const track = e.tracks;
    const album = track?.albums;
    const artist = album?.artists;
    return {
      id: e.id,
      track_id: e.track_id,
      track_title: track?.title || 'Unknown',
      album_id: e.album_id,
      album_title: album?.title || 'Unknown',
      artist_id: album?.artist_id || '',
      artist_name: artist?.name || 'Unknown',
      cover_url: album?.cover_url || null,
      rating: e.rating,
      review_body: e.review_body,
      listened_at: e.listened_at,
      created_at: e.created_at,
    };
  });
}

// ============================================================================
// TRACK DIARY ENTRY DETAIL (pour /track-diary/[entry_id]) — miroir de la section
// équivalente de apps/web/app/actions/track-diary.ts. Voir lib/diary.ts pour le
// détail du pattern (lecture pure RLS, pas de client admin).
// ============================================================================

export type TrackDiaryComment = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: { id: string; username: string; avatar_url: string | null };
  is_mine: boolean;
  replies: TrackDiaryComment[];
};

export type TrackDiaryEntryDetail = {
  id: string;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
  author: { id: string; username: string; avatar_url: string | null };
  track: { id: string; title: string };
  album: { id: string; title: string; cover_url: string | null; release_date: string | null };
  artist: { id: string; name: string };
  featuredArtists: FeaturedCredit[];
  stats: { likes_count: number; comments_count: number };
  has_liked: boolean;
  comments: TrackDiaryComment[];
};

export type GetTrackDiaryEntryResult =
  | { success: true; data: TrackDiaryEntryDetail }
  | { success: false; error: string };

async function buildTrackEntryCommentsTree(entryId: string, currentUser: string | null): Promise<TrackDiaryComment[]> {
  const { data: commentsData, error } = await supabase
    .from('track_diary_comments')
    .select('id, body, created_at, user_id, parent_comment_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });

  if (error || !commentsData) return [];

  const userIds = [...new Set(commentsData.map((c) => c.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds)
    : { data: [] };
  const profilesMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const allComments: TrackDiaryComment[] = commentsData.map((c) => {
    const profile = profilesMap.get(c.user_id);
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      parent_comment_id: c.parent_comment_id ?? null,
      author: { id: c.user_id, username: profile?.username || 'unknown', avatar_url: profile?.avatar_url ?? null },
      is_mine: currentUser === c.user_id,
      replies: [],
    };
  });

  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const topLevel: TrackDiaryComment[] = [];
  for (const c of allComments) {
    if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
      commentMap.get(c.parent_comment_id)!.replies.push(c);
    } else {
      topLevel.push(c);
    }
  }
  return topLevel;
}

/** Commentaires d'une écoute de titre — miroir de getTrackEntryComments (web). */
export async function getTrackEntryComments(entryId: string): Promise<TrackDiaryComment[]> {
  const currentUser = await currentUserId();
  return buildTrackEntryCommentsTree(entryId, currentUser);
}

/** Détail complet d'une écoute de titre — miroir de getTrackDiaryEntry (web), pour /track-diary/[entry_id]. */
export async function getTrackDiaryEntry(entryId: string): Promise<GetTrackDiaryEntryResult> {
  const currentUser = await currentUserId();

  const { data: entry, error } = await supabase
    .from('track_diary_entries')
    .select(`
      id, rating, review_body, listened_at, created_at, user_id, track_id,
      tracks (
        id, title,
        albums (
          id, title, cover_url, release_date, artist_id,
          artists ( id, name )
        ),
        track_featured_artists ( position, joinphrase, artists ( id, name ) )
      )
    `)
    .eq('id', entryId)
    .maybeSingle();

  if (error || !entry) return { success: false, error: 'Entrée introuvable' };

  const track = (entry as any).tracks;
  const album = track?.albums;
  const artist = album?.artists;

  const [{ data: authorProfile }, { data: statsData }, likeRes, comments] = await Promise.all([
    supabase.from('profiles').select('id, username, avatar_url').eq('id', entry.user_id).maybeSingle(),
    supabase.from('track_diary_entry_stats').select('likes_count, comments_count').eq('entry_id', entryId).maybeSingle(),
    currentUser
      ? supabase.from('track_diary_likes').select('user_id').eq('entry_id', entryId).eq('user_id', currentUser).maybeSingle()
      : Promise.resolve({ data: null }),
    buildTrackEntryCommentsTree(entryId, currentUser),
  ]);

  if (!authorProfile || !track || !album) return { success: false, error: 'Données incomplètes' };

  return {
    success: true,
    data: {
      id: entry.id,
      rating: entry.rating,
      review_body: entry.review_body,
      listened_at: entry.listened_at,
      created_at: entry.created_at,
      author: { id: authorProfile.id, username: authorProfile.username || 'unknown', avatar_url: authorProfile.avatar_url ?? null },
      track: { id: track.id, title: track.title },
      album: {
        id: album.id,
        title: album.title,
        cover_url: album.cover_url ?? null,
        release_date: album.release_date ?? null,
      },
      artist: { id: artist?.id || '', name: artist?.name || 'Artiste inconnu' },
      featuredArtists: parseFeaturedRows(track?.track_featured_artists ?? null),
      stats: { likes_count: statsData?.likes_count ?? 0, comments_count: statsData?.comments_count ?? 0 },
      has_liked: !!likeRes.data,
      comments,
    },
  };
}

export type TrackDiaryLikeUser = { id: string; username: string; avatar_url: string | null };

/** Utilisateurs ayant aimé une écoute de titre — miroir de la version diary (web n'a pas
 * d'équivalent séparé pour les titres, cf. getTrackEntryLikes dans apps/web/app/actions/feed.ts). */
export async function getTrackEntryLikes(entryId: string): Promise<TrackDiaryLikeUser[]> {
  const { data: likes, error } = await supabase
    .from('track_diary_likes')
    .select('user_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false });

  if (error || !likes || likes.length === 0) return [];

  const userIds = likes.map((l) => l.user_id);
  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return userIds
    .map((id) => profileMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({ id: p.id, username: p.username || 'unknown', avatar_url: p.avatar_url ?? null }));
}

export type TrackWithStats = {
  track_id: string;
  track_title: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_title: string;
  cover_url: string | null;
  avg_rating: number | null;
  activity_count: number;
  delta?: number | null;
};

/** Titres tendance de la semaine — miroir de getTrendingTracks (apps/web/app/actions/track-diary.ts), utilisé par /explore (Phase 7). */
export async function getTrendingTracks(limit = 10): Promise<TrackWithStats[]> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_trending_tracks', {
    result_limit: limit,
  });

  if (!rpcError && rpcRows) {
    const rows = rpcRows as Array<{
      track_id: string; track_title: string | null; artist_id: string | null; artist_name: string | null;
      album_id: string | null; album_title: string | null; cover_url: string | null;
      avg_rating: string | number | null; activity_count: number | null; delta: number | null;
    }>;
    return rows.map((row) => ({
      track_id: row.track_id,
      track_title: row.track_title || 'Unknown',
      artist_id: row.artist_id || '',
      artist_name: row.artist_name || 'Unknown',
      album_id: row.album_id || '',
      album_title: row.album_title || 'Unknown',
      cover_url: row.cover_url || null,
      avg_rating: row.avg_rating !== null && row.avg_rating !== undefined ? Number(row.avg_rating) : null,
      activity_count: row.activity_count ?? 0,
      delta: row.delta ?? null,
    }));
  }

  console.warn('getTrendingTracks RPC fallback:', rpcError?.message);

  const now = Date.now();
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: prevData }] = await Promise.all([
    supabase.from('track_diary_entries').select('track_id, rating').gte('created_at', since).eq('is_public', true),
    supabase.from('track_diary_entries').select('track_id').gte('created_at', eightDaysAgo).lt('created_at', oneDayAgo).eq('is_public', true),
  ]);

  if (error || !data || data.length === 0) return [];

  const recentRows = data as Array<{ track_id: string; rating: number | null }>;
  const prevRows = prevData as Array<{ track_id: string }> | null;

  const map = new Map<string, { count: number; totalRating: number; ratingCount: number }>();
  for (const row of recentRows) {
    const existing = map.get(row.track_id) || { count: 0, totalRating: 0, ratingCount: 0 };
    existing.count++;
    if (row.rating !== null) {
      existing.totalRating += row.rating;
      existing.ratingCount++;
    }
    map.set(row.track_id, existing);
  }

  const prevCounts = new Map<string, number>();
  for (const row of prevRows ?? []) {
    prevCounts.set(row.track_id, (prevCounts.get(row.track_id) ?? 0) + 1);
  }
  const prevRankMap = new Map(
    [...prevCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id], i) => [id, i + 1])
  );

  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);
  if (sorted.length === 0) return [];

  const trackIds = sorted.map(([id]) => id);
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, album_id, albums(id, title, cover_url, artist_id, artists(id, name))')
    .in('id', trackIds);

  const trackMap = new Map(((tracks ?? []) as any[]).map((t) => [t.id, t]));

  return sorted
    .map(([trackId, stats], index): TrackWithStats | null => {
      const track = trackMap.get(trackId);
      if (!track) return null;
      const album = track.albums;
      const currentRank = index + 1;
      const prevRank = prevRankMap.get(trackId);
      return {
        track_id: trackId,
        track_title: track.title || 'Unknown',
        artist_id: album?.artist_id || '',
        artist_name: album?.artists?.name || 'Unknown',
        album_id: track.album_id || '',
        album_title: album?.title || 'Unknown',
        cover_url: album?.cover_url ?? null,
        avg_rating: stats.ratingCount > 0 ? stats.totalRating / stats.ratingCount : null,
        activity_count: stats.count,
        delta: prevRank !== undefined ? prevRank - currentRank : null,
      };
    })
    .filter((row): row is TrackWithStats => row != null);
}
