'use server';

import { revalidatePath } from 'next/cache';
import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { fanoutEvent } from './feed';
import { checkActionRateLimit } from '@/lib/serverRateLimit';
import { findBannedContentWord } from '@/lib/bannedWords';
import { logAuthedProductEvent } from '@/lib/productEvents';

export interface UpsertTrackDiaryEntryInput {
  trackId: string;
  albumId: string;
  artistId: string;
  listenedAt: string;
  rating?: number;
  reviewTitle?: string;
  reviewBody?: string;
  isPublic?: boolean;
}

export async function upsertTrackDiaryEntry(input: UpsertTrackDiaryEntryInput) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const rlError = await checkActionRateLimit(user.id, 'diary_write');
    if (rlError) return { success: false, error: rlError };

    const supabase = await createSupabaseServer();

    if (!input.trackId || !input.albumId || !input.artistId || !input.listenedAt) {
      return { success: false, error: 'trackId, albumId, artistId et listenedAt sont requis' };
    }

    if (input.rating !== undefined && (input.rating < 0 || input.rating > 10)) {
      return { success: false, error: 'La note doit être entre 0 et 10' };
    }

    if (input.reviewTitle && input.reviewTitle.length > 200) {
      return { success: false, error: 'Titre de critique trop long — max 200 caractères' };
    }

    if (input.reviewBody && input.reviewBody.length > 5000) {
      return { success: false, error: 'Critique trop longue — max 5000 caractères' };
    }

    if (input.reviewTitle && findBannedContentWord(input.reviewTitle)) {
      return { success: false, error: 'Ce titre contient du contenu inapproprié.' };
    }

    if (input.reviewBody && findBannedContentWord(input.reviewBody)) {
      return { success: false, error: 'Cette critique contient du contenu inapproprié.' };
    }

    const entryPayload = {
      user_id: user.id,
      track_id: input.trackId,
      album_id: input.albumId,
      artist_id: input.artistId,
      listened_at: input.listenedAt,
      rating: input.rating ?? null,
      review_title: input.reviewTitle || null,
      review_body: input.reviewBody || null,
      is_public: input.isPublic ?? true,
    };

    const { data, error } = await (supabase as any)
      .from('track_diary_entries')
      .upsert(entryPayload, { onConflict: 'user_id,track_id,listened_at' })
      .select()
      .single();

    if (error) {
      console.error('upsertTrackDiaryEntry error:', error);
      return { success: false, error: 'Une erreur est survenue' };
    }

    // Fanout au feed — on récupère les followers via supabaseAdmin pour garantir
    // que la query n'est pas bloquée par un contexte auth instable (track_diary_entries
    // n'est pas dans les types générés, ce qui peut affecter le client user-level).
    try {
      const supabaseAdmin = createSupabaseAdmin();

      const [trackDataResult, followersResult] = await Promise.all([
        supabase
          .from('tracks')
          .select('title, albums(id, title, cover_url, artist_id, artists(id, name))')
          .eq('id', input.trackId)
          .maybeSingle(),
        supabaseAdmin
          .from('follows')
          .select('follower_id')
          .eq('followee_id', user.id),
      ]);

      const trackData = trackDataResult.data;
      const album = (trackData as any)?.albums;
      const artist = (album as any)?.artists;
      const followerIds = (followersResult.data ?? []).map((f: any) => f.follower_id);

      // Inclure l'acteur lui-même pour son propre feed
      const targets = [...new Set([...followerIds, user.id])];

      await fanoutEvent('track_diary_entry' as any, {
        userId: user.id,
        albumId: input.albumId,
        trackEntryId: data.id,
        trackId: input.trackId,
        trackTitle: (trackData as any)?.title || '',
        albumTitle: album?.title || '',
        coverUrl: album?.cover_url || null,
        artistName: artist?.name || '',
        rating: input.rating ?? null,
        reviewBody: input.reviewBody || null,
      }, targets);
    } catch (fanoutErr) {
      console.error('track fanout error:', fanoutErr);
    }

    await logAuthedProductEvent('track_logged', {
      surface: 'diary',
      properties: {
        track_id: input.trackId,
        album_id: input.albumId,
        rating: input.rating ?? null,
        has_review: !!(input.reviewBody),
      },
    });

    return { success: true, data: { id: data.id } };
  } catch (err) {
    console.error('upsertTrackDiaryEntry unexpected error:', err);
    return { success: false, error: 'Une erreur est survenue' };
  }
}

