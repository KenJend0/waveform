'use server';

import { createSupabaseAdmin, createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import { findGenreBySlug } from '@/lib/genre-families';

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'Waveform/1.0 (https://waveform.app)';
const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';
const FETCH_TIMEOUT_MS = 3000;
const ENRICHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Tags parasites — non pertinents pour la découverte musicale
const NOISE_TAGS = new Set([
  // Opinions / méta
  'seen live', 'loved', 'favorites', 'favourite', 'albums i own', 'favourite albums',
  'personal favourites', 'check in', 'albums', 'music', 'good', 'great', 'awesome',
  'love', 'my music', 'spotify', 'all', 'default', 'amazing', 'beautiful', 'best',
  'classic', 'cool', 'essential', 'excellent', 'perfect', 'aoty', 'worst album ever',
  'cult', 'feel-good', 'romantic', 'lush',
  // Pays / nationalités
  'france', 'american', 'belgian', 'belgium', 'fr',
  // Tags redondants (version slug identique à un autre)
  'rhythm and blues', 'rhythm & blues', 'conscious', 'rap fr',
  // Noms d'artistes connus sources de faux positifs
  'radiohead', 'sade', 'stevie wonder', 'buena vista social club',
  'johnny hallyday', 'ennio morricone', 'michael jackson', 'common',
  'mf doom', 'j dilla', 'ofwgkta', 'lauryn hill',
]);

function isValidTag(name: string): boolean {
  if (name.length < 2 || name.length > 50) return false;
  if (NOISE_TAGS.has(name)) return false;
  // Années spécifiques (2025, 1966) et décennies (70s, 80s)
  if (/^\d{4}s?$/.test(name) || /^\d{2}s$/.test(name)) return false;
  return true;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Récupère les genres + tags depuis MusicBrainz.
 * albums.mbid stocke le release MBID — les genres sont sur le release-group.
 * Lookup en 2 étapes : release → release-group MBID → genres + tags.
 */
async function fetchMBTags(
  releaseMbid: string
): Promise<Array<{ name: string; count: number }>> {
  try {
    // Étape 1 : résoudre le release-group MBID depuis le release MBID
    const releaseRes = await fetch(
      `${MB_API}/release/${encodeURIComponent(releaseMbid)}?fmt=json&inc=release-groups`,
      {
        headers: { 'User-Agent': MB_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!releaseRes.ok) return [];
    const releaseData = await releaseRes.json();
    const rgMbid: string | undefined = releaseData['release-group']?.id;
    if (!rgMbid) return [];

    // Respect MB rate limit entre les deux appels
    await new Promise((r) => setTimeout(r, 1100));

    // Étape 2 : genres + tags sur le release-group
    const res = await fetch(
      `${MB_API}/release-group/${encodeURIComponent(rgMbid)}?fmt=json&inc=genres+tags`,
      {
        headers: { 'User-Agent': MB_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const genres: Array<{ name: string; count: number }> = (data.genres ?? []).map(
      (g: { name: string; count?: number }) => ({
        name: g.name.toLowerCase().trim(),
        count: g.count ?? 1,
      })
    );

    const tags: Array<{ name: string; count: number }> = (data.tags ?? [])
      .filter((t: { count?: number }) => (t.count ?? 0) >= 3)
      .map((t: { name: string; count: number }) => ({
        name: t.name.toLowerCase().trim(),
        count: t.count,
      }));

    // Merge : genres curatés en premier, puis tags non-dupliqués
    const seen = new Set(genres.map((g) => g.name));
    const combined = [...genres];
    for (const tag of tags) {
      if (!seen.has(tag.name)) {
        combined.push(tag);
        seen.add(tag.name);
      }
    }
    return combined.slice(0, 12);
  } catch {
    return [];
  }
}

/**
 * Récupère tags + description depuis Last.fm.
 * Nécessite LASTFM_API_KEY — retourne vide si absente (graceful degradation).
 */
async function fetchLastFmData(
  artistName: string,
  title: string
): Promise<{
  tags: Array<{ name: string; count: number }>;
  description: string | null;
  url: string | null;
  listeners: number | null;
  playcount: number | null;
}> {
  const empty = { tags: [], description: null, url: null, listeners: null, playcount: null };
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return empty;

  try {
    const res = await fetch(
      `${LASTFM_API}/?method=album.getinfo` +
        `&artist=${encodeURIComponent(artistName)}` +
        `&album=${encodeURIComponent(title)}` +
        `&api_key=${encodeURIComponent(apiKey)}&format=json&autocorrect=1`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data.album) return empty;

    // Last.fm retourne les tags triés par poids (sans score numérique)
    // On inverse le rang pour avoir un poids relatif (1er tag = poids 10)
    const rawTags: Array<{ name: string }> = data.album.tags?.tag ?? [];
    const tags = rawTags.map((t, i) => ({
      name: t.name.toLowerCase().trim(),
      count: Math.max(1, 10 - i),
    }));

    // Nettoyage description : suppression du lien "Read more on Last.fm" et HTML
    let description: string | null = null;
    const summary: string | undefined = data.album.wiki?.summary;
    if (summary) {
      description =
        summary
          .replace(/<a\s[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim() || null;
      if (description && description.length < 30) description = null;
    }

    const listeners = data.album.listeners ? parseInt(data.album.listeners, 10) : null;
    const playcount = data.album.playcount ? parseInt(data.album.playcount, 10) : null;

    return { tags, description, url: data.album.url ?? null, listeners, playcount };
  } catch {
    return empty;
  }
}

/**
 * Enrichit les métadonnées d'un album importé (genres + description).
 * Sources : Last.fm (primaire) + MusicBrainz (secondaire).
 * Idempotent : skip si enrichi il y a moins de 30 jours.
 * Toutes les erreurs sont silencieuses — ne bloque jamais l'import.
 */
export async function enrichAlbumMetadata(
  albumId: string,
  rgMbid: string,
  title: string,
  artistName: string
): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();

    // Skip si enrichi récemment
    const { data: existing } = await supabase
      .from('album_metadata')
      .select('fetched_at')
      .eq('album_id', albumId)
      .maybeSingle();

    if (existing?.fetched_at) {
      const ageMs = Date.now() - new Date(existing.fetched_at).getTime();
      if (ageMs < ENRICHMENT_TTL_MS) return;
    }

    // Fetch en parallèle
    const [mbTags, lfm] = await Promise.all([
      fetchMBTags(rgMbid),
      fetchLastFmData(artistName, title),
    ]);

    // Merge : Last.fm en primaire (meilleure classification), MB en secondaire
    const tagMap = new Map<string, { count: number; source: 'lastfm' | 'musicbrainz' }>();
    for (const tag of lfm.tags) {
      if (isValidTag(tag.name)) tagMap.set(tag.name, { count: tag.count, source: 'lastfm' });
    }
    for (const tag of mbTags) {
      if (isValidTag(tag.name) && !tagMap.has(tag.name)) {
        tagMap.set(tag.name, { count: tag.count, source: 'musicbrainz' });
      }
    }

    // Batch upsert genres + album_genres (3 DB calls total instead of N*2)
    const validTags = [...tagMap.entries()]
      .map(([name, { count, source }]) => ({ name, slug: toSlug(name), count, source }))
      .filter((t) => t.slug);

    if (validTags.length > 0) {
      // 1. Batch upsert all genres
      await supabase
        .from('genres')
        .upsert(validTags.map((t) => ({ name: t.name, slug: t.slug })), { onConflict: 'slug' });

      // 2. Fetch all genre IDs in one query
      const { data: genreRows } = await supabase
        .from('genres')
        .select('id, slug')
        .in('slug', validTags.map((t) => t.slug));

      if (genreRows && genreRows.length > 0) {
        const slugToId = new Map(genreRows.map((g) => [g.slug, g.id]));

        // 3. Batch upsert all album_genres
        const albumGenreRows = validTags
          .map((t) => ({ album_id: albumId, genre_id: slugToId.get(t.slug), source: t.source, weight: t.count }))
          .filter((r) => r.genre_id != null);

        if (albumGenreRows.length > 0) {
          await supabase
            .from('album_genres')
            .upsert(albumGenreRows as any[], { onConflict: 'album_id,genre_id' });
        }
      }
    }

    // Upsert album_metadata
    await supabase
      .from('album_metadata')
      .upsert(
        {
          album_id: albumId,
          description: lfm.description ?? null,
          description_src: lfm.description ? 'lastfm' : null,
          lastfm_url: lfm.url ?? null,
          lastfm_listeners: lfm.listeners ?? null,
          lastfm_playcount: lfm.playcount ?? null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'album_id' }
      );

    console.log(`[enrichAlbumMetadata] ✓ albumId=${albumId} — ${tagMap.size} genres`);
  } catch (err) {
    // Enrichissement best-effort — ne jamais bloquer l'import
    console.error('[enrichAlbumMetadata] error:', err);
  }
}

// ── Similarity engine ─────────────────────────────────────────────────────────

export type SimilarAlbum = {
  id: string;
  title: string;
  cover_url: string | null;
  year: number | null;
  artist: string;
  artistId: string | null;
  sharedGenres: number;
};

/**
 * Retourne jusqu'à `limit` albums similaires à `albumId` basés sur le
 * chevauchement de genres pondérés (score = somme des produits de poids).
 * Retourne [] si l'album n'a pas de genres ou en cas d'erreur.
 */
export async function getSimilarAlbums(
  albumId: string,
  limit = 6
): Promise<SimilarAlbum[]> {
  try {
    const supabase = await createSupabaseServer();

    // 1. Genres de l'album courant (top 6 par poids)
    const { data: myGenres } = await supabase
      .from('album_genres')
      .select('genre_id, weight')
      .eq('album_id', albumId)
      .order('weight', { ascending: false })
      .limit(6);

    if (!myGenres || myGenres.length === 0) return [];

    const genreIds = myGenres.map((g) => g.genre_id);
    const myWeightMap = new Map(myGenres.map((g) => [g.genre_id, g.weight]));

    // 2. Autres albums partageant ces genres
    const { data: candidates } = await supabase
      .from('album_genres')
      .select('album_id, genre_id, weight')
      .in('genre_id', genreIds)
      .neq('album_id', albumId);

    if (!candidates || candidates.length === 0) return [];

    // 3. Score = somme des produits de poids (genre overlap pondéré)
    const scoreMap = new Map<string, { score: number; shared: number }>();
    for (const c of candidates) {
      const myW = myWeightMap.get(c.genre_id) ?? 1;
      const entry = scoreMap.get(c.album_id) ?? { score: 0, shared: 0 };
      entry.score += myW * c.weight;
      entry.shared += 1;
      scoreMap.set(c.album_id, entry);
    }

    // 4. Top candidats — au moins 2 genres partagés, triés par nb de genres communs puis par score pondéré
    const topIds = [...scoreMap.entries()]
      .filter(([, { shared }]) => shared >= 2)
      .sort((a, b) =>
        b[1].shared !== a[1].shared
          ? b[1].shared - a[1].shared
          : b[1].score - a[1].score
      )
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

    // 5. Infos albums + artiste + stats de popularité (source + candidats)
    const [albumsResult, statsResult] = await Promise.all([
      supabase
        .from('albums')
        .select('id, title, cover_url, release_date, artist_id, artists(id, name)')
        .in('id', topIds),
      supabase
        .from('album_stats')
        .select('album_id, listeners_count')
        .in('album_id', [...topIds, albumId]),
    ]);

    const albums = albumsResult.data;
    if (!albums) return [];

    const statsData = statsResult.data ?? [];
    const myListeners = statsData.find((s) => s.album_id === albumId)?.listeners_count ?? 0;
    const myLogListeners = Math.log1p(myListeners);
    const listenersMap = new Map(statsData.map((s) => [s.album_id, s.listeners_count ?? 0]));

    // 6. Rerank : shared (primary) → score × popularité-proximité (secondary)
    const rankedIds = [...topIds].sort((a, b) => {
      const sa = scoreMap.get(a)!;
      const sb = scoreMap.get(b)!;
      if (sb.shared !== sa.shared) return sb.shared - sa.shared;
      const popSimA = 1 / (1 + Math.abs(myLogListeners - Math.log1p(listenersMap.get(a) ?? 0)));
      const popSimB = 1 / (1 + Math.abs(myLogListeners - Math.log1p(listenersMap.get(b) ?? 0)));
      return sb.score * popSimB - sa.score * popSimA;
    });

    return rankedIds
      .map((id) => {
        const a = albums.find((al) => al.id === id);
        if (!a) return null;
        const artistRel = a.artists as unknown as { id: string; name: string } | null;
        return {
          id: a.id,
          title: a.title,
          cover_url: a.cover_url,
          year: a.release_date ? new Date(a.release_date).getFullYear() : null,
          artist: artistRel?.name ?? 'Artiste inconnu',
          artistId: artistRel?.id ?? null,
          sharedGenres: scoreMap.get(id)?.shared ?? 0,
        };
      })
      .filter((x): x is SimilarAlbum => x !== null);
  } catch {
    return [];
  }
}

// ── Community genre voting ────────────────────────────────────────────────────

/**
 * Enregistre le vote de genre d'un utilisateur pour un album.
 * - 1 vote par user par album par genre (idempotent)
 * - N'écrase pas les genres déjà sources lastfm/musicbrainz
 * - Met à jour le weight si source=community existant
 */
export async function voteAlbumGenre(albumId: string, genreSlug: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');

  const entry = findGenreBySlug(genreSlug);
  if (!entry) throw new Error('Invalid genre');

  // Admin client : genres + album_genres en écriture sont restreints au service role
  const supabase = createSupabaseAdmin();

  // Upsert genre (crée si n'existe pas encore)
  const { data: genre } = await supabase
    .from('genres')
    .upsert({ name: entry.label, slug: entry.slug }, { onConflict: 'slug' })
    .select('id')
    .single();

  if (!genre?.id) return;

  // Enregistre le vote (idempotent)
  await supabase
    .from('album_genre_votes')
    .upsert(
      { user_id: user.id, album_id: albumId, genre_id: genre.id },
      { onConflict: 'user_id,album_id,genre_id' }
    );

  // Compte le total de votes pour ce genre sur cet album
  const { count } = await supabase
    .from('album_genre_votes')
    .select('*', { count: 'exact', head: true })
    .eq('album_id', albumId)
    .eq('genre_id', genre.id);

  const weight = count ?? 1;

  // Upsert dans album_genres uniquement si pas déjà présent via lastfm/musicbrainz
  const { data: existing } = await supabase
    .from('album_genres')
    .select('source')
    .eq('album_id', albumId)
    .eq('genre_id', genre.id)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from('album_genres')
      .insert({ album_id: albumId, genre_id: genre.id, source: 'community', weight });
  } else if (existing.source === 'community') {
    await supabase
      .from('album_genres')
      .update({ weight })
      .eq('album_id', albumId)
      .eq('genre_id', genre.id);
  }
}
