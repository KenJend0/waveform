import { supabase } from './supabase';

/**
 * Listes — sous-ensemble minimal de apps/web/app/actions/lists.ts, juste ce dont la
 * page album a besoin (bouton "Ajouter à une liste" + "Apparaît dans X listes").
 * La feature Listes complète (créer/réordonner/couvertures) reste Phase 7.
 */

export type UserListSummary = {
  id: string;
  title: string;
  is_default: boolean;
};

export type PublicListPreview = {
  id: string;
  title: string;
  creator_username: string;
};

export type ListAlbumItem = {
  id: string;
  album_id: string;
  album_title: string;
  artist_name: string;
  cover_url: string | null;
  mbid: string | null;
  added_at: string;
};

export type ListTrackItem = {
  id: string;
  track_id: string;
  track_title: string;
  artist_name: string;
  cover_url: string | null;
  mbid: string | null;
  album_id: string;
  album_title: string;
  artist_id: string;
  added_at: string;
};

export type UnratedItem =
  | (ListAlbumItem & { kind: 'album' })
  | (ListTrackItem & { kind: 'track' });

export type ListCoverRef = { url: string | null; mbid: string | null };

export type ProfileListUI = {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  is_default: boolean;
  item_count: number;
  cover_urls: ListCoverRef[];
  /** 3 items les plus récemment ajoutés, format "Titre – Artiste" — miroir de
   * preview_items (web, apps/web/app/actions/lists.ts). */
  preview_items: string[];
  creator_username?: string;
  creator_avatar?: string | null;
  /** Statut "sauvegardée par l'utilisateur courant" — absent (undefined) là où ce n'est
   * pas pertinent (mes propres listes), false/true calculé pour les listes publiques
   * d'autrui, cf. getPublicUserLists/getPublicLists (miroir de getPublicLists web). */
  is_saved?: boolean;
};

export type ListItem = {
  id: string;
  list_id: string;
  album_id: string | null;
  track_id: string | null;
  added_at: string;
  position: number | null;
  album?: {
    id: string;
    title: string;
    cover_url: string | null;
    mbid: string | null;
    artist: string;
  };
  track?: {
    id: string;
    title: string;
    artist: string;
    cover_url: string | null;
    mbid: string | null;
    album_id: string;
  };
};

export type ListDetail = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_default: boolean;
  item_count: number;
  cover_urls: ListCoverRef[];
  saves_count: number;
  is_saved: boolean;
  creator_username: string;
  creator_avatar: string | null;
};