export async function deleteTrackDiaryEntry(entryId: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createSupabaseServer();

    const { data: entry, error: fetchError } = await (supabase as any)
      .from('track_diary_entries')
      .select('user_id')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchError || !entry) return { success: false, error: 'Entrée introuvable' };
    if (entry.user_id !== user.id) return { success: false, error: 'Forbidden' };

    const { error: deleteError } = await (supabase as any)
      .from('track_diary_entries')
      .delete()
      .eq('id', entryId);

    if (deleteError) return { success: false, error: 'Une erreur est survenue' };

    revalidatePath('/me');
    revalidatePath('/u/[username]', 'page');

    return { success: true };
  } catch (err) {
    console.error('deleteTrackDiaryEntry error:', err);
    return { success: false, error: 'Une erreur est survenue' };
  }
}

export async function getLatestTrackDiaryEntry(
  trackId: string
): Promise<{ id: string; rating: number | null; listenedAt: string; reviewTitle: string | null; reviewBody: string | null } | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createSupabaseServer();

  const { data } = await (supabase as any)
    .from('track_diary_entries')
    .select('id, rating, listened_at, review_title, review_body')
    .eq('user_id', user.id)
    .eq('track_id', trackId)
    .order('listened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    rating: data.rating ?? null,
    listenedAt: data.listened_at,
    reviewTitle: data.review_title ?? null,
    reviewBody: data.review_body ?? null,
  };
}

export type TrackDiaryEntryUI = {
  id: string;
  track_id: string;
  track_title: string;
  track_no: number | null;
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

export async function getUserTrackDiary(
  userId: string,
  offset = 0,
  limit = 50
): Promise<TrackDiaryEntryUI[]> {
  const supabase = await createSupabaseServer();

  const { data: entries, error } = await (supabase as any)
    .from('track_diary_entries')
    .select(`
      id,
      track_id,
      album_id,
      rating,
      review_body,
      listened_at,
      created_at,
      tracks (
        id,
        title,
        track_no,
        albums (
          id,
          title,
          cover_url,
          artist_id,
          artists (
            id,
            name
          )
        )
      )
    `)
    .eq('user_id', userId)
    .order('listened_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !entries) {
    console.error('getUserTrackDiary error:', error);
    return [];
  }

  return entries.map((e: any) => {
    const track = e.tracks as any;
    const album = track?.albums as any;
    const artist = album?.artists as any;
    return {
      id: e.id,
      track_id: e.track_id,
      track_title: track?.title || 'Unknown',
      track_no: track?.track_no ?? null,
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

export type TrackReview = {
  id: string;
  user_id: string;
  rating: number | null;
  review_body: string | null;
  created_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export async function getTrackReviewsPreview(
  trackId: string,
  limit = 3
): Promise<TrackReview[]> {
  const supabase = await createSupabaseServer();

  const { data: rows, error } = await (supabase as any)
    .from('track_diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('track_id', trackId)
    .not('review_body', 'is', null)
    .neq('review_body', '')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !rows) return [];

  const userIds = [...new Set(rows.map((r: any) => r.user_id))] as string[];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    rating: row.rating,
    review_body: row.review_body,
    created_at: row.created_at,
    display_name: profilesMap.get(row.user_id)?.display_name || null,
    username: profilesMap.get(row.user_id)?.username || null,
    avatar_url: profilesMap.get(row.user_id)?.avatar_url || null,
  }));
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
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  let followingIds: string[] = [];
  let hasFollowing = false;
  if (currentUser) {
    const { data: follows } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', currentUser.id);
    followingIds = (follows || []).map((f: any) => f.followee_id);
    hasFollowing = followingIds.length > 0;
  }

  if ((tab === 'friends' || tab === 'my') && !currentUser) {
    return { items: [], hasMore: false, userId: null, hasFollowing };
  }

  if (tab === 'friends' && !hasFollowing) {
    return { items: [], hasMore: false, userId: currentUser?.id || null, hasFollowing };
  }

  let query = (supabase as any)
    .from('track_diary_entries')
    .select('id, user_id, rating, review_body, created_at')
    .eq('track_id', trackId)
    .not('review_body', 'is', null)
    .neq('review_body', '');

  if (orderBy === 'top') {
    query = query.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (tab === 'my' && currentUser) {
    query = query.eq('user_id', currentUser.id);
  } else if (tab === 'friends' && hasFollowing) {
    query = query.in('user_id', followingIds);
  }

  const { data: rows, error } = await query.range(offset, offset + limit);

  if (error || !rows) return { items: [], hasMore: false, userId: currentUser?.id || null, hasFollowing };

  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  const userIds = [...new Set(sliced.map((r: any) => r.user_id))] as string[];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);

  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return {
    items: sliced.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      rating: row.rating,
      review_body: row.review_body,
      created_at: row.created_at,
      display_name: profilesMap.get(row.user_id)?.display_name || null,
      username: profilesMap.get(row.user_id)?.username || null,
      avatar_url: profilesMap.get(row.user_id)?.avatar_url || null,
    })),
    hasMore,
    userId: currentUser?.id || null,
    hasFollowing,
  };
}

