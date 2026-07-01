'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAnon } from '@/lib/supabase/server';
import { logAuthedProductEvent } from '@/lib/productEvents';
import { checkActionRateLimit } from '@/lib/serverRateLimit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type SupabaseDbClient = SupabaseClient<Database>;

// ── Types ────────────────────────────────────────────────────────────────────

const LIST_TITLE_MAX_LENGTH = 120;
const LIST_DESCRIPTION_MAX_LENGTH = 1000;

export type UserList = {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    is_public: boolean;
    is_default: boolean;
    created_at: string;
    item_count: number;
    cover_urls: (string | null)[];
    custom_cover_url: string | null;
    saves_count: number;
    is_saved?: boolean;
    creator_username?: string;
    creator_avatar?: string | null;
    preview_items: string[];
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
        artist: string;
        artist_id: string;
        release_date: string | null;
    };
    track?: {
        id: string;
        title: string;
        artist: string;
        cover_url: string | null;
        album_id: string;
    };
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeListTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('List title is required');
    if (trimmed.length > LIST_TITLE_MAX_LENGTH) throw new Error('List title too long');
    return trimmed;
}

function normalizeListDescription(description: string | undefined): string | null {
    if (description === undefined) return null;
    const trimmed = description.trim();
    if (trimmed.length > LIST_DESCRIPTION_MAX_LENGTH) throw new Error('List description too long');
    return trimmed || null;
}

async function attachListMeta(listIds: string[], supabase: SupabaseDbClient): Promise<Map<string, { item_count: number; cover_urls: (string | null)[]; custom_cover_url: string | null; saves_count: number; preview_items: string[] }>> {
    if (listIds.length === 0) return new Map();

    const [countResults, coverResults, savesResults, previewResults] = await Promise.all([
        supabase
            .from('list_items')
            .select('list_id')
            .in('list_id', listIds),
        supabase
            .from('list_items')
            .select('list_id, album_id, albums(cover_url)')
            .in('list_id', listIds)
            .not('album_id', 'is', null)
            .order('added_at', { ascending: false }),
        // saves_count et custom_cover_url sont dénormalisés/stockés sur user_lists
        supabase
            .from('user_lists')
            .select('id, saves_count, custom_cover_url')
            .in('id', listIds),
        supabase
            .from('list_items')
            .select('list_id, albums(title, artists(name)), tracks(title, albums(artists(name)))')
            .in('list_id', listIds)
            .order('added_at', { ascending: false }),
    ]);

    const countMap = new Map<string, number>();
    for (const row of countResults.data || []) {
        countMap.set(row.list_id, (countMap.get(row.list_id) ?? 0) + 1);
    }

    const coverMap = new Map<string, (string | null)[]>();
    for (const row of coverResults.data || []) {
        const existing = coverMap.get(row.list_id) ?? [];
        if (existing.length < 4) {
            existing.push(row.albums?.cover_url ?? null);
            coverMap.set(row.list_id, existing);
        }
    }

    type SavesMeta = { saves_count: number; custom_cover_url: string | null };
    const savesMap = new Map<string, SavesMeta>();
    for (const row of savesResults.data || []) {
        savesMap.set(row.id, { saves_count: row.saves_count ?? 0, custom_cover_url: row.custom_cover_url ?? null });
    }

    const previewMap = new Map<string, string[]>();
    for (const row of previewResults.data || []) {
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

    const meta = new Map<string, { item_count: number; cover_urls: (string | null)[]; custom_cover_url: string | null; saves_count: number; preview_items: string[] }>();
    for (const id of listIds) {
        const saves = savesMap.get(id);
        meta.set(id, {
            item_count: countMap.get(id) ?? 0,
            cover_urls: coverMap.get(id) ?? [],
            custom_cover_url: saves?.custom_cover_url ?? null,
            saves_count: saves?.saves_count ?? 0,
            preview_items: previewMap.get(id) ?? [],
        });
    }
    return meta;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Toutes les listes de l'utilisateur authentifié (ou d'un userId donné depuis le serveur).
 */
export async function getUserLists(userId: string): Promise<UserList[]> {
    const supabase = await createSupabaseServer();

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id, user_id, title, description, is_public, is_default, created_at')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (!lists || lists.length === 0) return [];

    const meta = await attachListMeta(lists.map((l) => l.id), supabase);

    return lists.map((list) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], custom_cover_url: null, saves_count: 0, preview_items: [] }),
    }));
}

