import type { FeedEvent } from '../../lib/feed';

export type ListenGroupItem = {
  id: string;
  kind: 'album' | 'track';
  title: string;
  subtitle?: string;
  albumTitle?: string;
  href: string;
  coverUrl?: string | null;
  rating?: number | null;
};

export type LikeGroupItem = ListenGroupItem & {
  isMyEntry: boolean;
};

export type ListenGroup = {
  type: 'LISTEN_GROUP';
  id: string;
  actor: FeedEvent['actor'];
  created_at: string;
  items: ListenGroupItem[];
};

export type LikeGroup = {
  type: 'LIKE_GROUP';
  id: string;
  actor: FeedEvent['actor'];
  created_at: string;
  items: LikeGroupItem[];
};

export type GroupedFeedItem = FeedEvent | ListenGroup | LikeGroup;

const MS_3H = 3 * 60 * 60 * 1000;

/** Clé "même jour calendaire" — le groupage ne franchit jamais minuit (miroir web). */
function getCalendarDayKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isCompactableListen(event: FeedEvent): boolean {
  if (event.type === 'UNRATED_LISTEN') return true;
  if (event.type === 'REVIEW_CREATED' || event.type === 'TRACK_REVIEW_CREATED') {
    return !event.review_excerpt;
  }
  return false;
}

function toListenGroupItem(event: FeedEvent): ListenGroupItem {
  if (event.type === 'TRACK_REVIEW_CREATED') {
    const track = event.track;
    return {
      id: event.id,
      kind: 'track',
      title: track?.title ?? 'Écoute',
      subtitle: track?.artist_name ?? track?.album_title,
      albumTitle: track?.album_title,
      href: event.entry_id ? `/track-diary/${event.entry_id}` : (track?.id ? `/tracks/${track.id}` : '#'),
      coverUrl: track?.cover_url ?? event.album?.cover_url,
      rating: event.rating,
    };
  }

  return {
    id: event.id,
    kind: 'album',
    title: event.album?.title ?? 'Écoute',
    subtitle: event.album?.artist_name,
    href: event.entry_id ? `/diary/${event.entry_id}` : `/albums/${event.album?.id ?? ''}`,
    coverUrl: event.album?.cover_url,
    rating: event.rating,
  };
}

export function formatPreviewTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? '';
  if (titles.length === 2) return `${titles[0]} et ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} et ${titles[titles.length - 1]}`;
}

/**
 * Regroupe les écoutes rapprochées (UNRATED_LISTEN / REVIEW_CREATED /
 * TRACK_REVIEW_CREATED sans texte) et les likes rapprochés (REVIEW_LIKED)
 * du même acteur, même jour calendaire, fenêtre glissante de 3h — miroir de
 * groupEvents (web FeedInfiniteList.tsx). Seuil : 3 items pour les écoutes,
 * 2 pour les likes ; en dessous, les events restent individuels.
 */
export function groupFeedEvents(events: FeedEvent[], currentUserId?: string): GroupedFeedItem[] {
  const result: GroupedFeedItem[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];

    if (isCompactableListen(event)) {
      const startIdx = i;
      const items: ListenGroupItem[] = [];
      const anchor = new Date(event.created_at).getTime();

      while (
        i < events.length &&
        isCompactableListen(events[i]) &&
        events[i].actor.id === event.actor.id &&
        getCalendarDayKey(events[i].created_at) === getCalendarDayKey(event.created_at) &&
        anchor - new Date(events[i].created_at).getTime() <= MS_3H
      ) {
        items.push(toListenGroupItem(events[i]));
        i++;
      }

      if (items.length < 3) {
        result.push(...events.slice(startIdx, i));
      } else {
        result.push({
          type: 'LISTEN_GROUP',
          id: `listen-group-${event.actor.id}-${event.created_at}-${items.length}`,
          actor: event.actor,
          created_at: event.created_at,
          items,
        });
      }
      continue;
    }

    const isLike = event.type === 'REVIEW_LIKED' || event.type === 'TRACK_REVIEW_LIKED';

    if (!isLike) {
      result.push(event);
      i++;
      continue;
    }

    const startIdx = i;
    const items: LikeGroupItem[] = [];

    while (
      i < events.length &&
      (events[i].type === 'REVIEW_LIKED' || events[i].type === 'TRACK_REVIEW_LIKED') &&
      events[i].actor.id === event.actor.id &&
      getCalendarDayKey(events[i].created_at) === getCalendarDayKey(event.created_at) &&
      new Date(event.created_at).getTime() - new Date(events[i].created_at).getTime() <= MS_3H
    ) {
      const e = events[i];
      const isTrack = e.type === 'TRACK_REVIEW_LIKED';
      items.push({
        id: e.id,
        kind: isTrack ? 'track' : 'album',
        title: isTrack ? (e.track?.title ?? e.album?.title ?? 'Écoute') : (e.album?.title ?? 'Écoute'),
        subtitle: isTrack ? (e.track?.artist_name ?? e.track?.album_title) : e.album?.artist_name,
        albumTitle: e.track?.album_title,
        href: isTrack
          ? (e.liked_entry_id ? `/track-diary/${e.liked_entry_id}` : '#')
          : (e.liked_entry_id ? `/diary/${e.liked_entry_id}` : `/albums/${e.album?.id ?? ''}`),
        coverUrl: isTrack ? (e.track?.cover_url ?? e.album?.cover_url) : e.album?.cover_url,
        rating: e.rating,
        isMyEntry: e.entry_owner_id === currentUserId,
      });
      i++;
    }

    if (items.length < 2) {
      result.push(events[startIdx]);
    } else {
      result.push({ type: 'LIKE_GROUP', id: event.id, actor: event.actor, created_at: event.created_at, items });
    }
  }

  return result;
}