export type TrackStat = {
  avg_rating: number | null;
  ratings_count: number;
  listeners_count: number;
};

export async function getTrackStats(trackId: string): Promise<TrackStat | null> {
  const supabase = await createSupabaseServer();

  const { data, error } = await (supabase as any)
    .from('track_stats')
    .select('avg_rating, ratings_count, listeners_count')
    .eq('track_id', trackId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    avg_rating: data.avg_rating ? Number(data.avg_rating) : null,
    ratings_count: data.ratings_count || 0,
    listeners_count: data.listeners_count || 0,
  };
}

export type TrackDiaryComment = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  is_mine: boolean;
  replies: TrackDiaryComment[];
};

export type TrackDiaryEntryDetail = {
  id: string;
  rating: number | null;
  review_title: string | null;
  review_body: string | null;
  listened_at: string;
  created_at: string;
  is_public: boolean;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  track: { id: string; title: string; track_no: number | null; duration_ms: number | null };
  album: { id: string; title: string; cover_url: string | null; release_date: string | null };
  artist: { id: string; name: string };
  stats: { likes_count: number; comments_count: number };
  has_liked: boolean;
  comments: TrackDiaryComment[];
};

export async function getTrackDiaryEntry(
  entryId: string
): Promise<{ success: true; data: TrackDiaryEntryDetail } | { success: false; error: string }> {
  const supabase = await createSupabaseServer();
  const currentUser = await getAuthUser();

  const { data, error } = await (supabase as any)
    .from('track_diary_entries')
    .select('id, rating, review_title, review_body, listened_at, created_at, is_public, user_id, track_id, album_id, artist_id')
    .eq('id', entryId)
    .maybeSingle();

  if (error || !data) return { success: false, error: 'Entrée introuvable' };
  if (!data.is_public && data.user_id !== currentUser?.id) return { success: false, error: 'Entrée introuvable' };

  const [trackRes, albumRes, authorRes, artistRes, statsRes, likedRes, commentsRes] = await Promise.all([
    supabase.from('tracks').select('id, title, track_no, duration_ms').eq('id', data.track_id).maybeSingle(),
    supabase.from('albums').select('id, title, cover_url, release_date').eq('id', data.album_id).maybeSingle(),
    supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', data.user_id).maybeSingle(),
    supabase.from('artists').select('id, name').eq('id', data.artist_id).maybeSingle(),
    // Likes + comments count
    (supabase as any).from('track_diary_entry_stats').select('likes_count, comments_count').eq('entry_id', entryId).maybeSingle(),
    // Has current user liked?
    currentUser
      ? (supabase as any).from('track_diary_likes').select('user_id').eq('entry_id', entryId).eq('user_id', currentUser.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Comments
    (supabase as any).from('track_diary_comments').select('id, body, created_at, user_id, parent_comment_id').eq('entry_id', entryId).order('created_at', { ascending: true }),
  ]);

  if (!trackRes.data || !albumRes.data || !authorRes.data || !artistRes.data) {
    return { success: false, error: 'Données incomplètes' };
  }

  const commentUserIds = [...new Set(((commentsRes.data ?? []) as any[]).map((c: any) => c.user_id))];
  const { data: commentProfiles } = commentUserIds.length > 0
    ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', commentUserIds)
    : { data: [] };
  const profilesMap = new Map((commentProfiles ?? []).map((p: any) => [p.id, p]));

  const allComments: TrackDiaryComment[] = ((commentsRes.data ?? []) as any[]).map((c: any) => {
    const profile = profilesMap.get(c.user_id) as any;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      parent_comment_id: c.parent_comment_id ?? null,
      author: { id: c.user_id, username: profile?.username || 'unknown', display_name: profile?.display_name || null, avatar_url: profile?.avatar_url || null },
      is_mine: currentUser?.id === c.user_id,
      replies: [],
    };
  });

  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const topLevelComments: TrackDiaryComment[] = [];
  for (const c of allComments) {
    if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
      commentMap.get(c.parent_comment_id)!.replies.push(c);
    } else {
      topLevelComments.push(c);
    }
  }

  return {
    success: true,
    data: {
      id: data.id,
      rating: data.rating,
      review_title: data.review_title,
      review_body: data.review_body,
      listened_at: data.listened_at,
      created_at: data.created_at,
      is_public: data.is_public,
      author: authorRes.data as any,
      track: trackRes.data as any,
      album: albumRes.data as any,
      artist: artistRes.data as any,
      stats: { likes_count: statsRes.data?.likes_count ?? 0, comments_count: statsRes.data?.comments_count ?? 0 },
      has_liked: !!likedRes.data,
      comments: topLevelComments,
    },
  };
}

