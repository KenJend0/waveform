'use server';

import { createSupabaseAnon } from '@/lib/supabase/server';

export type CuratorPick = {
    album_id: string;
    album_title: string;
    artist_name: string;
    release_year: string | null;
    cover_url: string;
    avg_rating: number | null;
    note: string;
    curator_id: string;
    curator_username: string;
    curator_avatar: string | null;
};

/**
 * Sélection personnelle du créateur — contenu éditorial permanent, géré
 * manuellement via SQL. Retourne toujours la dernière entrée créée.
 */
export async function getCuratorPick(): Promise<CuratorPick | null> {
    const supabase = createSupabaseAnon();

    const { data } = await (supabase as any)
        .from('curator_picks')
        .select('album_id, note, curator_id, albums(title, cover_url, release_date, artists(name)), profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data) return null;

    const album = data.albums as { title: string; cover_url: string | null; release_date: string | null; artists?: { name: string } } | null;
    const curator = data.profiles as { username: string | null; avatar_url: string | null } | null;

    const { data: stats } = await supabase
        .from('album_stats_mat')
        .select('avg_rating')
        .eq('album_id', data.album_id)
        .maybeSingle();

    return {
        album_id: data.album_id,
        album_title: album?.title || 'Unknown',
        artist_name: album?.artists?.name || 'Unknown',
        release_year: album?.release_date ? String(album.release_date).slice(0, 4) : null,
        cover_url: album?.cover_url || '',
        avg_rating: stats?.avg_rating ?? null,
        note: data.note,
        curator_id: data.curator_id,
        curator_username: curator?.username || 'Waveform',
        curator_avatar: curator?.avatar_url ?? null,
    };
}
