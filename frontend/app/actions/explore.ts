'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAnon } from '@/lib/supabase/server';

export type ProfileTier = 'anonymous' | 'new' | 'established';

/**
 * Détermine quel assemblage de /explore servir : anonyme, connecté sans
 * historique ("nouveau"), ou connecté avec un journal suffisant ("établi").
 * Seuil de 3 entrées — arbitraire mais raisonnable pour amorcer "Pour toi".
 */
export async function getProfileTier(): Promise<ProfileTier> {
    const user = await getAuthUser();
    if (!user) return 'anonymous';

    const supabase = await createSupabaseServer();
    const { count } = await supabase
        .from('diary_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

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
    delta?: number | null; // positif = montée, négatif = descente, null = nouveau
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
    // 'bubble' : filtré par artistes inconnus + signal social (comptes suivis) — le libellé "Hors de ta bulle" tient
    // 'discover' : repli sur la note pondérée par confiance, sans signal social — libellé neutre "À découvrir"
    mode: 'bubble' | 'discover';
    // false pour un anonyme ou un nouveau connecté sans aucun artiste dans son journal —
    // sert à éviter de parler d'« artistes habituels » à quelqu'un qui n'en a pas.
    hasTasteProfile: boolean;
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
    shared_albums_count: number;
    shared_covers: string[];
};

export type ForYouTrack = {
    track_id: string;
    track_title: string;
    artist: string;
    album_id: string;
    artist_id: string;
    cover_url: string | null;
};

/**
 * Albums populaires sur Waveform cette semaine (écoutes + sauvegardes agrégées).
 */
export async function getTrendingThisWeek(limit = 10): Promise<TrendingAlbum[]> {
    const supabase = createSupabaseAnon();
    const { data: rpcRows, error: rpcError } = await (supabase as any).rpc('get_trending_albums', {
        result_limit: limit,
    });

    if (!rpcError && rpcRows) {
        const trendingRows = rpcRows as Array<{
            album_id: string; album_title: string | null; artist_name: string | null;
            cover_url: string | null; activity_count: number | null; delta: number | null;
        }>;
        return trendingRows.map((row) => ({
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
    // Fenêtre de comparaison décalée d'1 jour (pas de 7) : on compare le classement
    // glissant sur 7j d'aujourd'hui à celui d'hier, pour capter le mouvement
    // quotidien à l'intérieur de la même semaine glissante plutôt qu'un saut semaine-à-semaine.
    const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

    const [
        { data: currEntries }, { data: currSaves },
        { data: prevEntries }, { data: prevSaves },
    ] = await Promise.all([
        supabase.from('diary_entries').select('album_id, albums(id, title, cover_url, artists(name))').gte('created_at', sevenDaysAgo).eq('is_public', true).limit(200),
        supabase.from('saved_albums').select('album_id, albums(id, title, cover_url, artists(name))').gte('saved_at', sevenDaysAgo).limit(200),
        supabase.from('diary_entries').select('album_id').gte('created_at', eightDaysAgo).lt('created_at', oneDayAgo).eq('is_public', true).limit(200),
        supabase.from('saved_albums').select('album_id').gte('saved_at', eightDaysAgo).lt('saved_at', oneDayAgo).limit(200),
    ]);

    const albumScores = new Map<string, { score: number; title: string; artist_name: string; cover_url: string | null }>();
    for (const entry of [...(currEntries || []), ...(currSaves || [])]) {
        const album = entry.albums;
        if (!album?.id) continue;
        const existing = albumScores.get(album.id);
        if (existing) existing.score += 1;
        else albumScores.set(album.id, { score: 1, title: album.title || 'Unknown', artist_name: album.artists?.name || 'Unknown', cover_url: album.cover_url });
    }

    const prevScores = new Map<string, number>();
    for (const entry of [...(prevEntries || []), ...(prevSaves || [])]) {
        if (!entry.album_id) continue;
        prevScores.set(entry.album_id, (prevScores.get(entry.album_id) ?? 0) + 1);
    }
    const prevRankMap = new Map(
        [...prevScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id], i) => [id, i + 1])
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

/**
 * Suggestions personnalisées — lit les recommandations pré-calculées par le
 * pipeline ML batch (cosine CF). Fallback sur le Jaccard simplifié si la table
 * est vide (avant le premier run du batch ou pour les nouveaux utilisateurs).
 */
export async function getForYouSuggestions(limit = 6): Promise<ForYouAlbum[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const [{ data: feedback }, { data: ratedAlbums }] = await Promise.all([
        (supabase as any)
            .from('recommendation_feedback')
            .select('album_id')
            .eq('user_id', user.id),
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id),
    ]);
    const dismissedIds = new Set(((feedback ?? []) as Array<{ album_id: string | null }>).map((f) => f.album_id).filter((id): id is string => id != null));
    const ratedAlbumIds = new Set((ratedAlbums || []).map((r) => r.album_id).filter(Boolean));

    // Priorité : recommandations pré-calculées par le pipeline ML
    let precomputedQuery = supabase
        .from('user_recommendations')
        .select('album_id, rank, albums(id, title, cover_url, artists(name))')
        .eq('user_id', user.id)
        .eq('method', 'cosine_cf')
        .order('rank')
        .limit(limit + dismissedIds.size + ratedAlbumIds.size);

    const { data: precomputedRaw } = await precomputedQuery;
    const precomputed = (precomputedRaw || [])
        .filter((row) => !dismissedIds.has(row.album_id) && !ratedAlbumIds.has(row.album_id))
        .slice(0, limit);

    if (precomputed && precomputed.length > 0) {
        return precomputed.map((row) => {
            const album = row.albums;
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

    const topScores = [...scores.entries()]
        .sort(
            (a, b) =>
                b[1].neighborCount - a[1].neighborCount ||
                b[1].total / b[1].neighborCount - a[1].total / a[1].neighborCount
        )
        .slice(0, limit);

    return topScores.map(([albumId, info]) => ({
        album_id: albumId,
        title: info.title,
        artist: info.artist,
        cover_url: info.cover,
    }));
}

/**
 * Enregistre un signal négatif explicite sur une reco "Pour toi" ("Pas pour moi").
 * Exclut l'album des recos futures (pipeline ML + fallback Jaccard).
 */
export async function dismissRecommendation(albumId: string): Promise<{ success: boolean }> {
    const user = await getAuthUser();
    if (!user) return { success: false };

    const supabase = await createSupabaseServer();
    const { error } = await (supabase as any)
        .from('recommendation_feedback')
        .upsert({ user_id: user.id, album_id: albumId }, { onConflict: 'user_id,album_id' });

    return { success: !error };
}

/**
 * Enregistre un signal négatif explicite sur un titre recommandé ("Pas pour moi").
 * Exclut le titre des recos futures (pipeline ML titres).
 */
export async function dismissTrackRecommendation(trackId: string): Promise<{ success: boolean }> {
    const user = await getAuthUser();
    if (!user) return { success: false };

    const supabase = await createSupabaseServer();
    const { error } = await (supabase as any)
        .from('recommendation_feedback')
        .upsert({ user_id: user.id, track_id: trackId }, { onConflict: 'user_id,track_id' });

    return { success: !error };
}

/**
 * Découverte — deux modes :
 * - "bubble" : albums bien notés par des comptes suivis, dont l'artiste est inconnu
 *   de l'utilisateur (vrai sens de "Hors de ta bulle").
 * - "discover" : repli quand il n'y a pas de signal social exploitable (pas
 *   d'abonnement, ou aucun résultat après filtrage) — note moyenne pondérée par
 *   confiance (note × volume d'auditeurs), libellé neutre "À découvrir".
 * Pour un utilisateur non connecté : mode "discover" sans filtre d'artiste connu.
 */
export async function getDiscoveryAlbums(limit = 6): Promise<DiscoveryResult> {
    let knownArtistIds = new Set<string>();
    let followedIds: string[] = [];
    let dismissedIds = new Set<string>();
    let authedSupabase: Awaited<ReturnType<typeof createSupabaseServer>> | null = null;

    try {
        const user = await getAuthUser();
        if (user) {
            authedSupabase = await createSupabaseServer();
            const [{ data: myAlbums }, { data: following }, { data: feedback }] = await Promise.all([
                authedSupabase.from('diary_entries').select('albums(artist_id)').eq('user_id', user.id),
                authedSupabase.from('follows').select('followee_id').eq('follower_id', user.id),
                (authedSupabase as any)
                    .from('recommendation_feedback')
                    .select('album_id')
                    .eq('user_id', user.id)
                    .not('album_id', 'is', null),
            ]);
            for (const e of myAlbums || []) {
                const album = e.albums;
                if (album?.artist_id) knownArtistIds.add(album.artist_id);
            }
            followedIds = (following || []).map((f) => f.followee_id).filter(Boolean) as string[];
            dismissedIds = new Set(((feedback ?? []) as Array<{ album_id: string | null }>).map((f) => f.album_id).filter((id): id is string => id != null));
        }
    } catch {
        // Non authentifié — on continue sans filtre
    }

    const supabase = createSupabaseAnon();

    // Cas 1 — signal social : albums bien notés par des comptes suivis
    if (authedSupabase && followedIds.length > 0) {
        const { data: followedEntries } = await authedSupabase
            .from('diary_entries')
            .select('user_id, album_id, rating, albums(id, title, cover_url, artist_id, artists(name))')
            .in('user_id', followedIds)
            .gte('rating', 7)
            .order('rating', { ascending: false })
            .limit(200);

        const followerUserIds = [...new Set((followedEntries || []).map((e) => e.user_id).filter(Boolean))] as string[];
        const { data: followerProfiles } = followerUserIds.length > 0
            ? await supabase.from('profiles').select('id, username').in('id', followerUserIds)
            : { data: [] };
        const usernameMap = new Map((followerProfiles || []).map((p) => [p.id, p.username]));

        const seenAlbumIds = new Set<string>();
        const socialAlbums: DiscoveryAlbum[] = [];
        for (const entry of followedEntries || []) {
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

    // Cas 2 — repli : note moyenne pondérée par confiance (note × volume d'auditeurs)
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

    const ranked = albums
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

    const similarUserIds = profiles.map((p) => p.id);
    const [{ data: myAlbums }, { data: theirAlbums }] = await Promise.all([
        supabase.from('diary_entries').select('album_id').eq('user_id', user.id),
        supabase.from('diary_entries').select('user_id, album_id').in('user_id', similarUserIds),
    ]);

    const myAlbumSet = new Set((myAlbums || []).map((e) => e.album_id).filter(Boolean));
    const sharedAlbumsMap = new Map<string, string[]>();
    for (const entry of theirAlbums || []) {
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
    const coverMap = new Map((sharedAlbumCovers || []).map((a) => [a.id, a.cover_url]));

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

/**
 * Recommandations de titres pré-calculées par le pipeline ML batch (cosine CF).
 */
export async function getForYouTracks(limit = 6): Promise<ForYouTrack[]> {
    const user = await getAuthUser();
    if (!user) return [];

    const supabase = await createSupabaseServer();

    const [{ data: feedback }, { data: ratedTracks }] = await Promise.all([
        (supabase as any)
            .from('recommendation_feedback')
            .select('track_id')
            .eq('user_id', user.id)
            .not('track_id', 'is', null),
        supabase.from('track_diary_entries').select('track_id').eq('user_id', user.id),
    ]);
    const dismissedTrackIds = new Set(((feedback ?? []) as Array<{ track_id: string | null }>).map((f) => f.track_id).filter((id): id is string => id != null));
    const ratedTrackIds = new Set((ratedTracks || []).map((r) => r.track_id).filter(Boolean));

    const { data: rawData } = await (supabase as any)
        .from('user_track_recommendations')
        .select('track_id, rank, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, artists(name)))')
        .eq('user_id', user.id)
        .eq('method', 'cosine_cf')
        .order('rank')
        .limit(limit + dismissedTrackIds.size + ratedTrackIds.size);

    interface RecommendedTrackRow {
        track_id: string;
        tracks: {
            id: string; title: string; album_id: string | null; artist_id: string | null;
            albums: { id: string; title: string; cover_url: string | null; artists: { name: string } | null } | null;
        } | null;
    }

    const precomputed = ((rawData ?? []) as RecommendedTrackRow[])
        .filter((row) => !dismissedTrackIds.has(row.track_id) && !ratedTrackIds.has(row.track_id))
        .slice(0, limit);

    if (precomputed.length > 0) {
        return precomputed.map((row) => {
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

    // Fallback Jaccard — actif tant que le batch ML n'a pas de candidats pour cet user
    // (pas assez de notes de titres chez les voisins). Miroir du fallback albums ci-dessus.
    const [{ data: myEntries }, { data: myAllEntries }] = await Promise.all([
        supabase.from('track_diary_entries').select('track_id').eq('user_id', user.id).gte('rating', 8),
        supabase.from('track_diary_entries').select('track_id').eq('user_id', user.id),
    ]);

    const myLikedTrackIds = (myEntries || []).map((e) => e.track_id).filter(Boolean) as string[];
    if (myLikedTrackIds.length === 0) return [];

    const { data: intersectionEntries } = await supabase
        .from('track_diary_entries')
        .select('user_id, track_id')
        .in('track_id', myLikedTrackIds)
        .neq('user_id', user.id)
        .gte('rating', 8);

    const intersectionSizes = new Map<string, number>();
    for (const e of intersectionEntries || []) {
        if (!e.user_id) continue;
        intersectionSizes.set(e.user_id, (intersectionSizes.get(e.user_id) ?? 0) + 1);
    }

    const neighborIds = [...intersectionSizes.entries()]
        .filter(([, size]) => size >= 3)
        .map(([userId]) => userId);

    if (neighborIds.length === 0) return [];

    const myAllTrackIds = new Set((myAllEntries || []).map((e) => e.track_id).filter(Boolean));

    const { data: recommendations } = await supabase
        .from('track_diary_entries')
        .select('user_id, track_id, rating, tracks(id, title, album_id, artist_id, albums(id, title, cover_url, artists(name)))')
        .in('user_id', neighborIds)
        .gte('rating', 8)
        .limit(500);

    const scores = new Map<
        string,
        { neighborCount: number; total: number; title: string; artist: string; albumId: string; artistId: string; cover: string | null }
    >();

    for (const entry of recommendations || []) {
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

    const topScores = [...scores.entries()]
        .sort(
            (a, b) =>
                b[1].neighborCount - a[1].neighborCount ||
                b[1].total / b[1].neighborCount - a[1].total / a[1].neighborCount
        )
        .slice(0, limit);

    return topScores.map(([trackId, info]) => ({
        track_id: trackId,
        track_title: info.title,
        artist: info.artist,
        album_id: info.albumId,
        artist_id: info.artistId,
        cover_url: info.cover,
    }));
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