export async function getAlbumTracksStats(albumId: string): Promise<Map<string, TrackStat>> {
  const supabase = await createSupabaseServer();

  // Get all track IDs for this album first
  const { data: trackIds } = await supabase
    .from('tracks')
    .select('id')
    .eq('album_id', albumId);

  if (!trackIds || trackIds.length === 0) return new Map();

  const ids = trackIds.map((t: any) => t.id);

  const { data, error } = await (supabase as any)
    .from('track_stats')
    .select('track_id, avg_rating, ratings_count, listeners_count')
    .in('track_id', ids);

  if (error || !data) return new Map();

  return new Map(
    data.map((row: any) => [
      row.track_id,
      {
        avg_rating: row.avg_rating ? Number(row.avg_rating) : null,
        ratings_count: row.ratings_count || 0,
        listeners_count: row.listeners_count || 0,
      },
    ])
  );
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
  delta?: number | null; // positif = montée, négatif = descente, null = nouveau
};

export async function getTrendingTracks(limit = 10): Promise<TrackWithStats[]> {
  const supabase = await createSupabaseServer();
  const now = Date.now();
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Fenêtre de comparaison décalée d'1 jour (pas de 7) — voir getTrendingThisWeek
  // dans app/actions/explore.ts pour le même raisonnement côté albums.
  const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: prevData }] = await Promise.all([
    (supabase as any)
      .from('track_diary_entries')
      .select('track_id, rating')
      .gte('created_at', since)
      .eq('is_public', true),
    (supabase as any)
      .from('track_diary_entries')
      .select('track_id')
      .gte('created_at', eightDaysAgo)
      .lt('created_at', oneDayAgo)
      .eq('is_public', true),
  ]);

  if (error || !data || data.length === 0) return [];

  // Aggregate in JS
  const map = new Map<string, { count: number; totalRating: number; ratingCount: number }>();
  for (const row of data) {
    const existing = map.get(row.track_id) || { count: 0, totalRating: 0, ratingCount: 0 };
    existing.count++;
    if (row.rating !== null) {
      existing.totalRating += row.rating;
      existing.ratingCount++;
    }
    map.set(row.track_id, existing);
  }

  const prevCounts = new Map<string, number>();
  for (const row of prevData || []) {
    prevCounts.set(row.track_id, (prevCounts.get(row.track_id) ?? 0) + 1);
  }
  const prevRankMap = new Map(
    [...prevCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id], i) => [id, i + 1])
  );

  const sorted = [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const trackIds = sorted.map(([id]) => id);
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, album_id, albums(id, title, cover_url, artist_id, artists(id, name))')
    .in('id', trackIds);

  const trackMap = new Map((tracks || []).map((t: any) => [t.id, t]));

  return sorted
    .map(([trackId, stats], index) => {
      const track = trackMap.get(trackId) as any;
      if (!track) return null;
      const album = track.albums as any;
      const artist = album?.artists as any;
      const currentRank = index + 1;
      const prevRank = prevRankMap.get(trackId);
      return {
        track_id: trackId,
        track_title: track.title || 'Unknown',
        artist_id: artist?.id || '',
        artist_name: artist?.name || 'Unknown',
        album_id: album?.id || '',
        album_title: album?.title || 'Unknown',
        cover_url: album?.cover_url || null,
        avg_rating: stats.ratingCount > 0 ? Math.round((stats.totalRating / stats.ratingCount) * 10) / 10 : null,
        delta: prevRank !== undefined ? prevRank - currentRank : null,
        activity_count: stats.count,
      };
    })
    .filter(Boolean) as TrackWithStats[];
}