async function attachListMeta(listIds: string[]): Promise<Map<string, { item_count: number; cover_urls: ListCoverRef[]; preview_items: string[] }>> {
  if (listIds.length === 0) return new Map();

  const [countRes, coverRes, previewRes] = await Promise.all([
    supabase.from('list_items').select('list_id').in('list_id', listIds),
    supabase
      .from('list_items')
      .select('list_id, album_id, albums(cover_url, mbid)')
      .in('list_id', listIds)
      .not('album_id', 'is', null)
      .order('added_at', { ascending: false }),
    supabase
      .from('list_items')
      .select('list_id, albums(title, artists(name)), tracks(title, albums(artists(name)))')
      .in('list_id', listIds)
      .order('added_at', { ascending: false }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countRes.data ?? []) countMap.set(row.list_id, (countMap.get(row.list_id) ?? 0) + 1);

  const coverMap = new Map<string, ListCoverRef[]>();
  for (const row of (coverRes.data ?? []) as any[]) {
    const existing = coverMap.get(row.list_id) ?? [];
    if (existing.length < 4) {
      existing.push({ url: row.albums?.cover_url ?? null, mbid: row.albums?.mbid ?? null });
      coverMap.set(row.list_id, existing);
    }
  }

  const previewMap = new Map<string, string[]>();
  for (const row of (previewRes.data ?? []) as any[]) {
    const existing = previewMap.get(row.list_id) ?? [];
    if (existing.length >= 3) continue;
    const album = row.albums;
    const track = row.tracks;
    if (track?.title) {
      existing.push(`${track.title} – ${track.albums?.artists?.name || 'Unknown'}`);
    } else if (album?.title) {
      existing.push(`${album.title} – ${album.artists?.name || 'Unknown'}`);
    } else {
      continue;
    }
    previewMap.set(row.list_id, existing);
  }

  const meta = new Map<string, { item_count: number; cover_urls: ListCoverRef[]; preview_items: string[] }>();
  for (const id of listIds) {
    meta.set(id, {
      item_count: countMap.get(id) ?? 0,
      cover_urls: coverMap.get(id) ?? [],
      preview_items: previewMap.get(id) ?? [],
    });
  }
  return meta;
}

/**
 * Listes du profil (mine/publiques/sauvegardées) — miroir en lecture seule de
 * getUserLists/getPublicUserLists/getUserSavedLists (apps/web/app/actions/lists.ts).
 * Affichage seul pour cette passe : créer/renommer/supprimer une liste, cover
 * personnalisée et la page détail /lists/[id] restent Phase 7 (voir roadmap).
 */
export async function getFullUserLists(userId: string): Promise<ProfileListUI[]> {
  const { data: lists } = await supabase
    .from('user_lists')
    .select('id, user_id, title, is_public, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (!lists || lists.length === 0) return [];
  const meta = await attachListMeta(lists.map((l) => l.id));
  return lists.map((l) => ({ ...l, ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [], preview_items: [] }) }));
}

export async function getUserSavedLists(userId: string): Promise<ProfileListUI[]> {
  const { data: saved } = await supabase
    .from('saved_lists')
    .select('user_lists(id, user_id, title, is_public, is_default, profiles(username, avatar_url))')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  const lists = ((saved ?? []) as any[]).map((s) => s.user_lists).filter((l) => l != null);
  if (lists.length === 0) return [];

  const meta = await attachListMeta(lists.map((l) => l.id));
  return lists.map((l) => ({
    ...l,
    ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [], preview_items: [] }),
    creator_username: l.profiles?.username ?? undefined,
    creator_avatar: l.profiles?.avatar_url ?? null,
    is_saved: true,
  }));
}

export async function getPublicUserLists(userId: string): Promise<ProfileListUI[]> {
  const { data: lists } = await supabase
    .from('user_lists')
    .select('id, user_id, title, is_public, is_default')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: true });

  if (!lists || lists.length === 0) return [];
  const meta = await attachListMeta(lists.map((l) => l.id));

  const viewerId = await currentUserId();
  let savedIds = new Set<string>();
  if (viewerId) {
    const { data: saved } = await supabase
      .from('saved_lists')
      .select('list_id')
      .eq('user_id', viewerId)
      .in('list_id', lists.map((l) => l.id));
    savedIds = new Set((saved ?? []).map((s) => s.list_id));
  }

  return lists.map((l) => ({
    ...l,
    ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [], preview_items: [] }),
    is_saved: savedIds.has(l.id),
  }));
}

/**
 * Listes publiques populaires — pour la section bonus "Listes populaires" de
 * /explore (Phase 7, pas dans le checklist d'origine — présente sur le web).
 * Miroir simplifié de getPublicLists (web) : même tri par saves_count sur un
 * pool des listes les plus récentes, sans is_saved (ListCard mobile n'a pas
 * de bouton sauvegarder pour l'instant).
 */
export async function getPublicLists(limit = 6): Promise<ProfileListUI[]> {
  const poolSize = Math.min(Math.max(limit * 5, 30), 200);

  const { data: lists } = await supabase
    .from('user_lists')
    .select('id, user_id, title, is_public, is_default, saves_count, profiles(username, avatar_url)')
    .eq('is_public', true)
    .eq('is_default', false)
    .order('created_at', { ascending: false })
    .limit(poolSize);

  if (!lists || lists.length === 0) return [];

  const meta = await attachListMeta(lists.map((l) => l.id));

  const viewerId = await currentUserId();
  let savedIds = new Set<string>();
  if (viewerId) {
    const { data: saved } = await supabase
      .from('saved_lists')
      .select('list_id')
      .eq('user_id', viewerId)
      .in('list_id', lists.map((l) => l.id));
    savedIds = new Set((saved ?? []).map((s) => s.list_id));
  }

  return (lists as any[])
    .sort((a, b) => (b.saves_count ?? 0) - (a.saves_count ?? 0))
    .slice(0, limit)
    .map((list) => ({
      id: list.id,
      user_id: list.user_id,
      title: list.title,
      is_public: list.is_public,
      is_default: list.is_default,
      creator_username: list.profiles?.username ?? undefined,
      creator_avatar: list.profiles?.avatar_url ?? null,
      is_saved: savedIds.has(list.id),
      ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], preview_items: [] }),
    }));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Toutes les listes de l'utilisateur courant (titre + id seulement). */