/**
 * Listes que l'utilisateur a sauvegardées (pas les siennes) — onglet "Listes" du profil.
 */
interface SavedListUserListRef {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    is_public: boolean;
    is_default: boolean;
    created_at: string;
    profiles: { username: string | null; avatar_url: string | null } | null;
}

export async function getUserSavedLists(userId: string): Promise<UserList[]> {
    const supabase = await createSupabaseServer();

    const { data: saved } = await supabase
        .from('saved_lists')
        .select('saved_at, user_lists(id, user_id, title, description, is_public, is_default, created_at, profiles(username, avatar_url))')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

    if (!saved || saved.length === 0) return [];

    const savedRows = saved as Array<{ user_lists: SavedListUserListRef | null }>;
    const lists = savedRows.map((s) => s.user_lists).filter((l): l is SavedListUserListRef => l != null);
    if (lists.length === 0) return [];

    const meta = await attachListMeta(lists.map((l) => l.id), supabase);

    return lists.map((list) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], custom_cover_url: null, saves_count: 0, preview_items: [] }),
        creator_username: list.profiles?.username ?? undefined,
        creator_avatar: list.profiles?.avatar_url ?? null,
        is_saved: true,
    }));
}

/**
 * Listes publiques d'un utilisateur (pour les profils publics).
 */
export async function getPublicUserLists(userId: string): Promise<UserList[]> {
    const supabase = createSupabaseAnon();

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id, user_id, title, description, is_public, is_default, created_at')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: true });

    if (!lists || lists.length === 0) return [];

    const meta = await attachListMeta(lists.map((l) => l.id), supabase);

    return lists.map((list) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], custom_cover_url: null, saves_count: 0, preview_items: [] }),
    }));
}

/**
 * Listes publiques populaires — pour la section /explore et la page /lists.
 * Trie par nombre de sauvegardes sur un pool des listes les plus récentes
 * (pas sur la base entière) — un compromis simple plutôt qu'un vrai
 * classement par popularité sur toute la table, suffisant au volume actuel.
 */
export async function getPublicLists(limit = 6): Promise<UserList[]> {
    const supabase = createSupabaseAnon();
    const poolSize = Math.min(Math.max(limit * 5, 30), 200);

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id, user_id, title, description, is_public, is_default, created_at, profiles(username, avatar_url)')
        .eq('is_public', true)
        .eq('is_default', false)
        .order('created_at', { ascending: false })
        .limit(poolSize);

    if (!lists || lists.length === 0) return [];

    const meta = await attachListMeta(lists.map((l) => l.id), supabase);

    const user = await getAuthUser();
    let savedIds = new Set<string>();
    if (user) {
        const authedSupabase = await createSupabaseServer();
        const { data: saved } = await authedSupabase
            .from('saved_lists')
            .select('list_id')
            .eq('user_id', user.id)
            .in('list_id', lists.map((l) => l.id));
        savedIds = new Set(((saved || []) as Array<{ list_id: string }>).map((s) => s.list_id));
    }

    return lists
        .map((list) => ({
            ...list,
            ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], custom_cover_url: null, saves_count: 0, preview_items: [] }),
            creator_username: list.profiles?.username ?? undefined,
            creator_avatar: list.profiles?.avatar_url ?? null,
            is_saved: savedIds.has(list.id),
        }))
        .sort((a: UserList, b: UserList) => b.saves_count - a.saves_count)
        .slice(0, limit);
}