export async function getFriendsHighRatedTracks(limit = 10): Promise<TrackWithStats[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = await createSupabaseServer();

  // Get followed user IDs
  const { data: follows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id);

  const followingIds = (follows || []).map((f: any) => f.followee_id);
  if (followingIds.length === 0) return [];

  // Get tracks already rated by the current user (to exclude)
  const { data: ownEntries } = await (supabase as any)
    .from('track_diary_entries')
    .select('track_id')
    .eq('user_id', user.id);

  const ownTrackIds = new Set((ownEntries || []).map((e: any) => e.track_id));

  // Get high-rated tracks from followed users
  const { data, error } = await (supabase as any)
    .from('track_diary_entries')
    .select('track_id, rating')
    .in('user_id', followingIds)
    .gte('rating', 8)
    .eq('is_public', true);

  if (error || !data || data.length === 0) return [];

  // Aggregate
  const map = new Map<string, { totalRating: number; count: number }>();
  for (const row of data) {
    if (ownTrackIds.has(row.track_id)) continue;
    const existing = map.get(row.track_id) || { totalRating: 0, count: 0 };
    existing.totalRating += row.rating;
    existing.count++;
    map.set(row.track_id, existing);
  }

  const sorted = [...map.entries()]
    .sort((a, b) => b[1].totalRating / b[1].count - a[1].totalRating / a[1].count)
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const trackIds = sorted.map(([id]) => id);
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, album_id, albums(id, title, cover_url, artist_id, artists(id, name))')
    .in('id', trackIds);

  const trackMap = new Map((tracks || []).map((t: any) => [t.id, t]));

  return sorted
    .map(([trackId, stats]) => {
      const track = trackMap.get(trackId) as any;
      if (!track) return null;
      const album = track.albums as any;
      const artist = album?.artists as any;
      return {
        track_id: trackId,
        track_title: track.title || 'Unknown',
        artist_id: artist?.id || '',
        artist_name: artist?.name || 'Unknown',
        album_id: album?.id || '',
        album_title: album?.title || 'Unknown',
        cover_url: album?.cover_url || null,
        avg_rating: Math.round((stats.totalRating / stats.count) * 10) / 10,
        activity_count: stats.count,
      };
    })
    .filter(Boolean) as TrackWithStats[];
}

// ============================================================================
// LIKES & COMMENTAIRES SUR TRACK DIARY ENTRIES
// ============================================================================

export async function toggleTrackDiaryLike(entryId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');

  const rlError = await checkActionRateLimit(user.id, 'like');
  if (rlError) throw new Error(rlError);

  const supabase = await createSupabaseServer();

  const { data: existing } = await (supabase as any)
    .from('track_diary_likes')
    .select('user_id')
    .eq('entry_id', entryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await (supabase as any).from('track_diary_likes').delete().eq('entry_id', entryId).eq('user_id', user.id);
    // Remove like event from feeds
    void Promise.resolve(
      createSupabaseAdmin()
        .from('feed_events')
        .delete()
        .eq('type', 'track_like')
        .eq('actor_id', user.id)
        .eq('payload->>trackEntryId', entryId)
    ).catch(() => {});
  } else {
    await (supabase as any).from('track_diary_likes').insert({ entry_id: entryId, user_id: user.id });
    // Fanout like event
    try {
      const { data: entryData } = await (supabase as any)
        .from('track_diary_entries')
        .select('user_id, track_id, album_id, tracks(title, albums(id, title, cover_url))')
        .eq('id', entryId)
        .maybeSingle();
      if (entryData) {
        const track = (entryData as any).tracks as any;
        const album = track?.albums as any;
        const supabaseAdmin = createSupabaseAdmin();
        const { data: actorFollowers } = await supabase.from('follows').select('follower_id').eq('followee_id', user.id);
        const targetSet = new Set<string>([entryData.user_id]);
        (actorFollowers || []).forEach((f: any) => targetSet.add(f.follower_id));
        targetSet.delete(user.id);
        await fanoutEvent('track_like', {
          userId: user.id,
          trackEntryId: entryId,
          trackId: entryData.track_id,
          trackTitle: track?.title || '',
          albumId: entryData.album_id,
          albumTitle: album?.title || '',
          coverUrl: album?.cover_url || null,
          entryOwnerId: entryData.user_id,
        }, [...targetSet]);
      }
    } catch { /* fanout errors are non-fatal */ }
  }
}