export async function getUserLists(): Promise<UserListSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_lists')
    .select('id, title, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getUserLists error:', error.message);
    return [];
  }
  return data ?? [];
}

/** IDs des listes de l'utilisateur courant contenant cet album. */
export async function getUserListsContaining(albumId: string): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: lists } = await supabase.from('user_lists').select('id').eq('user_id', userId);
  if (!lists || lists.length === 0) return [];

  const { data: items } = await supabase
    .from('list_items')
    .select('list_id')
    .eq('album_id', albumId)
    .in('list_id', lists.map((l) => l.id));

  return (items ?? []).map((i) => i.list_id);
}

/** IDs des listes de l'utilisateur courant contenant ce titre. */
export async function getUserListsContainingTrack(trackId: string): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: lists } = await supabase.from('user_lists').select('id').eq('user_id', userId);
  if (!lists || lists.length === 0) return [];

  const { data: items } = await supabase
    .from('list_items')
    .select('list_id')
    .eq('track_id', trackId)
    .in('list_id', lists.map((l) => l.id));

  return (items ?? []).map((i) => i.list_id);
}

/** Listes publiques contenant cet album — pour "Apparaît dans X listes". */
export async function getPublicListsContaining(albumId: string, limit = 5): Promise<PublicListPreview[]> {
  const { data: items, error } = await supabase
    .from('list_items')
    .select('list_id, user_lists!inner(id, title, is_public, profiles(username))')
    .eq('album_id', albumId)
    .eq('user_lists.is_public', true)
    .limit(limit);

  if (error || !items) {
    console.error('getPublicListsContaining error:', error?.message);
    return [];
  }

  return (items as any[]).map((item) => ({
    id: item.user_lists.id,
    title: item.user_lists.title,
    creator_username: item.user_lists.profiles?.username ?? '',
  }));
}

/** Résout l'id de la liste par défaut ("À écouter") de l'utilisateur. */
async function resolveDefaultListId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Albums de la liste par défaut, jamais notés — miroir de getDefaultListAlbums
 * (web), pour la file de triage de la page Ajouter.
 */
export async function getDefaultListAlbums(limit = 8): Promise<ListAlbumItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const targetListId = await resolveDefaultListId(userId);
  if (!targetListId) return [];

  const [{ data: items }, { data: ratedAlbums }] = await Promise.all([
    supabase
      .from('list_items')
      .select('id, album_id, added_at, albums(id, title, cover_url, mbid, artists(name))')
      .eq('list_id', targetListId)
      .not('album_id', 'is', null)
      .order('added_at', { ascending: false })
      .limit(limit * 4),
    supabase.from('diary_entries').select('album_id').eq('user_id', userId),
  ]);

  const ratedAlbumIds = new Set((ratedAlbums ?? []).map((r) => r.album_id));

  return ((items ?? []) as any[])
    .filter((item) => !!item.album_id && !ratedAlbumIds.has(item.album_id))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      album_id: item.album_id,
      album_title: item.albums?.title || 'Unknown',
      artist_name: item.albums?.artists?.name || 'Unknown',
      cover_url: item.albums?.cover_url ?? null,
      mbid: item.albums?.mbid ?? null,
      added_at: item.added_at,
    }));
}

/**
 * Titres de la liste par défaut, jamais notés — miroir de getDefaultListTracks
 * (web), pour la file de triage de la page Ajouter.
 */
