import { supabase } from './supabase';

/** Miroir mobile des types d'événements du feed web (voir apps/web/app/actions/feed.ts). */
export type FeedEventType =
  | 'REVIEW_CREATED'
  | 'UNRATED_LISTEN'
  | 'REVIEW_LIKED'
  | 'USER_FOLLOWED'
  | 'COMMENT_CREATED'
  | 'COMMENT_REPLY'
  | 'TRACK_REVIEW_CREATED'
  | 'TRACK_REVIEW_LIKED'
  | 'TRACK_COMMENT_CREATED';

export type FeedScope = 'notifications' | 'activity';

export type FeedActor = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  actor: FeedActor;
  followee?: FeedActor;
  album?: {
    id: string;
    title: string;
    cover_url: string | null;
    artist_id?: string;
    artist_name?: string;
  };
  track?: {
    id: string;
    title: string;
    album_id: string;
    album_title: string;
    cover_url: string | null;
    artist_name?: string;
  };
  rating?: number;
  review_excerpt?: string;
  entry_id?: string;
  liked_entry_id?: string;
  likes_count?: number;
  is_liked?: boolean;
  comments_count?: number;
  entry_owner_id?: string;
  target_has_review?: boolean;
  current_user_also_commented?: boolean;
  comment_id?: string;
  is_reply?: boolean;
  created_at: string;
  _dedup_key?: string;
  // Agrégation d'événements consécutifs ciblant l'utilisateur courant (follow/like/comment)
  actors?: FeedActor[];
  actors_count?: number;
}

const FEED_EVENT_SELECT = `
  id, user_id, actor_id, followee_id, type, entry_id, album_id, comment_id, track_comment_id, payload, created_at,
  actor:profiles!actor_id ( id, username, avatar_url ),
  followee:profiles!followee_id ( id, username, avatar_url ),
  album:albums ( id, title, cover_url, artist_id, artist:artists ( name ) ),
  entry:diary_entries (
    id, user_id, rating, review_body, album_id, likes_count, comments_count,
    album:albums ( id, title, cover_url, artist_id, artist:artists ( name ) )
  ),
  track_comment:track_diary_comments!feed_events_track_comment_id_fkey (
    id, parent_comment_id, user_id
  )
`;

