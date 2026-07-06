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
  added_at: string;
};

export type ListTrackItem = {
  id: string;
  track_id: string;
  track_title: string;
  artist_name: string;
  cover_url: string | null;
  album_id: string;
  album_title: string;
  artist_id: string;
  added_at: string;
};

export type UnratedItem =
  | (ListAlbumItem & { kind: 'album' })
  | (ListTrackItem & { kind: 'track' });

export type ProfileListUI = {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  is_default: boolean;
  item_count: number;
  cover_urls: (string | null)[];
  creator_username?: string;
  creator_avatar?: string | null;
};

async function attachListMeta(listIds: string[]): Promise<Map<string, { item_count: number; cover_urls: (string | null)[] }>> {
  if (listIds.length === 0) return new Map();

  const [countRes, coverRes] = await Promise.all([
    supabase.from('list_items').select('list_id').in('list_id', listIds),
    supabase
      .from('list_items')
      .select('list_id, album_id, albums(cover_url)')
      .in('list_id', listIds)
      .not('album_id', 'is', null)
      .order('added_at', { ascending: false }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countRes.data ?? []) countMap.set(row.list_id, (countMap.get(row.list_id) ?? 0) + 1);

  const coverMap = new Map<string, (string | null)[]>();
  for (const row of (coverRes.data ?? []) as any[]) {
    const existing = coverMap.get(row.list_id) ?? [];
    if (existing.length < 4) {
      existing.push(row.albums?.cover_url ?? null);
      coverMap.set(row.list_id, existing);
    }
  }

  const meta = new Map<string, { item_count: number; cover_urls: (string | null)[] }>();
  for (const id of listIds) {
    meta.set(id, { item_count: countMap.get(id) ?? 0, cover_urls: coverMap.get(id) ?? [] });
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
  return lists.map((l) => ({ ...l, ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [] }) }));
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
    ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [] }),
    creator_username: l.profiles?.username ?? undefined,
    creator_avatar: l.profiles?.avatar_url ?? null,
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
  return lists.map((l) => ({ ...l, ...(meta.get(l.id) ?? { item_count: 0, cover_urls: [] }) }));
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
      ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [] }),
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
      .select('id, album_id, added_at, albums(id, title, cover_url, artists(name))')
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
      .select('id, track_id, added_at, tracks(id, title, album_id, artist_id, albums(id, title, cover_url), artists(name))')
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
      .select('id, album_id, added_at, albums(id, title, cover_url, artists(name))')
      .in('list_id', listIds)
      .not('album_id', 'is', null)
      .order('added_at', { ascending: false }),
    supabase
      .from('list_items')
      .select('id, track_id, added_at, tracks(id, title, album_id, artist_id, albums(id, title, cover_url), artists(name))')
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
