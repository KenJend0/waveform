'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAnon } from '@/lib/supabase/server';
import { logAuthedProductEvent } from '@/lib/productEvents';
import { checkActionRateLimit } from '@/lib/serverRateLimit';

// ── Types ────────────────────────────────────────────────────────────────────

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
    likes_count: number;
    is_liked?: boolean;
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

async function attachListMeta(listIds: string[], supabase: any): Promise<Map<string, { item_count: number; cover_urls: (string | null)[]; likes_count: number; preview_items: string[] }>> {
    if (listIds.length === 0) return new Map();

    const [countResults, coverResults, likesResults, previewResults] = await Promise.all([
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
        supabase
            .from('list_likes')
            .select('list_id')
            .in('list_id', listIds),
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
            existing.push((row.albums as any)?.cover_url ?? null);
            coverMap.set(row.list_id, existing);
        }
    }

    const likesMap = new Map<string, number>();
    for (const row of likesResults.data || []) {
        likesMap.set(row.list_id, (likesMap.get(row.list_id) ?? 0) + 1);
    }

    const previewMap = new Map<string, string[]>();
    for (const row of previewResults.data || []) {
        const existing = previewMap.get(row.list_id) ?? [];
        if (existing.length >= 3) continue;
        const album = row.albums as any;
        const track = row.tracks as any;
        if (track?.title) {
            existing.push(`${track.title} – ${track.albums?.artists?.name || 'Unknown'}`);
        } else if (album?.title) {
            existing.push(`${album.title} – ${album.artists?.name || 'Unknown'}`);
        } else {
            continue;
        }
        previewMap.set(row.list_id, existing);
    }

    const meta = new Map<string, { item_count: number; cover_urls: (string | null)[]; likes_count: number; preview_items: string[] }>();
    for (const id of listIds) {
        meta.set(id, {
            item_count: countMap.get(id) ?? 0,
            cover_urls: coverMap.get(id) ?? [],
            likes_count: likesMap.get(id) ?? 0,
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

    const meta = await attachListMeta(lists.map((l: any) => l.id), supabase);

    return lists.map((list: any) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], likes_count: 0, preview_items: [] }),
    }));
}

/**
 * Listes que l'utilisateur a sauvegardées (pas les siennes) — onglet "Listes" du profil.
 */
export async function getUserSavedLists(userId: string): Promise<UserList[]> {
    const supabase = await createSupabaseServer();

    const { data: saved } = await (supabase as any)
        .from('saved_lists')
        .select('saved_at, user_lists(id, user_id, title, description, is_public, is_default, created_at, profiles(username, avatar_url))')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

    if (!saved || saved.length === 0) return [];

    const lists = saved.map((s: any) => s.user_lists).filter(Boolean);
    if (lists.length === 0) return [];

    const meta = await attachListMeta(lists.map((l: any) => l.id), supabase);

    return lists.map((list: any) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], likes_count: 0, preview_items: [] }),
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

    const meta = await attachListMeta(lists.map((l: any) => l.id), supabase);

    return lists.map((list: any) => ({
        ...list,
        ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], likes_count: 0, preview_items: [] }),
    }));
}

/**
 * Listes publiques populaires — pour la section /explore et la page /lists.
 * Trie par nombre de likes sur un pool des listes les plus récentes (pas sur
 * la base entière) — un compromis simple plutôt qu'un vrai classement par
 * popularité sur toute la table, suffisant au volume actuel.
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

    const meta = await attachListMeta(lists.map((l: any) => l.id), supabase);

    const user = await getAuthUser();
    let savedIds = new Set<string>();
    if (user) {
        const authedSupabase = await createSupabaseServer();
        const { data: saved } = await (authedSupabase as any)
            .from('saved_lists')
            .select('list_id')
            .eq('user_id', user.id)
            .in('list_id', lists.map((l: any) => l.id));
        savedIds = new Set((saved || []).map((s: any) => s.list_id));
    }

    return lists
        .map((list: any) => ({
            ...list,
            ...(meta.get(list.id) ?? { item_count: 0, cover_urls: [], likes_count: 0, preview_items: [] }),
            creator_username: list.profiles?.username ?? undefined,
            creator_avatar: list.profiles?.avatar_url ?? null,
            is_saved: savedIds.has(list.id),
        }))
        .sort((a: UserList, b: UserList) => b.likes_count - a.likes_count)
        .slice(0, limit);
}

/**
 * Like ou unlike une liste publique.
 */