export async function getDefaultListTracks(limit = 8): Promise<ListTrackItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const targetListId = await resolveDefaultListId(userId);
  if (!targetListId) return [];

  const [{ data: items }, { data: ratedTracks }] = await Promise.all([
    supabase
      .from('list_items')
      .select('id, track_id, added_at, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, mbid), artists(name))')
      .eq('list_id', targetListId)
      .not('track_id', 'is', null)
      .order('added_at', { ascending: false })
      .limit(limit * 4),
    supabase.from('track_diary_entries').select('track_id').eq('user_id', userId),
  ]);

  const ratedTrackIds = new Set((ratedTracks ?? []).map((r) => r.track_id));

  return ((items ?? []) as any[])
    .filter((item) => !!item.track_id && !ratedTrackIds.has(item.track_id))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      track_id: item.track_id,
      track_title: item.tracks?.title || 'Unknown',
      artist_name: item.tracks?.artists?.name || 'Unknown',
      cover_url: item.tracks?.albums?.cover_url ?? null,
      mbid: item.tracks?.albums?.mbid ?? null,
      album_id: item.tracks?.album_id || '',
      album_title: item.tracks?.albums?.title || '',
      artist_id: item.tracks?.artist_id || '',
      added_at: item.added_at,
    }));
}

/**
 * Albums/titres présents dans une liste de l'utilisateur (toutes listes
 * confondues) mais jamais notés dans son journal — miroir de
 * getUnratedSavedItems (web), source prioritaire de la file de triage.
 */
export async function getUnratedSavedItems(limit = 30): Promise<UnratedItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: lists } = await supabase.from('user_lists').select('id').eq('user_id', userId);
  if (!lists || lists.length === 0) return [];
  const listIds = lists.map((l) => l.id);

  const [albumItemsRes, trackItemsRes, ratedAlbumsRes, ratedTracksRes] = await Promise.all([
    supabase
      .from('list_items')
      .select('id, album_id, added_at, albums(id, title, cover_url, mbid, artists(name))')
      .in('list_id', listIds)
      .not('album_id', 'is', null)
      .order('added_at', { ascending: false }),
    supabase
      .from('list_items')
      .select('id, track_id, added_at, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, mbid), artists(name))')
      .in('list_id', listIds)
      .not('track_id', 'is', null)
      .order('added_at', { ascending: false }),
    supabase.from('diary_entries').select('album_id').eq('user_id', userId),
    supabase.from('track_diary_entries').select('track_id').eq('user_id', userId),
  ]);

  const ratedAlbumIds = new Set((ratedAlbumsRes.data ?? []).map((r) => r.album_id));
  const ratedTrackIds = new Set((ratedTracksRes.data ?? []).map((r) => r.track_id));

  const seenAlbums = new Set<string>();
  const unratedAlbums: (ListAlbumItem & { kind: 'album' })[] = [];
  for (const item of (albumItemsRes.data ?? []) as any[]) {
    if (!item.album_id || ratedAlbumIds.has(item.album_id) || seenAlbums.has(item.album_id)) continue;
    seenAlbums.add(item.album_id);
    unratedAlbums.push({
      kind: 'album',
      id: item.id,
      album_id: item.album_id,
      album_title: item.albums?.title || 'Unknown',
      artist_name: item.albums?.artists?.name || 'Unknown',
      cover_url: item.albums?.cover_url ?? null,
      mbid: item.albums?.mbid ?? null,
      added_at: item.added_at,
    });
  }

  const seenTracks = new Set<string>();
  const unratedTracks: (ListTrackItem & { kind: 'track' })[] = [];
  for (const item of (trackItemsRes.data ?? []) as any[]) {
    if (!item.track_id || ratedTrackIds.has(item.track_id) || seenTracks.has(item.track_id)) continue;
    seenTracks.add(item.track_id);
    unratedTracks.push({
      kind: 'track',
      id: item.id,
      track_id: item.track_id,
      track_title: item.tracks?.title || 'Unknown',
      artist_name: item.tracks?.artists?.name || 'Unknown',
      cover_url: item.tracks?.albums?.cover_url ?? null,
      mbid: item.tracks?.albums?.mbid ?? null,
      album_id: item.tracks?.album_id || '',
      album_title: item.tracks?.albums?.title || '',
      artist_id: item.tracks?.artist_id || '',
      added_at: item.added_at,
    });
  }

  return [...unratedAlbums, ...unratedTracks]
    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
    .slice(0, limit);
}