/**
 * Sauvegarde ou retire une liste publique de sa collection — distinct du like,
 * sert à la retrouver plus tard plutôt qu'à juste l'apprécier.
 */
export async function toggleSaveList(listId: string): Promise<{ saved: boolean }> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'save');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
        .from('saved_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('list_id', listId)
        .maybeSingle();

    if (existing) {
        await supabase.from('saved_lists').delete().eq('id', existing.id);
        return { saved: false };
    }

    const { data: list } = await supabase
        .from('user_lists')
        .select('id')
        .eq('id', listId)
        .eq('is_public', true)
        .maybeSingle();
    if (!list) throw new Error('List not found');

    const { error: insertError } = await supabase.from('saved_lists').insert({ user_id: user.id, list_id: listId });
    if (insertError) throw new Error('An error occurred');
    return { saved: true };
}

/**
 * Listes publiques contenant cet album — pour "Apparaît dans X listes".
 */
export async function getPublicListsContaining(albumId: string, limit = 5): Promise<PublicListPreview[]> {
    const supabase = createSupabaseAnon();

    const { data: items } = await supabase
        .from('list_items')
        .select('list_id, user_lists!inner(id, title, is_public, user_id, profiles(username))')
        .eq('album_id', albumId)
        .eq('user_lists.is_public', true)
        .limit(limit);

    if (!items || items.length === 0) return [];

    return items.map((item) => ({
        id: item.user_lists.id,
        title: item.user_lists.title,
        creator_username: item.user_lists.profiles?.username ?? '',
    }));
}

/**
 * IDs des listes de l'utilisateur courant contenant cet album.
 */
export async function getUserListsContaining(albumId: string): Promise<string[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', user.id);

    if (!lists || lists.length === 0) return [];

    const listIds = lists.map((l) => l.id);

    const { data: items } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('album_id', albumId)
        .in('list_id', listIds);

    return (items || []).map((i) => i.list_id);
}

/**
 * IDs des listes de l'utilisateur courant contenant ce titre.
 */
export async function getUserListsContainingTrack(trackId: string): Promise<string[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', user.id);

    if (!lists || lists.length === 0) return [];

    const listIds = lists.map((l) => l.id);

    const { data: items } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('track_id', trackId)
        .in('list_id', listIds);

    return (items || []).map((i) => i.list_id);
}

/**
 * Résout l'id de la liste à utiliser : celle passée explicitement (après
 * vérification d'appartenance) ou la liste "À écouter" par défaut.
 */
async function resolveListId(userId: string, listId: string | undefined, supabase: SupabaseDbClient): Promise<string | null> {
    if (listId) {
        const { data: owned } = await supabase
            .from('user_lists')
            .select('id')
            .eq('id', listId)
            .eq('user_id', userId)
            .maybeSingle();
        return owned?.id ?? null;
    }

    const { data: defaultList } = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

    return defaultList?.id ?? null;
}

/**
 * Titres d'une liste (par défaut si `listId` omis) — pour la page /add.
 */
