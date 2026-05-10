'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAnon } from '@/lib/supabase/server';

export type DiscoveryAlbum = {
    album_id: string;
    title: string;
    artist: string;
    cover_url: string;
};

export type ForYouAlbum = {
    album_id: string;
    title: string;
    artist: string;
    cover_url: string;
};

export type SimilarUser = {
    user_id: string;
    username: string;
    avatar_url: string | null;
    taste_match: number; // 0-100
};

/**
 * Suggestions personnalisées — lit les recommandations pré-calculées par le
 * pipeline ML batch (cosine CF). Fallback sur le Jaccard simplifié si la table
 * est vide (avant le premier run du batch ou pour les nouveaux utilisateurs).
 */
export async function getForYouSuggestions(): Promise<ForYouAlbum[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    // Priorité : recommandations pré-calculées par le pipeline ML
    const { data: precomputed } = await supabase
        .from('user_recommendations')
        .select('album_id, rank, albums(id, title, cover_url, artists(name))')
        .eq('user_id', user.id)
        .eq('method', 'cosine_cf')
        .order('rank')
        .limit(4);

    if (precomputed && precomputed.length > 0) {
        return precomputed.map((row) => {
            const album = row.albums as any;
            return {
                album_id: row.album_id,
                title: album?.title || 'Unknown',
                artist: album?.artists?.name || 'Unknown',
                cover_url: album?.cover_url || '',
            };
        });
    }

    // Fallback Jaccard — actif tant que le batch n'a pas tourné pour cet user

    // Étape 1 : profil de goût (>= 8) + tous les albums du journal (pour exclusion)
    const [{ data: myEntries }, { data: myAllEntries }] = await Promise.all([
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id).gte('rating', 8),
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id),
    ]);

    const myLikedIds = (myEntries || []).map((e) => e.album_id).filter(Boolean) as string[];
    if (myLikedIds.length === 0) return [];

    // Étape 2 : trouver les voisins — autres users qui ont noté >= 8 les mêmes albums
    const { data: intersectionEntries } = await supabase
        .from('diary_entries')
        .select('user_id, album_id')
        .in('album_id', myLikedIds)
        .neq('user_id', user.id)
        .gte('rating', 8);

    // Compter la taille de l'intersection par voisin
    const intersectionSizes = new Map<string, number>();
    for (const e of intersectionEntries || []) {
        if (!e.user_id) continue;
        intersectionSizes.set(e.user_id, (intersectionSizes.get(e.user_id) ?? 0) + 1);
    }

    // Garder seulement les voisins avec >= 3 albums en commun
    const neighborIds = [...intersectionSizes.entries()]
        .filter(([, size]) => size >= 3)
        .map(([userId]) => userId);

    if (neighborIds.length === 0) return [];

    // Étape 3 : albums bien notés (>= 8) par ces voisins, hors tous les albums déjà dans mon journal
    const myAllAlbumIds = new Set((myAllEntries || []).map((e) => e.album_id).filter(Boolean));

    const { data: recommendations } = await supabase
        .from('diary_entries')
        .select('user_id, album_id, rating, albums(id, title, cover_url, artists(name))')
        .in('user_id', neighborIds)
        .gte('rating', 8)
        .limit(500);

    // Étape 4 : scorer chaque album candidat
    const scores = new Map<
        string,
        { neighborCount: number; total: number; title: string; artist: string; cover: string }
    >();

    for (const entry of recommendations || []) {
        if (!entry.album_id || myAllAlbumIds.has(entry.album_id)) continue;
        const album = entry.albums as any;
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
                artist: (album.artists as any)?.name || 'Unknown',
                cover: album.cover_url || '',
            });
        }
    }

    if (scores.size === 0) return [];

    return [...scores.entries()]

        .sort(
            (a, b) =>
                b[1].neighborCount - a[1].neighborCount ||
                b[1].total / b[1].neighborCount - a[1].total / a[1].neighborCount
        )
        .slice(0, 4)
        .map(([albumId, info]) => ({
            album_id: albumId,
            title: info.title,
            artist: info.artist,
            cover_url: info.cover,
        }));
}

/**
 * Découverte — albums bien notés sur Waveform (avg >= 7, >= 2 auditeurs)
 * dont l'artiste est inconnu de l'utilisateur.
 * Pour un utilisateur non connecté : retourne les mieux notés sans filtre.
 */