/** Crée ou retrouve la liste "À écouter" par défaut de l'utilisateur. */
export async function getOrCreateDefaultList(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('user_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('user_lists')
    .insert({ user_id: userId, title: 'À écouter', is_public: false, is_default: true })
    .select('id')
    .single();

  if (error?.code === '23505') {
    const { data: retry } = await supabase
      .from('user_lists')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();
    if (retry) return retry.id;
  }
  if (error || !created) throw error ?? new Error('Default list creation failed');
  return created.id;
}

/** Ajoute ou retire un album OU un titre d'une liste (toggle) — exactement l'un des deux. */
export async function toggleListItem(listId: string, item: { albumId?: string; trackId?: string }): Promise<{ added: boolean }> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: list } = await supabase.from('user_lists').select('id').eq('id', listId).eq('user_id', userId).maybeSingle();
  if (!list) throw new Error('List not found');

  let query = supabase.from('list_items').select('id').eq('list_id', listId);
  query = item.albumId ? query.eq('album_id', item.albumId) : query.eq('track_id', item.trackId!);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase.from('list_items').delete().eq('id', existing.id);
    if (error) throw new Error('Une erreur est survenue');
    return { added: false };
  }

  const { error } = await supabase
    .from('list_items')
    .insert({ list_id: listId, album_id: item.albumId ?? null, track_id: item.trackId ?? null });
  if (error) throw new Error('Une erreur est survenue');
  return { added: true };
}

// ── Phase 7 — page détail /lists/[id] ───────────────────────────────────────
// Pas de Server Action côté mobile (comme le reste de ce fichier) : les écritures
// tournent client-side sous RLS. Pas de rate-limiting client (checkActionRateLimit,
// web) ni de logAuthedProductEvent — mêmes omissions que toggleListItem ci-dessus.

/**
 * Détail d'une liste avec ses items — miroir de getListWithItems (web), sans le
 * check RLS serveur (la policy Supabase sur user_lists fait déjà foi ; ce check
 * client-side sert juste à renvoyer `null` proprement plutôt qu'un tableau vide
 * silencieux quand la liste est privée et qu'on n'en est pas propriétaire).
 */
export async function getListWithItems(listId: string): Promise<{ list: ListDetail; items: ListItem[] } | null> {
  const userId = await currentUserId();

  const { data: list } = await supabase
    .from('user_lists')
    .select('id, user_id, title, description, is_public, is_default, saves_count, profiles(username, avatar_url)')
    .eq('id', listId)
    .maybeSingle();

  if (!list) return null;
  const listRow = list as any;
  if (!listRow.is_public && listRow.user_id !== userId) return null;

  const { data: items } = await supabase
    .from('list_items')
    .select(
      `id, list_id, album_id, track_id, added_at, position,
       albums(id, title, cover_url, mbid, artists(name)),
       tracks(id, title, album_id, artists(name), albums(cover_url, mbid))`
    )
    .eq('list_id', listId)
    .order('position', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });

  const saveStatus = userId
    ? await supabase.from('saved_lists').select('id').eq('list_id', listId).eq('user_id', userId).maybeSingle()
    : { data: null };

  const itemRows = (items ?? []) as any[];
  const coverUrls: ListCoverRef[] = itemRows
    .filter((item) => !!item.albums?.cover_url)
    .map((item) => ({ url: item.albums.cover_url as string, mbid: item.albums.mbid ?? null }))
    .slice(0, 4);

  return {
    list: {
      id: listRow.id,
      user_id: listRow.user_id,
      title: listRow.title,
      description: listRow.description,
      is_public: listRow.is_public,
      is_default: listRow.is_default,
      item_count: itemRows.length,
      cover_urls: coverUrls,
      saves_count: listRow.saves_count ?? 0,
      is_saved: !!saveStatus.data,
      creator_username: listRow.profiles?.username || '',
      creator_avatar: listRow.profiles?.avatar_url ?? null,
    },
    items: itemRows.map((item) => ({
      id: item.id,
      list_id: item.list_id,
      album_id: item.album_id ?? null,
      track_id: item.track_id ?? null,
      added_at: item.added_at,
      position: item.position ?? null,
      album:
        item.album_id && item.albums
          ? {
              id: item.albums.id,
              title: item.albums.title,
              cover_url: item.albums.cover_url ?? null,
              mbid: item.albums.mbid ?? null,
              artist: item.albums.artists?.name || 'Unknown',
            }
          : undefined,
      track:
        item.track_id && item.tracks
          ? {
              id: item.tracks.id,
              title: item.tracks.title,
              artist: item.tracks.artists?.name || 'Unknown',
              cover_url: item.tracks.albums?.cover_url ?? null,
              mbid: item.tracks.albums?.mbid ?? null,
              album_id: item.tracks.album_id,
            }
          : undefined,
    })),
  };
}