export async function toggleListLike(listId: string): Promise<{ liked: boolean }> {
    const user = await getAuthUser();
    if (!user) throw new Error('Not authenticated');

    const rlError = await checkActionRateLimit(user.id, 'save');
    if (rlError) throw new Error(rlError);

    const supabase = await createSupabaseServer();

    const { data: existing } = await supabase
        .from('list_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('list_id', listId)
        .maybeSingle();

    if (existing) {
        await supabase.from('list_likes').delete().eq('id', existing.id);
        return { liked: false };
    }

    await supabase.from('list_likes').insert({ user_id: user.id, list_id: listId });
    return { liked: true };
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

    const { data: existing } = await (supabase as any)
        .from('saved_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('list_id', listId)
        .maybeSingle();

    if (existing) {
        await (supabase as any).from('saved_lists').delete().eq('id', existing.id);
        return { saved: false };
    }

    await (supabase as any).from('saved_lists').insert({ user_id: user.id, list_id: listId });
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

    return items.map((item: any) => ({
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

    const listIds = lists.map((l: any) => l.id);

    const { data: items } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('album_id', albumId)
        .in('list_id', listIds);

    return (items || []).map((i: any) => i.list_id);
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

    const listIds = lists.map((l: any) => l.id);

    const { data: items } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('track_id', trackId)
        .in('list_id', listIds);

    return (items || []).map((i: any) => i.list_id);
}

/**
 * Résout l'id de la liste à utiliser : celle passée explicitement (après
 * vérification d'appartenance) ou la liste "À écouter" par défaut.
 */
async function resolveListId(userId: string, listId: string | undefined, supabase: any): Promise<string | null> {
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

    const ratedTrackIds = new Set((ratedTracks || []).map((r: any) => r.track_id));

    return (items || [])
        .filter((item: any) => !ratedTrackIds.has(item.track_id))
        .slice(0, limit)
        .map((item: any) => ({
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

    const ratedAlbumIds = new Set((ratedAlbums || []).map((r: any) => r.album_id));

    return (items || [])
        .filter((item: any) => !ratedAlbumIds.has(item.album_id))
        .slice(0, limit)
        .map((item: any) => ({
            id: item.id,
            album_id: item.album_id,
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
    const listIds = lists.map((l: any) => l.id);

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

    const ratedAlbumIds = new Set((ratedAlbumsRes.data || []).map((r: any) => r.album_id));
    const ratedTrackIds = new Set((ratedTracksRes.data || []).map((r: any) => r.track_id));

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
        .select('id, user_id, title, description, is_public, is_default, created_at, profiles(username, avatar_url)')
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
            id, list_id, album_id, track_id, added_at,
            albums(id, title, cover_url, artist_id, artists(name), release_date),
            tracks(id, title, album_id, artists(name), albums(cover_url))
        `)
        .eq('list_id', listId)
        .order('added_at', { ascending: false });

    if (itemsError) console.error('getListWithItems items error:', itemsError);

    const [{ count: likesCount }, likeStatus] = await Promise.all([
        supabase.from('list_likes').select('*', { count: 'exact', head: true }).eq('list_id', listId),
        user
            ? supabase.from('list_likes').select('id').eq('list_id', listId).eq('user_id', user.id).maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    const profile = list.profiles as any;

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
            cover_urls: [],
            preview_items: [],
            likes_count: likesCount ?? 0,
            is_liked: !!likeStatus.data,
            creator_username: profile?.username || '',
            creator_avatar: profile?.avatar_url ?? null,
        },
        items: (items || []).map((item: any) => ({
            id: item.id,
            list_id: item.list_id,
            album_id: item.album_id ?? null,
            track_id: item.track_id ?? null,
            added_at: item.added_at,
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
                    cover_url: (item.tracks.albums as any)?.cover_url ?? null,
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

    const { data: list, error } = await supabase
        .from('user_lists')
        .insert({
            user_id: user.id,
            title: data.title.trim(),
            description: data.description?.trim() || null,
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

    return { ...list, item_count: 0, cover_urls: [], likes_count: 0, preview_items: [] };
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
    if (data.albumId) query = query.eq('album_id', data.albumId);
    if (data.trackId) query = query.eq('track_id', data.trackId);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
        await supabase.from('list_items').delete().eq('id', existing.id);
        return { added: false };
    }

    await supabase.from('list_items').insert({
        list_id: listId,
        album_id: data.albumId ?? null,
        track_id: data.trackId ?? null,
    });

    await logAuthedProductEvent('list_item_added', {
      surface: 'lists',
      properties: {
        list_id: listId,
        album_id: data.albumId ?? null,
        track_id: data.trackId ?? null,
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

    await supabase.from('list_items').delete().eq('id', itemId);
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

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description.trim() || null;
    if (data.isPublic !== undefined) updates.is_public = data.isPublic;

    const { error } = await supabase
        .from('user_lists')
        .update(updates)
        .eq('id', listId)
        .eq('user_id', user.id);

    if (error) throw error;
}