function mapFeedEvent(raw: any): FeedEvent | null {
  if (!raw.actor?.id) return null;

  const base = {
    id: raw.id,
    actor: { id: raw.actor.id, username: raw.actor.username, avatar_url: raw.actor.avatar_url },
    created_at: raw.created_at,
  };

  switch (raw.type) {
    case 'diary':
    case 'diary_entry': {
      if (!raw.entry) return null;
      const album = raw.album
        ? {
            id: raw.album.id,
            title: raw.album.title,
            cover_url: raw.album.cover_url,
            artist_id: raw.album.artist_id ?? undefined,
            artist_name: raw.album.artist?.name ?? undefined,
          }
        : undefined;

      if (raw.entry.rating !== null) {
        return {
          ...base,
          type: 'REVIEW_CREATED',
          entry_id: raw.entry.id,
          album,
          rating: raw.entry.rating,
          review_excerpt: raw.entry.review_body ?? undefined,
        };
      }
      return { ...base, type: 'UNRATED_LISTEN', entry_id: raw.entry.id, album };
    }

    case 'follow':
      return {
        ...base,
        type: 'USER_FOLLOWED',
        followee: raw.followee
          ? { id: raw.followee.id, username: raw.followee.username, avatar_url: raw.followee.avatar_url }
          : undefined,
      };

    case 'like': {
      const likeAlbum = raw.entry?.album ?? raw.album;
      if (!raw.entry || !likeAlbum) return null;
      return {
        ...base,
        type: 'REVIEW_LIKED',
        liked_entry_id: raw.entry.id,
        entry_owner_id: raw.entry.user_id ?? undefined,
        rating: raw.entry.rating ?? undefined,
        target_has_review: Boolean(String(raw.entry.review_body ?? '').trim()),
        album: {
          id: likeAlbum.id,
          title: likeAlbum.title,
          cover_url: likeAlbum.cover_url,
          artist_id: likeAlbum.artist_id ?? undefined,
          artist_name: likeAlbum.artist?.name ?? undefined,
        },
      };
    }

    case 'comment': {
      const commentAlbum = raw.entry?.album ?? raw.album;
      if (!raw.entry || !commentAlbum) return null;
      const album = {
        id: commentAlbum.id,
        title: commentAlbum.title,
        cover_url: commentAlbum.cover_url,
        artist_id: commentAlbum.artist_id ?? undefined,
        artist_name: commentAlbum.artist?.name ?? undefined,
      };

      if (raw.payload?.parentCommentId) {
        return {
          ...base,
          type: 'COMMENT_REPLY',
          entry_id: raw.entry.id,
          comment_id: raw.comment_id ?? undefined,
          album,
          is_reply: true,
        };
      }
      return {
        ...base,
        type: 'COMMENT_CREATED',
        entry_id: raw.entry.id,
        entry_owner_id: raw.entry.user_id ?? undefined,
        target_has_review: Boolean(String(raw.entry.review_body ?? '').trim()),
        album,
      };
    }

    case 'comment_reply': {
      const replyAlbum = raw.entry?.album ?? raw.album;
      if (!replyAlbum) return null;
      return {
        ...base,
        type: 'COMMENT_REPLY',
        entry_id: raw.entry?.id ?? undefined,
        comment_id: raw.comment_id ?? undefined,
        is_reply: true,
        album: {
          id: replyAlbum.id,
          title: replyAlbum.title,
          cover_url: replyAlbum.cover_url,
          artist_id: replyAlbum.artist_id ?? undefined,
          artist_name: replyAlbum.artist?.name ?? undefined,
        },
      };
    }

    case 'track_diary_entry': {
      const p = raw.payload;
      if (!p?.trackId) return null;
      return {
        ...base,
        type: 'TRACK_REVIEW_CREATED',
        entry_id: p.trackEntryId ?? undefined,
        track: {
          id: p.trackId,
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
          artist_name: p.artistName ?? raw.album?.artist?.name ?? undefined,
        },
        album: p.albumId ? { id: p.albumId, title: p.albumTitle || '', cover_url: p.coverUrl ?? null } : undefined,
        rating: p.rating ?? undefined,
        review_excerpt: p.reviewBody ?? undefined,
      };
    }

    case 'track_like': {
      const p = raw.payload;
      if (!p?.trackEntryId) return null;
      return {
        ...base,
        type: 'TRACK_REVIEW_LIKED',
        entry_id: p.trackEntryId ?? undefined,
        liked_entry_id: p.trackEntryId ?? undefined,
        entry_owner_id: p.entryOwnerId ?? undefined,
        track: {
          id: p.trackId || '',
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
        },
      };
    }

    case 'track_comment': {
      const p = raw.payload;
      if (!p?.trackEntryId) return null;
      return {
        ...base,
        type: 'TRACK_COMMENT_CREATED',
        entry_id: p.trackEntryId ?? undefined,
        comment_id: raw.track_comment?.id ?? p.commentId ?? undefined,
        entry_owner_id: p.entryOwnerId ?? undefined,
        is_reply: Boolean(raw.track_comment?.parent_comment_id ?? p.parentCommentId),
        track: {
          id: p.trackId || '',
          title: p.trackTitle || '',
          album_id: p.albumId || '',
          album_title: p.albumTitle || '',
          cover_url: p.coverUrl ?? null,
        },
      };
    }

    default:
      return null;
  }
}

/** Un événement notifie l'utilisateur courant (onglet "Pour moi") plutôt que d'être de l'activité réseau générique. */
function isNotificationFeedEvent(event: FeedEvent, currentUserId: string): boolean {
  if (event.type === 'USER_FOLLOWED') return event.followee?.id === currentUserId;
  if (event.type === 'COMMENT_REPLY') return true;
  if (event.type === 'REVIEW_LIKED' || event.type === 'TRACK_REVIEW_LIKED') {
    return event.entry_owner_id === currentUserId;
  }
  if (event.type === 'COMMENT_CREATED' || event.type === 'TRACK_COMMENT_CREATED') {
    if (event.is_reply) return true;
    return event.entry_owner_id === currentUserId;
  }
  return false;
}

function eventMatchesScope(event: FeedEvent, scope: FeedScope, currentUserId: string): boolean {
  const isNotification = isNotificationFeedEvent(event, currentUserId);
  return scope === 'notifications' ? isNotification : !isNotification;
}

/**
 * Regroupe les événements consécutifs (follow/like/comment) qui ciblent l'utilisateur
 * courant et se produisent à moins de 24h d'écart — même logique que le web
 * (voir apps/web/app/actions/feed.ts aggregateFeedEvents), portée uniquement pour
 * les types présents côté mobile.
 */