export async function getDefaultListTracks(limit = 8, listId?: string): Promise<ListTrackItem[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const targetListId = await resolveListId(user.id, listId, supabase);
    if (!targetListId) return [];

    const [{ data: items }, { data: ratedTracks }] = await Promise.all([
        supabase
            .from('list_items')
            .select('id, track_id, added_at, tracks(id, title, album_id, artist_id, albums(id, title, cover_url), artists(name))')
            .eq('list_id', targetListId)
            .not('track_id', 'is', null)
            .order('added_at', { ascending: false })
            .limit(limit * 4),
        supabase.from('track_diary_entries').select('track_id').eq('user_id', user.id),
    ]);

    const ratedTrackIds = new Set((ratedTracks || []).map((r) => r.track_id));

    return (items || [])
        // track_id est garanti non-null par le filtre .not('track_id', 'is', null) ci-dessus
        .filter((item) => !ratedTrackIds.has(item.track_id!))
        .slice(0, limit)
        .map((item) => ({
            id: item.id,
            track_id: item.track_id!,
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
 * Albums d'une liste (par défaut si `listId` omis) — pour la page /add.
 */
export async function getDefaultListAlbums(limit = 8, listId?: string): Promise<ListAlbumItem[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const targetListId = await resolveListId(user.id, listId, supabase);
    if (!targetListId) return [];

    const [{ data: items }, { data: ratedAlbums }] = await Promise.all([
        supabase
            .from('list_items')
            .select('id, album_id, added_at, albums(id, title, cover_url, artists(name))')
            .eq('list_id', targetListId)
            .not('album_id', 'is', null)
            .order('added_at', { ascending: false })
            .limit(limit * 4),
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id),
    ]);

    const ratedAlbumIds = new Set((ratedAlbums || []).map((r) => r.album_id));

    return (items || [])
        // album_id est garanti non-null par le filtre .not('album_id', 'is', null) ci-dessus
        .filter((item) => !ratedAlbumIds.has(item.album_id!))
        .slice(0, limit)
        .map((item) => ({
            id: item.id,
            album_id: item.album_id!,
            album_title: item.albums?.title || 'Unknown',
            artist_name: item.albums?.artists?.name || 'Unknown',
            cover_url: item.albums?.cover_url ?? null,
            added_at: item.added_at,
        }));
}

/**
 * Albums + titres d'une liste donnée en un seul aller — pour le switch de
 * liste sur /add (évite deux round-trips côté client).
 */
export async function getListContents(listId: string, limit = 8): Promise<{ albums: ListAlbumItem[]; tracks: ListTrackItem[] }> {
    const [albums, tracks] = await Promise.all([
        getDefaultListAlbums(limit, listId),
        getDefaultListTracks(limit, listId),
    ]);
    return { albums, tracks };
}

export type UnratedItem =
    | (ListAlbumItem & { kind: 'album' })
    | (ListTrackItem & { kind: 'track' });

/**
 * Albums/titres présents dans une liste de l'utilisateur (toutes listes
 * confondues) mais jamais notés dans son journal — source prioritaire de la
 * file de triage sur /add.
 */
export async function getUnratedSavedItems(limit = 30): Promise<UnratedItem[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const { data: lists } = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', user.id);

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
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id),
        supabase.from('track_diary_entries').select('track_id').eq('user_id', user.id),
    ]);

    const ratedAlbumIds = new Set((ratedAlbumsRes.data || []).map((r) => r.album_id));
    const ratedTrackIds = new Set((ratedTracksRes.data || []).map((r) => r.track_id));

    const seenAlbums = new Set<string>();
    const unratedAlbums: (ListAlbumItem & { kind: 'album'; added_at: string })[] = [];
    for (const item of albumItemsRes.data || []) {
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
    const unratedTracks: (ListTrackItem & { kind: 'track'; added_at: string })[] = [];
    for (const item of trackItemsRes.data || []) {
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

/**
 * Détail d'une liste avec ses items — pour /lists/[id].
 * Retourne null si la liste est privée et l'utilisateur n'en est pas propriétaire.
 */
export async function getListWithItems(listId: string): Promise<{
    list: UserList & { creator_username: string; creator_avatar: string | null };
    items: ListItem[];
} | null> {
    const supabase = await createSupabaseServer();

    const { data: list } = await supabase
        .from('user_lists')
        .select('id, user_id, title, description, is_public, is_default, created_at, saves_count, custom_cover_url, profiles(username, avatar_url)')
        .eq('id', listId)
        .maybeSingle();

    if (!list) return null;

    const user = await getAuthUser();

    if (!list.is_public) {
        if (!user || user.id !== list.user_id) return null;
    }

    const { data: items, error: itemsError } = await supabase
        .from('list_items')
        .select(`
            id, list_id, album_id, track_id, added_at, position,
            albums(id, title, cover_url, artist_id, artists(name), release_date),
            tracks(id, title, album_id, artists(name), albums(cover_url))
        `)
        .eq('list_id', listId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('added_at', { ascending: false });

    if (itemsError) console.error('getListWithItems items error:', itemsError);

    // saves_count vient directement de user_lists (dénormalisé, voir migration
    // supabase_migration_remove_list_likes.sql) — seul le statut "j'ai sauvegardé" a
    // encore besoin d'interroger saved_lists.
    const saveStatus = user
        ? await supabase.from('saved_lists').select('id').eq('list_id', listId).eq('user_id', user.id).maybeSingle()
        : { data: null };

    const profile = list.profiles;

    const coverUrls = (items || [])
        .map((item) => item.albums?.cover_url ?? null)
        .filter((url): url is string => !!url)
        .slice(0, 4);

    return {
        list: {
            id: list.id,
            user_id: list.user_id,
            title: list.title,
            description: list.description,
            is_public: list.is_public,
            is_default: list.is_default,
            created_at: list.created_at,
            item_count: items?.length ?? 0,
            cover_urls: coverUrls,
            custom_cover_url: list.custom_cover_url ?? null,
            preview_items: [],
            saves_count: list.saves_count ?? 0,
            is_saved: !!saveStatus.data,
            creator_username: profile?.username || '',
            creator_avatar: profile?.avatar_url ?? null,
        },
        items: (items || []).map((item) => ({
            id: item.id,
            list_id: item.list_id,
            album_id: item.album_id ?? null,
            track_id: item.track_id ?? null,
            added_at: item.added_at,
            position: item.position ?? null,
            album: item.album_id && item.albums
                ? {
                    id: item.albums.id,
                    title: item.albums.title,
                    cover_url: item.albums.cover_url ?? null,
                    artist: item.albums.artists?.name || 'Unknown',
                    artist_id: item.albums.artist_id,
                    release_date: item.albums.release_date ?? null,
                }
                : undefined,
            track: item.track_id && item.tracks
                ? {
                    id: item.tracks.id,
                    title: item.tracks.title,
                    artist: item.tracks.artists?.name || 'Unknown',
                    cover_url: item.tracks.albums?.cover_url ?? null,
                    album_id: item.tracks.album_id,
                }
                : undefined,
        })),
    };
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Crée ou retrouve la liste "À écouter" par défaut de l'utilisateur.
 */
export async function getOrCreateDefaultList(): Promise<string> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

    if (existing) return existing.id;

    const { data: newList, error } = await supabase
        .from('user_lists')
        .insert({ user_id: user.id, title: 'À écouter', is_public: false, is_default: true })
        .select('id')
        .single();

    if (error?.code === '23505') {
        // Race condition — une autre requête l'a créé entre temps
        const { data: retry } = await supabase
            .from('user_lists')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_default', true)
            .maybeSingle();
        if (!retry) {
            throw new Error('Default list creation conflict but no default list found on retry');
        }
        return retry.id;
    }

    if (error) throw error;
    return newList!.id;
}

/**
 * Crée une nouvelle liste.
 */
export async function createList(data: {
    title: string;
    description?: string;
    isPublic?: boolean;
}): Promise<UserList> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();
    const title = normalizeListTitle(data.title);
    const description = normalizeListDescription(data.description);

    const { data: list, error } = await supabase
        .from('user_lists')
        .insert({
            user_id: user.id,
            title,
            description,
            is_public: data.isPublic ?? false,
            is_default: false,
        })
        .select('id, user_id, title, description, is_public, is_default, created_at')
        .single();

    if (error) throw error;

    await logAuthedProductEvent('list_created', {
      surface: 'lists',
      properties: { list_id: list.id, is_public: data.isPublic ?? false },
    });

    return { ...list, item_count: 0, cover_urls: [], custom_cover_url: null, saves_count: 0, preview_items: [] };
}

/**
 * Ajoute ou retire un album/titre d'une liste (toggle).
 */
export async function toggleListItem(
    listId: string,
    data: { albumId?: string; trackId?: string }
): Promise<{ added: boolean }> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const hasAlbum = typeof data.albumId === 'string' && data.albumId.trim().length > 0;
    const hasTrack = typeof data.trackId === 'string' && data.trackId.trim().length > 0;
    if (hasAlbum === hasTrack) {
        throw new Error('Exactly one of albumId or trackId is required');
    }

    const albumId = hasAlbum ? data.albumId!.trim() : undefined;
    const trackId = hasTrack ? data.trackId!.trim() : undefined;

    if (albumId) {
        const { data: album } = await supabase
            .from('albums')
            .select('id')
            .eq('id', albumId)
            .maybeSingle();
        if (!album) throw new Error('Album not found');
    }

    if (trackId) {
        const { data: track } = await supabase
            .from('tracks')
            .select('id')
            .eq('id', trackId)
            .maybeSingle();
        if (!track) throw new Error('Track not found');
    }

    // Vérifie que l'utilisateur possède la liste
    const { data: list } = await supabase
        .from('user_lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!list) throw new Error('List not found');

    // Cherche l'item existant
    let query = supabase.from('list_items').select('id').eq('list_id', listId);
    if (albumId) query = query.eq('album_id', albumId);
    if (trackId) query = query.eq('track_id', trackId);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
        const { error: deleteError } = await supabase.from('list_items').delete().eq('id', existing.id);
        if (deleteError) throw new Error('An error occurred');
        return { added: false };
    }

    const { error: insertError } = await supabase.from('list_items').insert({
        list_id: listId,
        album_id: albumId ?? null,
        track_id: trackId ?? null,
    });
    if (insertError) throw new Error('An error occurred');

    await logAuthedProductEvent('list_item_added', {
      surface: 'lists',
      properties: {
        list_id: listId,
        album_id: albumId ?? null,
        track_id: trackId ?? null,
      },
    });

    return { added: true };
}

/**
 * Supprime directement un item d'une liste par son ID.
 */
export async function removeListItem(itemId: string): Promise<void> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    // Récupère le list_id de l'item pour vérifier que l'user en est propriétaire
    const { data: item } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('id', itemId)
        .maybeSingle();

    if (!item) return;

    const { data: list } = await supabase
        .from('user_lists')
        .select('id')
        .eq('id', item.list_id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!list) throw new Error('Not authorized');

    const { error: deleteError } = await supabase.from('list_items').delete().eq('id', itemId);
    if (deleteError) throw new Error('An error occurred');
}

/**
 * Réordonne les items d'une liste — orderedItemIds doit contenir tous les
 * items de la liste, dans l'ordre voulu (position = index dans le tableau).
 */
export async function reorderListItems(listId: string, orderedItemIds: string[]): Promise<void> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const { data: list } = await supabase
        .from('user_lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!list) throw new Error('Not authorized');

    const results = await Promise.all(
        orderedItemIds.map((itemId, index) =>
            supabase.from('list_items').update({ position: index }).eq('id', itemId).eq('list_id', listId)
        )
    );
    if (results.some((r) => r.error)) throw new Error('An error occurred');
}

/**
 * Supprime une liste (impossible sur la liste par défaut).
 */
export async function deleteList(listId: string): Promise<void> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const { error } = await supabase
        .from('user_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('is_default', false);

    if (error) throw error;
}

/**
 * Met à jour le titre, la description ou la visibilité d'une liste.
 */
export async function updateList(
    listId: string,
    data: { title?: string; description?: string; isPublic?: boolean }
): Promise<void> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'list_write');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const updates: Record<string, string | boolean | null> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updates.title = normalizeListTitle(data.title);
    if (data.description !== undefined) updates.description = normalizeListDescription(data.description);
    if (data.isPublic !== undefined) updates.is_public = data.isPublic;

    const { error } = await supabase
        .from('user_lists')
        .update(updates)
        .eq('id', listId)
        .eq('user_id', user.id);

    if (error) throw error;
}