export async function addTrackComment(entryId: string, body: string, parentCommentId?: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');

  const rlError = await checkActionRateLimit(user.id, 'comment');
  if (rlError) throw new Error(rlError);

  if (!body.trim()) throw new Error('Le commentaire est vide');
  if (body.trim().length > 1000) throw new Error('Commentaire trop long — max 1000 caractères');
  if (findBannedContentWord(body)) throw new Error('Ce commentaire contient du contenu inapproprié.');

  const supabase = await createSupabaseServer();

  const { data: entry } = await (supabase as any)
    .from('track_diary_entries')
    .select('id, user_id, is_public')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry) throw new Error('Entrée introuvable');
  if (!entry.is_public && entry.user_id !== user.id) throw new Error('Entrée introuvable');

  const { error } = await (supabase as any).from('track_diary_comments').insert({
    entry_id: entryId,
    user_id: user.id,
    body: body.trim(),
    ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
  });

  if (error) throw new Error('Une erreur est survenue');

  // Fanout comment event (non-fatal)
  try {
    const { data: entryData } = await (supabase as any)
      .from('track_diary_entries')
      .select('user_id, track_id, album_id, tracks(title, albums(id, title, cover_url))')
      .eq('id', entryId)
      .single();
    if (entryData) {
      const track = (entryData as any).tracks as any;
      const album = track?.albums as any;
      const { data: prevCommenters } = await (supabase as any)
        .from('track_diary_comments')
        .select('user_id')
        .eq('entry_id', entryId)
        .neq('user_id', user.id)
        .limit(500);
      const { data: actorFollowers } = await supabase.from('follows').select('follower_id').eq('followee_id', user.id);
      const targetSet = new Set<string>([entryData.user_id]);
      (prevCommenters || []).forEach((c: any) => targetSet.add(c.user_id));
      (actorFollowers || []).forEach((f: any) => targetSet.add(f.follower_id));
      targetSet.delete(user.id);
      await fanoutEvent('track_comment', {
        userId: user.id,
        trackEntryId: entryId,
        trackId: entryData.track_id,
        trackTitle: track?.title || '',
        albumId: entryData.album_id,
        albumTitle: album?.title || '',
        coverUrl: album?.cover_url || null,
        entryOwnerId: entryData.user_id,
      }, [...targetSet]);
    }
  } catch { /* fanout errors are non-fatal */ }
}

export async function deleteTrackComment(commentId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');

  const supabase = await createSupabaseServer();

  const { data: comment } = await (supabase as any)
    .from('track_diary_comments')
    .select('user_id')
    .eq('id', commentId)
    .single();

  if (!comment) throw new Error('Commentaire introuvable');
  if (comment.user_id !== user.id) throw new Error('Non autorisé');

  await (supabase as any).from('track_diary_comments').delete().eq('id', commentId);
}

export async function getTrackEntryComments(entryId: string): Promise<TrackDiaryComment[]> {
  const currentUser = await getAuthUser();
  const supabase = await createSupabaseServer();

  const { data: commentsData } = await (supabase as any)
    .from('track_diary_comments')
    .select('id, body, created_at, user_id, parent_comment_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true });

  if (!commentsData || commentsData.length === 0) return [];

  const userIds = [...new Set((commentsData as any[]).map((c: any) => c.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds);
  const profilesMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const allComments: TrackDiaryComment[] = (commentsData as any[]).map((c: any) => {
    const profile = profilesMap.get(c.user_id) as any;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      parent_comment_id: c.parent_comment_id ?? null,
      author: { id: c.user_id, username: profile?.username || 'unknown', display_name: profile?.display_name || null, avatar_url: profile?.avatar_url || null },
      is_mine: currentUser?.id === c.user_id,
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

