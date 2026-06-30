'use server';

import { getAuthUser, createSupabaseAdmin } from '@/lib/supabase/server';
import { createList } from './lists';
import type { RawExternalItem } from '@/lib/externalImport';
import { isRecord, logInvalidExternalResponse, recordValue, stringValue } from '@/lib/externalValidation';
import { triggerExternalImportsWorkflow } from '@/lib/githubDispatch';

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';
const COOLDOWN_HOURS = 24;

interface LastfmAlbumItem {
  name: string;
  mbid: string | null;
  artistName: string;
}

async function lastfmRequest(
  params: Record<string, string>
): Promise<unknown> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error('Last.fm non configuré');

  const search = new URLSearchParams({ ...params, api_key: apiKey, format: 'json' });
  const res = await fetch(`${LASTFM_API}/?${search}`, { signal: AbortSignal.timeout(8_000) });
  const raw: unknown = await res.json();
  if (!isRecord(raw)) {
    logInvalidExternalResponse('lastfm.request', 'root is not an object');
    throw new Error('Réponse Last.fm invalide');
  }
  if (typeof raw.error === 'number' || typeof raw.error === 'string') {
    throw new Error(stringValue(raw.message) || 'Erreur Last.fm');
  }
  return raw;
}

function parseLastfmTopAlbumsResponse(raw: unknown): LastfmAlbumItem[] {
  const topAlbums = recordValue(recordValue(raw)?.topalbums);
  if (!topAlbums) {
    logInvalidExternalResponse('lastfm.topalbums', 'missing topalbums');
    return [];
  }

  const rawAlbum = topAlbums.album;
  const rawAlbums = Array.isArray(rawAlbum) ? rawAlbum : rawAlbum ? [rawAlbum] : [];

  return rawAlbums.flatMap((item) => {
    const album = recordValue(item);
    const artist = recordValue(album?.artist);
    const name = stringValue(album?.name)?.trim() ?? '';
    const artistName = stringValue(artist?.name)?.trim() ?? '';
    if (!name || !artistName) return [];
    return [{
      name,
      artistName,
      mbid: stringValue(album?.mbid)?.trim() || null,
    }];
  });
}

export async function startLastfmImport(username: string) {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: 'Not authenticated' };

  const trimmed = username.trim();
  if (!trimmed) return { success: false as const, error: 'Pseudo Last.fm requis' };

  const admin = createSupabaseAdmin();

  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('external_imports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'lastfm')
    .gte('created_at', cutoff);

  if ((count || 0) > 0) {
    return {
      success: false as const,
      error: `Tu as déjà lancé un import Last.fm dans les dernières ${COOLDOWN_HOURS}h. Réessaie plus tard.`,
    };
  }

  try {
    await lastfmRequest({ method: 'user.getInfo', user: trimmed });
  } catch {
    return { success: false as const, error: 'Pseudo Last.fm introuvable.' };
  }

  let topAlbums: RawExternalItem[];
  try {
    const raw = await lastfmRequest({
      method: 'user.gettopalbums',
      user: trimmed,
      period: 'overall',
      limit: '100',
    });
    const list = parseLastfmTopAlbumsResponse(raw);
    topAlbums = list
      .map((a) => ({
        artist: a.artistName,
        album: a.name,
        mbid: a.mbid,
      }))
      .filter((a) => a.artist && a.album);
  } catch {
    return {
      success: false as const,
      error: 'Impossible de récupérer ton historique — vérifie que ton profil Last.fm est public.',
    };
  }

  if (topAlbums.length === 0) {
    return { success: false as const, error: 'Aucun album trouvé sur ce profil Last.fm.' };
  }

  const list = await createList({ title: 'Import Last.fm', isPublic: false });

  const { data: importRow, error } = await admin
    .from('external_imports')
    .insert({
      user_id: user.id,
      source: 'lastfm',
      source_label: trimmed,
      status: 'matching',
      raw_items: topAlbums,
      total_items: topAlbums.length,
      list_id: list.id,
    })
    .select('id')
    .single();

  if (error || !importRow) {
    return { success: false as const, error: "Erreur lors de la création de l'import" };
  }

  await triggerExternalImportsWorkflow();

  return { success: true as const, importId: importRow.id, listId: list.id, total: topAlbums.length };
}