function aggregateFeedEvents(events: FeedEvent[], currentUserId: string): FeedEvent[] {
  const MS_24H = 24 * 60 * 60 * 1000;
  const result: FeedEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const e = events[i];

    if (e.type === 'USER_FOLLOWED' && e.followee?.id === currentUserId && e.actor.id !== currentUserId) {
      const group = [e];
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'USER_FOLLOWED' &&
        events[j].followee?.id === currentUserId &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        group.push(events[j++]);
      }
      result.push(
        group.length > 1
          ? { ...e, actors: group.slice(0, 5).map((ev) => ev.actor), actors_count: group.length }
          : e
      );
      i = j;
      continue;
    }

    if (e.type === 'REVIEW_LIKED' && e.entry_owner_id === currentUserId && e.liked_entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seen = new Set([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'REVIEW_LIKED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].liked_entry_id === e.liked_entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seen.has(events[j].actor.id)) {
          seen.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(
        group.length > 1
          ? { ...e, actors: group.slice(0, 5).map((ev) => ev.actor), actors_count: group.length }
          : e
      );
      i = j;
      continue;
    }

    if (e.type === 'COMMENT_CREATED' && e.entry_owner_id === currentUserId && e.entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seen = new Set([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'COMMENT_CREATED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].entry_id === e.entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seen.has(events[j].actor.id)) {
          seen.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(
        group.length > 1
          ? { ...e, actors: group.slice(0, 5).map((ev) => ev.actor), actors_count: group.length }
          : e
      );
      i = j;
      continue;
    }

    if (e.type === 'TRACK_REVIEW_LIKED' && e.entry_owner_id === currentUserId && e.liked_entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seen = new Set([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'TRACK_REVIEW_LIKED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].liked_entry_id === e.liked_entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seen.has(events[j].actor.id)) {
          seen.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(
        group.length > 1
          ? { ...e, actors: group.slice(0, 5).map((ev) => ev.actor), actors_count: group.length }
          : e
      );
      i = j;
      continue;
    }

    if (e.type === 'TRACK_COMMENT_CREATED' && e.entry_owner_id === currentUserId && e.entry_id && e.actor.id !== currentUserId) {
      const group = [e];
      const seen = new Set([e.actor.id]);
      const anchor = new Date(e.created_at).getTime();
      let j = i + 1;
      while (
        j < events.length &&
        events[j].type === 'TRACK_COMMENT_CREATED' &&
        events[j].entry_owner_id === currentUserId &&
        events[j].entry_id === e.entry_id &&
        events[j].actor.id !== currentUserId &&
        anchor - new Date(events[j].created_at).getTime() < MS_24H
      ) {
        if (!seen.has(events[j].actor.id)) {
          seen.add(events[j].actor.id);
          group.push(events[j]);
        }
        j++;
      }
      result.push(
        group.length > 1
          ? { ...e, actors: group.slice(0, 5).map((ev) => ev.actor), actors_count: group.length }
          : e
      );
      i = j;
      continue;
    }

    result.push(e);
    i++;
  }

  return result;
}

/**
 * Fil scindé "Pour moi" (notifications) / "Réseau" (activité), avec agrégation des
 * likes/follows/commentaires consécutifs — miroir simplifié de apps/web/app/actions/feed.ts.
 * Le regroupement des écoutes/likes rapprochés en carte dépliable (ListenGroup/LikeGroup)
 * est porté côté client, voir components/feed/groupFeedEvents.ts.
 */
export async function getMyFeed({
  limit = 20,
  cursor = null,
  scope = 'notifications',
}: { limit?: number; cursor?: string | null; scope?: FeedScope } = {}): Promise<{
  success: boolean;
  events: FeedEvent[];
  nextCursor: string | null;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { success: false, events: [], nextCursor: null };

  const { data: blockedRows } = await supabase.from('user_blocks').select('blocked_id');
  const blockedIds = (blockedRows ?? []).map((r: any) => r.blocked_id);

  const queryLimit = Math.max(limit * 5, 100);
  const maxBatches = 5;
  const rawEvents: any[] = [];
  let scanCursor = cursor;
  let reachedEnd = false;

  for (let batch = 0; batch < maxBatches; batch++) {
    let query = supabase
      .from('feed_events')
      .select(FEED_EVENT_SELECT)
      .eq('user_id', user.id)
      .neq('actor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(queryLimit);

    if (blockedIds.length > 0) {
      query = query.not('actor_id', 'in', `(${blockedIds.join(',')})`);
    }
    if (scanCursor) {
      query = query.lt('created_at', scanCursor);
    }

    const { data: batchEvents, error } = await query;
    if (error) return { success: false, events: [], nextCursor: null };
    if (!batchEvents || batchEvents.length === 0) {
      reachedEnd = true;
      break;
    }

    rawEvents.push(...batchEvents);
    scanCursor = batchEvents[batchEvents.length - 1].created_at;

    if (batchEvents.length < queryLimit) {
      reachedEnd = true;
      break;
    }
  }

  if (rawEvents.length === 0) {
    return { success: true, events: [], nextCursor: null };
  }

  const entryIds = rawEvents.filter((e: any) => e.entry_id).map((e: any) => e.entry_id);

  const trackEntryIds = rawEvents
    .filter((e: any) => e.type === 'track_diary_entry' && e.payload?.trackEntryId)
    .map((e: any) => e.payload.trackEntryId);
  const allTrackInteractionEntryIds = Array.from(
    new Set(
      rawEvents
        .filter((e: any) => ['track_diary_entry', 'track_like', 'track_comment'].includes(e.type) && e.payload?.trackEntryId)
        .map((e: any) => e.payload.trackEntryId)
    )
  );
  const trackCommentEventEntryIds = rawEvents
    .filter((e: any) => e.type === 'track_comment' && e.payload?.trackEntryId)
    .map((e: any) => e.payload.trackEntryId);

  const [
    { data: likedData },
    { data: statsData },
    { data: commentedData },
    { data: trackStatsData },
    { data: trackLikedData },
    { data: trackCommentedData },
    { data: trackEntryReviewData },
  ] = await Promise.all([
    entryIds.length > 0
      ? supabase.from('diary_likes').select('entry_id').in('entry_id', entryIds).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    entryIds.length > 0
      ? supabase.from('diary_entry_stats').select('entry_id, likes_count, comments_count').in('entry_id', entryIds)
      : Promise.resolve({ data: [] }),
    entryIds.length > 0
      ? supabase.from('diary_comments').select('entry_id').in('entry_id', entryIds).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    trackEntryIds.length > 0
      ? supabase.from('track_diary_entry_stats').select('entry_id, likes_count, comments_count').in('entry_id', trackEntryIds)
      : Promise.resolve({ data: [] }),
    trackEntryIds.length > 0
      ? supabase.from('track_diary_likes').select('entry_id').in('entry_id', trackEntryIds).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    trackCommentEventEntryIds.length > 0
      ? supabase.from('track_diary_comments').select('entry_id').in('entry_id', trackCommentEventEntryIds).eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    allTrackInteractionEntryIds.length > 0
      ? supabase.from('track_diary_entries').select('id, rating, review_body').in('id', allTrackInteractionEntryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const likedEntryIds = new Set((likedData ?? []).map((l: any) => l.entry_id));
  const statsMap = new Map((statsData ?? []).map((s: any) => [s.entry_id, s]));
  const commentedEntryIds = new Set((commentedData ?? []).map((c: any) => c.entry_id));
  const trackStatsMap = new Map((trackStatsData ?? []).map((s: any) => [s.entry_id, s]));
  const trackLikedIds = new Set((trackLikedData ?? []).map((l: any) => l.entry_id));
  const trackCommentedEntryIds = new Set((trackCommentedData ?? []).map((c: any) => c.entry_id));
  const trackEntryMap = new Map((trackEntryReviewData ?? []).map((e: any) => [e.id, e]));

  const events = rawEvents
    .map((raw: any) => {
      const mapped = mapFeedEvent(raw);
      if (!mapped) return null;
      if (mapped.type === 'REVIEW_CREATED' && mapped.entry_id) {
        const stats = statsMap.get(mapped.entry_id) as any;
        mapped.likes_count = stats?.likes_count ?? 0;
        mapped.comments_count = stats?.comments_count ?? 0;
        mapped.is_liked = likedEntryIds.has(mapped.entry_id);
      }
      if (mapped.type === 'TRACK_REVIEW_CREATED' && mapped.entry_id) {
        const stats = trackStatsMap.get(mapped.entry_id) as any;
        mapped.likes_count = stats?.likes_count ?? 0;
        mapped.comments_count = stats?.comments_count ?? 0;
        mapped.is_liked = trackLikedIds.has(mapped.entry_id);
      }
      if (
        (mapped.type === 'TRACK_REVIEW_LIKED' || mapped.type === 'TRACK_COMMENT_CREATED') &&
        mapped.entry_id
      ) {
        const trackEntry = trackEntryMap.get(mapped.entry_id) as any;
        mapped.target_has_review = Boolean(String(trackEntry?.review_body ?? '').trim());
        if (mapped.type === 'TRACK_REVIEW_LIKED') {
          mapped.rating = trackEntry?.rating ?? undefined;
        }
      }
      if (mapped.type === 'COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
        mapped.current_user_also_commented = commentedEntryIds.has(mapped.entry_id);
      }
      if (mapped.type === 'TRACK_COMMENT_CREATED' && mapped.entry_id && mapped.actor.id !== user.id) {
        mapped.current_user_also_commented = trackCommentedEntryIds.has(mapped.entry_id);
      }
      return mapped;
    })
    .filter(Boolean) as FeedEvent[];

  const allScopedEvents = events.filter((event) => eventMatchesScope(event, scope, user.id));
  const scopedEvents = allScopedEvents.slice(0, limit);
  const aggregated = aggregateFeedEvents(scopedEvents, user.id);

  const nextCursor =
    allScopedEvents.length > limit
      ? scopedEvents[scopedEvents.length - 1].created_at
      : !reachedEnd && rawEvents.length > 0
        ? rawEvents[rawEvents.length - 1].created_at
        : null;

  return { success: true, events: aggregated, nextCursor };
}

/** Dernière visite de /feed par l'utilisateur courant — sert de frontière "non lu" (miroir web). */
export async function getLastSeenActivityAt(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('last_seen_activity_at')
    .eq('id', user.id)
    .maybeSingle();

  return (data as any)?.last_seen_activity_at ?? null;
}

/**
 * Y a-t-il de l'activité non vue depuis la dernière visite de /feed ? — miroir de
 * hasUnseenActivity (web, apps/web/app/actions/feed.ts), utilisé pour le badge de la
 * bottom nav (contrairement au badge des onglets "Pour moi"/"Réseau", qui compte sur les
 * events déjà chargés en mémoire, celui-ci fait une vraie requête count en base).
 */
export async function hasUnseenActivity(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_seen_activity_at')
    .eq('id', user.id)
    .maybeSingle();

  const since = (profile as any)?.last_seen_activity_at ?? new Date(0).toISOString();

  const { count } = await supabase
    .from('feed_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('actor_id', user.id)
    .gt('created_at', since)
    .limit(1);

  return (count ?? 0) > 0;
}

/** Marque l'activité comme vue par l'utilisateur courant — n'écrit jamais dans feed_events. */
export async function markActivitySeen(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_activity_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('markActivitySeen error:', error.message, error.code);
    throw new Error('An error occurred');
  }
}

/**
 * Like/unlike une critique — délègue à l'Edge Function `toggle-like` (supabase/functions/toggle-like)
 * qui fait le toggle ET le fanout dans feed_events (miroir server-side de toggleDiaryLike, web).
 * Un appel direct depuis le client ne pourrait pas écrire feed_events pour d'autres utilisateurs
 * (followers, propriétaire de l'entrée) sans la clé service_role, qui ne doit jamais être embarquée
 * dans l'app mobile.
 */
export async function toggleDiaryLike(entryId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('toggle-like', {
    body: { kind: 'diary', entryId },
  });
  if (error || (data as any)?.error) {
    console.error('toggleDiaryLike error:', error?.message ?? (data as any)?.error);
    throw new Error('An error occurred');
  }
}

/**
 * Ajoute un commentaire de premier niveau (pas de réponses depuis mobile pour l'instant).
 * Contrairement au web, pas de fanout de notification / rate-limit / filtre de contenu ici —
 * ces garde-fous restent côté serveur (Server Actions web) tant que la mobile n'a pas
 * d'Edge Function équivalente (Phase 8).
 */
export async function addComment(entryId: string, body: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not authenticated');

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment body cannot be empty');
  if (trimmed.length > 1000) throw new Error('Comment too long');

  const { error } = await supabase
    .from('diary_comments')
    .insert({ entry_id: entryId, user_id: user.id, body: trimmed });

  if (error) {
    console.error('addComment error:', error.message, error.code);
    throw new Error('An error occurred');
  }
}

/** Équivalent de toggleDiaryLike pour les écoutes de titres (track_diary_likes), même Edge Function. */
export async function toggleTrackDiaryLike(entryId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('toggle-like', {
    body: { kind: 'track', entryId },
  });
  if (error || (data as any)?.error) {
    console.error('toggleTrackDiaryLike error:', error?.message ?? (data as any)?.error);
    throw new Error('An error occurred');
  }
}

/** Équivalent de addComment pour les écoutes de titres (track_diary_comments). */
export async function addTrackComment(entryId: string, body: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not authenticated');

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment body cannot be empty');
  if (trimmed.length > 1000) throw new Error('Comment too long');

  const { error } = await supabase
    .from('track_diary_comments')
    .insert({ entry_id: entryId, user_id: user.id, body: trimmed });

  if (error) {
    console.error('addTrackComment error:', error.message, error.code);
    throw new Error('An error occurred');
  }
}