/** Crée une nouvelle liste — miroir de createList (web), sans cover/description avancées. */
export async function createList(data: { title: string; description?: string; isPublic?: boolean }): Promise<{ id: string }> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const title = data.title.trim();
  if (!title) throw new Error('List title is required');
  const description = data.description?.trim() || null;

  const { data: created, error } = await supabase
    .from('user_lists')
    .insert({ user_id: userId, title, description, is_public: data.isPublic ?? false, is_default: false })
    .select('id')
    .single();
  if (error) throw error;
  return { id: created.id };
}

/** Met à jour le titre, la description ou la visibilité d'une liste — miroir de updateList (web). */
export async function updateList(
  listId: string,
  data: { title?: string; description?: string; isPublic?: boolean }
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const updates: { updated_at: string; title?: string; description?: string | null; is_public?: boolean } = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) {
    const t = data.title.trim();
    if (!t) throw new Error('List title is required');
    updates.title = t;
  }
  if (data.description !== undefined) updates.description = data.description.trim() || null;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;

  const { error } = await supabase.from('user_lists').update(updates).eq('id', listId).eq('user_id', userId);
  if (error) throw error;
}

/** Supprime une liste (impossible sur la liste par défaut) — miroir de deleteList (web). */
export async function deleteList(listId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', userId)
    .eq('is_default', false);
  if (error) throw error;
}

/** Supprime directement un item d'une liste par son ID — miroir de removeListItem (web). */
export async function removeListItem(itemId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: item } = await supabase.from('list_items').select('list_id').eq('id', itemId).maybeSingle();
  if (!item) return;

  const { data: list } = await supabase
    .from('user_lists')
    .select('id')
    .eq('id', item.list_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!list) throw new Error('Not authorized');

  const { error } = await supabase.from('list_items').delete().eq('id', itemId);
  if (error) throw new Error('Une erreur est survenue');
}

/**
 * Réordonne les items d'une liste — miroir de reorderListItems (web). Pas de drag-and-drop
 * côté mobile (voir ListDetailReorder.tsx) : orderedItemIds vient d'un mode "Réorganiser"
 * à flèches haut/bas, mais le contrat serveur est identique (position = index).
 */
export async function reorderListItems(listId: string, orderedItemIds: string[]): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: list } = await supabase.from('user_lists').select('id').eq('id', listId).eq('user_id', userId).maybeSingle();
  if (!list) throw new Error('Not authorized');

  const results = await Promise.all(
    orderedItemIds.map((itemId, index) =>
      supabase.from('list_items').update({ position: index }).eq('id', itemId).eq('list_id', listId)
    )
  );
  if (results.some((r) => r.error)) throw new Error('Une erreur est survenue');
}

/**
 * Sauvegarde ou retire une liste publique de sa collection — miroir de toggleSaveList (web).
 */
export async function toggleSaveList(listId: string): Promise<{ saved: boolean }> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('saved_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('saved_lists').delete().eq('id', existing.id);
    if (error) throw new Error('Une erreur est survenue');
    return { saved: false };
  }

  const { data: list } = await supabase.from('user_lists').select('id').eq('id', listId).eq('is_public', true).maybeSingle();
  if (!list) throw new Error('List not found');

  const { error } = await supabase.from('saved_lists').insert({ user_id: userId, list_id: listId });
  if (error) throw new Error('Une erreur est survenue');
  return { saved: true };
}