export async function getDiscoveryAlbums(): Promise<DiscoveryAlbum[]> {
    // Récupérer les artist_ids connus de l'utilisateur (optionnel)
    let knownArtistIds = new Set<string>();
    try {
        const user = await getAuthUser();
        if (user) {
            const supabase = await createSupabaseServer();
            const { data: myAlbums } = await supabase
                .from('diary_entries')
                .select('albums(artist_id)')
                .eq('user_id', user.id);
            for (const e of myAlbums || []) {
                const album = e.albums as any;
                if (album?.artist_id) knownArtistIds.add(album.artist_id);
            }
        }
    } catch {
        // Non authentifié — on continue sans filtre
    }

    const supabase = createSupabaseAnon();

    // Albums bien notés depuis la vue album_stats
    const { data: stats } = await supabase
        .from('album_stats_mat')
        .select('album_id, avg_rating, listeners_count')
        .gte('avg_rating', 7)
        .gte('listeners_count', 2)
        .order('avg_rating', { ascending: false })
        .limit(100);

    if (!stats || stats.length === 0) return [];

    const albumIds = stats.map((s) => s.album_id).filter(Boolean) as string[];

    const { data: albums } = await supabase
        .from('albums')
        .select('id, title, cover_url, artist_id, artists(name)')
        .in('id', albumIds);

    if (!albums) return [];

    // Attacher les stats et filtrer les artistes déjà connus
    const statsMap = new Map(stats.map((s) => [s.album_id, s]));

    return albums
        .filter((a) => !knownArtistIds.has(a.artist_id))
        .sort((a, b) => {
            const ra = statsMap.get(a.id)?.avg_rating ?? 0;
            const rb = statsMap.get(b.id)?.avg_rating ?? 0;
            return rb - ra;
        })
        .slice(0, 10)
        .map((a) => ({
            album_id: a.id,
            title: a.title,
            artist: (a.artists as any)?.name || 'Unknown',
            cover_url: a.cover_url || '',
        }));
}

/**
 * Utilisateurs avec des goûts similaires, calculés par le pipeline ML batch.
 * Retourne les top-N voisins cosine du user connecté avec leur score (0-100).
 */
export async function getSimilarUsers(limit = 4): Promise<SimilarUser[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    // Fetch more than needed to account for filtering out already-followed users
    const [{ data: similarities }, { data: following }] = await Promise.all([
        supabase
            .from('user_similarity')
            .select('user_b, score')
            .eq('user_a', user.id)
            .order('score', { ascending: false })
            .limit(50),
        supabase
            .from('follows')
            .select('followee_id')
            .eq('follower_id', user.id),
    ]);

    if (!similarities || similarities.length === 0) return [];

    const followedIds = new Set((following || []).map((f) => f.followee_id));
    const scoreMap = new Map(similarities.map((s) => [s.user_b, s.score]));

    const unfollowedSimilar = similarities
        .filter((s) => !followedIds.has(s.user_b))
        .slice(0, limit);

    if (unfollowedSimilar.length === 0) return [];

    const userIds = unfollowedSimilar.map((s) => s.user_b);

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

    if (!profiles) return [];

    return profiles
        .map((p) => ({
            user_id: p.id,
            username: p.username,
            avatar_url: p.avatar_url ?? null,
            taste_match: Math.round((scoreMap.get(p.id) ?? 0) * 100),
        }))
        .sort((a, b) => b.taste_match - a.taste_match);
}

/**
 * Score de compatibilité de goût entre l'utilisateur connecté et un profil cible.
 * Retourne un entier 0-100, ou null si pas de données.
 */
export async function getTasteMatchScore(targetUserId: string): Promise<number | null> {
    const user = await getAuthUser();
    if (!user || user.id === targetUserId) return null;

    const supabase = await createSupabaseServer();

    // user_similarity est directionnel (user_a → user_b) — on vérifie les deux sens
    const [{ data: forward }, { data: reverse }] = await Promise.all([
        supabase.from('user_similarity').select('score').eq('user_a', user.id).eq('user_b', targetUserId).maybeSingle(),
        supabase.from('user_similarity').select('score').eq('user_a', targetUserId).eq('user_b', user.id).maybeSingle(),
    ]);

    const score = forward?.score ?? reverse?.score ?? null;
    return score !== null ? Math.round(score * 100) : null;
}
