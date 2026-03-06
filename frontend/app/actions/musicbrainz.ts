'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import type { SearchResultUI } from './search';
import { enrichAlbumMetadata } from './metadata';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveform.app)';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 heures

// Secondary types that indicate non-studio releases (live, compilation, etc.)
const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live', 'Compilation', 'Remix', 'Demo',
  'Mixtape/Street', 'Spokenword', 'Interview',
  'Audiobook', 'Audio drama', 'Field recording',
]);

function normalizeReleaseDate(date?: string | null): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

interface MBRelease {
  id: string;
  title: string;
  'artist-credit': Array<{ artist: { id: string; name: string }; name?: string }>;
  date?: string;
  'cover-art-archive'?: { front?: boolean };
  'release-group'?: { id: string; 'primary-type'?: string };
}

interface MBReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit': Array<{ artist: { id: string; name: string } }>;
  'primary-type'?: string;
  relations?: any[];
}

interface MBReleaseGroupSearchResult {
  'release-groups': MBReleaseGroup[];
}

interface MBReleaseGroupDetail {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit': Array<{ artist: { id: string; name: string } }>;
  releases: MBRelease[];
}

interface MBSearchResult {
  releases: MBRelease[];
}

interface MBArtistSearchResult {
  artists: Array<{
    id: string;
    name: string;
    type?: string;
    country?: string;
    score?: number;
    'life-span'?: { begin?: string; end?: string };
  }>;
}

interface MBReleaseDetail {
  id: string;
  title: string;
  date?: string;
  'artist-credit': Array<{ artist: { id: string; name: string } }>;
  media: Array<{
    position: number;
    tracks: Array<{
      id: string;
      title: string;
      position: number;
      length?: number;
      'track_or_recording_length'?: number;
    }>;
  }>;
}

export type AlbumSearchResult = {
  id: string;          // release-group MBID (canonical identifier for dedup & covers)
  releaseId?: string;  // first release MBID (for import & cover fallback)
  title: string;
  artistName: string;
  releaseDate?: string;
  coverUrl?: string;   // CoverArt Archive URL — browser follows the 307 redirect
  hasCover: boolean;
  score: number;        // MB relevance score 0-100
  releaseCount: number; // number of physical/digital releases — proxy for popularity
};

export type ArtistSearchResult = {
  id: string; // MBID
  name: string;
  type?: string;
  country?: string;
  score: number; // MB relevance score 0-100
};

export type SearchFilter = 'all' | 'albums' | 'artists';

// ---------------------------------------------------------------------------
// Search cache helpers (shared across all users, stored in Supabase)
// ---------------------------------------------------------------------------

/** Simple non-cryptographic hash for cache keys — avoids storing raw queries */
function hashCacheKey(query: string, type: string): string {
  const str = `${query.toLowerCase().trim()}:${type}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit int
  }
  return `mb_${type}_${Math.abs(hash).toString(36)}`;
}

async function getCachedResults<T>(key: string): Promise<T | null> {
  try {
    const supabase = await createSupabaseServer();
    // Cast to any: search_cache table exists only after migration — TS types lag behind
    const { data } = await (supabase as any)
      .from('search_cache')
      .select('data')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const result = data.data as T;
    // Don't treat empty arrays as cache hits — re-query MB to get fresh results
    if (Array.isArray(result) && result.length === 0) return null;
    return result;
  } catch {
    return null; // Cache miss on error — degrade gracefully
  }
}

async function setCachedResults<T>(key: string, results: T): Promise<void> {
  try {
    const supabase = await createSupabaseServer();
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
    // Cast to any: search_cache table exists only after migration — TS types lag behind
    const db = supabase as any;
    // Purge expired entries while we're here (keep the table lean)
    await db.from('search_cache').delete().lt('expires_at', new Date().toISOString());
    await db
      .from('search_cache')
      .upsert({ key, data: results, expires_at: expiresAt }, { onConflict: 'key' });
  } catch {
    // Cache write failure is non-fatal — the search result was already returned
  }
}

/**
 * Fetch cover URL from CoverArt Archive with retry
 * Same robust logic as for artist releases
 */
async function fetchCoverUrl(releaseGroupId: string, maxRetries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds

      const coverArchiveUrl = `https://coverartarchive.org/release-group/${encodeURIComponent(releaseGroupId)}/front`;
      const coverResponse = await fetch(coverArchiveUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (
        coverResponse.status === 307 ||
        coverResponse.status === 301 ||
        coverResponse.status === 302
      ) {
        const location = coverResponse.headers.get('location');
        if (location) {
          return location;
        }
      } else if (coverResponse.ok) {
        return coverResponse.url;
      }
    } catch (err) {
      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        continue;
      }
    }
  }
  return null;
}

/**
 * Limit concurrency of async operations to avoid overwhelming APIs
 */
async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  delayMs = 500
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const executing: Promise<void>[] = [];

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const promise = task().then((result) => {
      results[index] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }

    // Add delay between requests to avoid overwhelming API
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  await Promise.all(executing);
  return results;
}

/**
 * Fetch with retry logic and exponential backoff.
 * @param timeoutMs - Per-attempt timeout in ms (default 8000). Reduce for SSR calls.
 * @param maxRetries - Max attempts (default 3). Use 2 for SSR to limit page blocking time.
 *
 * Also retries on HTTP 503 (Service Unavailable) and 429 (Too Many Requests),
 * which MusicBrainz returns when the 1 req/sec rate limit is hit.
 * Backoff is at least 1100ms for rate-limit responses to clear the MB window.
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  timeoutMs = 8000
): Promise<Response> {
  const shortUrl = url.split('?')[0];
  console.log(`[fetchWithRetry] → ${shortUrl} (maxRetries=${maxRetries}, timeout=${timeoutMs}ms)`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - t0;
      console.log(`[fetchWithRetry] ← ${shortUrl} — HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries}, ${elapsed}ms)`);

      // Retry on rate-limit (429) or service unavailable (503) — MB returns these
      // when the 1 req/sec limit is exceeded. Wait at least 1.1s before retrying.
      if ((response.status === 503 || response.status === 429) && attempt < maxRetries - 1) {
        const backoff = Math.max(1100, 100 * Math.pow(2, attempt));
        console.warn(`[fetchWithRetry] ⚠ ${response.status} rate-limit — waiting ${backoff}ms before retry`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      return response;
    } catch (err) {
      const elapsed = Date.now() - t0;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[fetchWithRetry] ✗ ${shortUrl} — ${errorMsg} (attempt ${attempt + 1}/${maxRetries}, ${elapsed}ms)`);
      if (attempt === maxRetries - 1) {
        throw err;
      }
      // Exponential backoff: 100ms, 200ms, 400ms
      const backoff = 100 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Search MusicBrainz for albums using the release-group endpoint.
 *
 * Why release-group instead of release:
 * - Each result IS already a unique album (no manual deduplication needed)
 * - primary-type / secondary-types are first-class fields (no nesting)
 * - first-release-date is the canonical date
 * - Up to 100 unique albums per query (was 50 releases, often the same album many times)
 *
 * Cover strategy: the CoverArt Archive URL is passed directly to the client.
 * The browser follows the 307 redirect; no server-side fetching or rate-limiting.
 */
export async function searchMusicBrainzAlbums(query: string, _limit = 30): Promise<{ success: boolean; results?: AlbumSearchResult[]; error?: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: 'not_authenticated' };

  // Check cache first — shared across all users
  const cacheKey = hashCacheKey(query, 'albums');
  const cached = await getCachedResults<AlbumSearchResult[]>(cacheKey);
  if (cached) {
    return { success: true, results: cached }; // already sorted by releaseCount
  }

  try {
    // Preserve original terms to detect apostrophes before stripping them.
    const preEscape = query.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, ' ').trim();
    const originalTerms = preEscape.split(/\s+/);
    // Strip apostrophes for the Lucene query (apostrophes aren't in the special set but
    // cause token mismatches: MB tokenises "What's" as "what", so we need to strip them).
    const escapedQuery = preEscape.replace(/'/g, '').trim();
    const terms = escapedQuery.split(/\s+/);

    // Contraction-normalised phrase: only strip the apostrophe + suffix when the user
    // explicitly typed an apostrophe. "what's" → "what" ✓. "blues", "james" unchanged ✓.
    // (For queries without apostrophe like "whats going on", the lower score threshold for
    // multi-word queries ensures MB still surfaces "What's Going On" via the terms clause.)
    const decontractedTerms = originalTerms.map((orig, i) =>
      orig.includes("'") ? orig.replace(/'\w*$/, '') : terms[i]
    );
    const decontractedPhrase = decontractedTerms.join(' ');

    // Two-clause (or three-clause) Lucene query combined with OR:
    //
    //   Clause A — exact phrase: releasegroup:"whats going on"~2
    //     → matches titles literally close to the query (e.g. "Whats Going On?")
    //
    //   Clause A' — decontracted phrase: releasegroup:"what going on"~2
    //     → matches "What's Going On" when user typed "what's going on"
    //     → omitted when identical to Clause A (no apostrophes in query)
    //
    //   Clause B — per-term cross-field AND: each word in title OR artist name
    //     → matches "michael jackson thriller" (words in artist + album title)
    //
    // Single-word fallback: just releasegroup:term.
    // Always limit=100 (MB max) — no popularity ranking from MB.
    const phraseA = `releasegroup:"${escapedQuery}"~2`;
    const phraseB = decontractedPhrase !== escapedQuery ? ` OR releasegroup:"${decontractedPhrase}"~2` : '';
    const termsClause = `(${terms.map((t) => `(releasegroup:${t} OR artistname:${t})`).join(' AND ')})`;
    const luceneQuery = terms.length === 1
      ? `releasegroup:${terms[0]}`
      : `${phraseA}${phraseB} OR ${termsClause}`;

    const mbUrl = new URL(`${MUSICBRAINZ_API}/release-group`);
    mbUrl.searchParams.set('query', luceneQuery);
    mbUrl.searchParams.set('limit', '100'); // Always max — popularity-agnostic API
    mbUrl.searchParams.set('fmt', 'json');

    const response = await fetchWithRetry(mbUrl.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      const error = `MusicBrainz search failed: ${response.status}`;
      console.error('[searchMusicBrainzAlbums]', error);
      return { success: false, error };
    }

    const data = await response.json();
    const releaseGroups: any[] = data['release-groups'] || [];

    if (releaseGroups.length === 0) {
      return { success: true, results: [] };
    }

    // Filter results client-side:
    // 1. Minimum relevance score (avoids noise from low-confidence MB matches).
    //    Multi-word queries use a lower threshold (30) because the OR combination of
    //    phrase + term clauses dilutes individual scores — "What's Going On" by Marvin
    //    Gaye gets score 39 in a combined query despite being the canonical match.
    //    computeRank (releaseCount + title similarity) handles quality sorting.
    // 2. Primary type must be Album or EP (was previously in Lucene — moved here for recall)
    // 3. No excluded secondary types (Live, Compilation, Remix, etc.)
    const scoreThreshold = terms.length === 1 ? 60 : 30;
    const studioAlbums = releaseGroups.filter((rg) => {
      if ((rg.score || 0) < scoreThreshold) return false;
      const primaryType: string = rg['primary-type'] || '';
      if (!['Album', 'EP'].includes(primaryType)) return false;
      const secondaryTypes: string[] = rg['secondary-types'] || [];
      return !secondaryTypes.some((t) => EXCLUDED_SECONDARY_TYPES.has(t));
    });

    // Sort by release-count DESC — more releases = more iconic/widely-distributed album.
    // MB doesn't rank by popularity; this re-sorts its arbitrary ordering so canonical
    // albums (MJ's Thriller, Pink Floyd's DSOTM…) surface before obscure homonyms.
    // MB search returns `count` (not `release-count` which is the browse endpoint field name)
    studioAlbums.sort((a, b) => ((b['count'] || b['release-count'] || 0) - (a['count'] || a['release-count'] || 0)));

    // Results are already unique release-groups — no deduplication needed.
    // No slice here: return all filtered results so mergeAndRank can re-rank
    // client-side with the full set (text similarity + releaseCount bonus).
    const results: AlbumSearchResult[] = studioAlbums.map((rg) => {
        const artists = rg['artist-credit'] || [];
        const artistName = artists.map((a: any) => a.name || a.artist?.name).join(', ');
        // releases[0] gives us a release MBID for import & cover fallback
        const releaseId = (rg.releases as Array<{ id: string }> | undefined)?.[0]?.id;

        return {
          id: rg.id,        // release-group MBID — canonical identifier
          releaseId,        // first release MBID — for import & fallback cover
          title: rg.title,
          artistName: artistName || 'Unknown',
          releaseDate: rg['first-release-date'],
          // CoverArt Archive URL — browser follows the 307 redirect automatically
          coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front`,
          hasCover: true,   // assume true; AlbumCoverImage handles 404s gracefully
          score: rg.score || 0,
          releaseCount: rg['count'] || rg['release-count'] || 0,
        };
      });

    // Store in cache before returning (fire-and-forget)
    setCachedResults(cacheKey, results);

    return { success: true, results };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[searchMusicBrainzAlbums]', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Search MusicBrainz for artists via the /artist endpoint.
 *
 * Uses the dedicated /artist endpoint — MB ranks artists by entity-level
 * relevance (name, aliases, tags) which correctly surfaces Michael Jackson
 * for "jackson" (score 100) ahead of obscure homonyms.
 *
 * Wildcard on the last term enables prefix matching: "marvin ga" → finds Marvin Gaye.
 */
export async function searchMusicBrainzArtists(query: string, limit = 30): Promise<{ success: boolean; results?: ArtistSearchResult[]; error?: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: 'not_authenticated' };

  // Check cache first — shared across all users
  const cacheKey = hashCacheKey(query, 'artists');
  const cached = await getCachedResults<ArtistSearchResult[]>(cacheKey);
  if (cached) {
    return { success: true, results: cached.slice(0, limit) };
  }

  try {
    // Build term-by-term with wildcard on the last word: "marvin ga" → artist:marvin AND artist:ga*
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const luceneParts = terms.map((t, i) => {
      const esc = t.replace(/[+\-&|!(){}\[\]^"~?:\\\/]/g, '\\$&');
      return i === terms.length - 1 ? `artist:${esc}*` : `artist:${esc}`;
    });
    const luceneQuery = luceneParts.join(' AND ');
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/artist?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=${limit}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) {
      return { success: false, error: 'MusicBrainz artist search failed' };
    }

    const data = await response.json();
    const artists: any[] = data['artists'] || [];

    const results: ArtistSearchResult[] = artists
      .filter((a) => (a.score || 0) >= 60)
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type || undefined,
        country: a.country || undefined,
        score: a.score || 0,
      }));

    // Store in cache before returning (fire-and-forget)
    setCachedResults(cacheKey, results);

    return { success: true, results };
  } catch (err) {
    console.error('searchMusicBrainzArtists error:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Search MusicBrainz with filter support
 * @deprecated Use searchMusicBrainzAlbums or searchMusicBrainzArtists directly
 */
export async function searchMusicBrainz(query: string, limit = 10): Promise<{ success: boolean; results?: AlbumSearchResult[]; error?: string }> {
  return searchMusicBrainzAlbums(query, limit);
}

/**
 * Preview album from MusicBrainz (fetch details)
 */
export async function previewAlbumFromMusicBrainz(mbid: string) {
  try {
    let releaseResponse = await fetch(
      `${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+release-groups&fmt=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    // mbid may be a release-group MBID (from getArtistReleases which uses browse endpoint).
    // The browse endpoint doesn't support inc=releases, so we store the release-group MBID.
    // In that case, /release/{rgMbid} returns 404 — resolve it via the release-group lookup.
    if (releaseResponse.status === 404) {
      const rgResponse = await fetch(
        `${MUSICBRAINZ_API}/release-group/${encodeURIComponent(mbid)}?inc=releases&fmt=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!rgResponse.ok) {
        return { success: false, error: 'Album not found' };
      }
      const rgData: any = await rgResponse.json();
      const firstReleaseId: string | undefined = rgData.releases?.[0]?.id;
      if (!firstReleaseId) {
        return { success: false, error: 'No releases found for this release group' };
      }
      releaseResponse = await fetch(
        `${MUSICBRAINZ_API}/release/${encodeURIComponent(firstReleaseId)}?inc=artist-credits+recordings+release-groups&fmt=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
    }

    if (!releaseResponse.ok) {
      return { success: false, error: 'Album not found' };
    }

    const data: MBReleaseDetail = await releaseResponse.json();

    const artistCredit = data['artist-credit']?.[0];
    const artist = artistCredit?.artist || { id: '', name: 'Unknown' };

    const tracks = (data.media || []).flatMap((m) =>
      (m.tracks || []).map((t) => ({ ...t, _discNo: m.position }))
    );

    // Get release-group ID for consistent cover lookup
    const releaseGroupId = (data as any)['release-group']?.id || mbid;

    // Fetch cover art from CoverArt Archive using release-group (consistent with search)
    let coverUrl: string | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        // Use release-group for cover (more consistent, same as search)
        const coverArchiveUrl = `https://coverartarchive.org/release-group/${encodeURIComponent(releaseGroupId)}/front`;
        const coverResponse = await fetch(coverArchiveUrl, {
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'manual',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // CoverArt Archive returns 307 redirect to the actual image
        if (
          coverResponse.status === 307 ||
          coverResponse.status === 301 ||
          coverResponse.status === 302
        ) {
          const location = coverResponse.headers.get('location');
          if (location) {
            coverUrl = location;
          }
        } else if (coverResponse.ok) {
          coverUrl = coverResponse.url;
        } else {
          console.warn(`⚠️ Cover not found (${coverResponse.status})`);
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.warn(`⏱️ Cover fetch timeout (5s)`);
        } else {
          console.warn(`⚠️ Cover fetch failed:`, fetchErr.message);
        }
        // Continue without cover
      }
    } catch (err) {
      console.error('❌ Cover art error:', err);
      // Continue without cover
    }

    return {
      success: true,
      preview: {
        mbid: data.id,
        title: data.title,
        artist: artist.name,
        artistMbid: artist.id,
        date: data.date || null,
        coverUrl,
        tracks: tracks.map((t) => ({
          mbid: t.id,
          title: t.title,
          position: t.position,
          discNo: t._discNo ?? 1,
          duration: t.length ?? t['track_or_recording_length'] ?? null,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Import album from MusicBrainz
 * Idempotent: if exists, return existing
 * Creates: artist, album, tracks, external_ids
 */
export async function importAlbumFromMusicBrainz(mbid: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createSupabaseServer();
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch preview
    const previewResult = await previewAlbumFromMusicBrainz(mbid);
    if (!previewResult.success) {
      return previewResult;
    }

    const preview = previewResult.preview!;

    // Check if album already imported
    const { data: existingAlbum, error: existingAlbumError } = await supabase
      .from('albums')
      .select('id')
      .eq('mbid', mbid)
      .limit(1)
      .maybeSingle();

    if (existingAlbumError) {
      return { success: false, error: existingAlbumError.message };
    }

    if (existingAlbum) {
      return { success: true, albumId: existingAlbum.id, imported: false };
    }

    // Get or create artist
    let artistId: string;
    let createdArtist = false;
    const { data: existingArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('mbid', preview.artistMbid)
      .single();

    if (existingArtist) {
      artistId = existingArtist.id;
    } else {
      const newArtistId = crypto.randomUUID();
      const { error: artistError } = await supabase.from('artists').insert({
        id: newArtistId,
        name: preview.artist,
        mbid: preview.artistMbid,
      });
      if (artistError) {
        return { success: false, error: artistError.message };
      }
      artistId = newArtistId;
      createdArtist = true;
    }

    // Create album
    // Use cover URL from preview (which uses release-group and is verified)
    const newAlbumId = crypto.randomUUID();
    const { error: albumError } = await supabase
      .from('albums')
      .insert({
        id: newAlbumId,
        title: preview.title,
        artist_id: artistId,
        mbid: mbid,
        release_date: normalizeReleaseDate(preview.date),
        cover_url: preview.coverUrl || null,  // Use actual cover from preview
      });

    if (albumError) {
      if (createdArtist) {
        await supabase.from('artists').delete().eq('id', artistId);
      }
      return { success: false, error: albumError.message };
    }

    const trackRows = preview.tracks.map((track) => ({
      id: crypto.randomUUID(),
      album_id: newAlbumId,
      artist_id: artistId,
      title: track.title,
      track_no: track.position,
      disc_no: (track as any).discNo ?? null,
      duration_ms: track.duration,
      mbid: track.mbid,
    }));

    const trackExternalRows = trackRows.map((track) => ({
      entity_type: 'track',
      entity_id: track.id,
      source: 'musicbrainz',
      value: track.mbid,
    }));

    const rollbackImport = async () => {
      const trackIds = trackRows.map((t) => t.id);
      if (trackIds.length > 0) {
        await supabase.from('tracks').delete().eq('album_id', newAlbumId);
        await supabaseAdmin.from('external_ids').delete().in('entity_id', trackIds);
      }
      await supabaseAdmin.from('external_ids').delete().eq('entity_id', newAlbumId);
      await supabase.from('albums').delete().eq('id', newAlbumId);

      if (createdArtist) {
        const { count } = await supabase
          .from('albums')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artistId);

        if (!count || count === 0) {
          await supabase.from('artists').delete().eq('id', artistId);
        }
      }
    };

    if (trackRows.length > 0) {
      const { error: tracksError } = await supabase.from('tracks').insert(trackRows);
      if (tracksError) {
        await rollbackImport();
        return { success: false, error: tracksError.message };
      }
    }

    const externalRows = [
      {
        entity_type: 'album',
        entity_id: newAlbumId,
        source: 'musicbrainz',
        value: mbid,
      },
      ...trackExternalRows,
    ];

    const { error: externalError } = await supabaseAdmin.from('external_ids').insert(externalRows);
    if (externalError) {
      await rollbackImport();
      return { success: false, error: externalError.message };
    }

    // Enrichissement metadata (genres + description) — best-effort, n'impacte pas l'import
    await enrichAlbumMetadata(newAlbumId, mbid, preview.title, preview.artist);

    return { success: true, albumId: newAlbumId, imported: true };
  } catch (err) {
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Preview artist from MusicBrainz (fetch details and releases)
 */
export async function previewArtistFromMusicBrainz(mbid: string) {
  try {
    // First fetch artist info with URL relations for Wikipedia
    const artistResponse = await fetch(
      `${MUSICBRAINZ_API}/artist/${encodeURIComponent(mbid)}?fmt=json&inc=url-rels`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!artistResponse.ok) {
      return { success: false, error: 'Artist not found' };
    }

    const artistData: any = await artistResponse.json();

    // Try to extract bio from Wikipedia if available
    let bio = null;
    const wikipediaUrl = artistData.relations?.find((rel: any) => 
      rel.type === 'wikipedia' && rel.url?.resource
    )?.url?.resource;

    if (wikipediaUrl) {
      try {
        // Extract language + page title from URL (e.g. fr.wikipedia.org/wiki/Radiohead)
        const urlObj = new URL(wikipediaUrl);
        const lang = urlObj.hostname.split('.')[0]; // "fr", "en", "de", etc.
        const pageName = urlObj.pathname.split('/wiki/').pop();
        if (pageName) {
          const wikiApiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(pageName))}`;
          const wikiResponse = await fetch(wikiApiUrl);
          if (wikiResponse.ok) {
            const wikiData: any = await wikiResponse.json();
            bio = wikiData.extract || null;
          }
        }
      } catch (err) {
        console.error('Failed to fetch Wikipedia bio:', err);
      }
    }

    // Fallback bio from MusicBrainz disambiguation
    if (!bio && artistData.disambiguation) {
      bio = artistData.disambiguation;
    }

    // Then fetch ALL releases by this artist using arid search
    const releasesResponse = await fetch(
      `${MUSICBRAINZ_API}/release?query=arid:${encodeURIComponent(mbid)}&limit=100&fmt=json`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!releasesResponse.ok) {
      return { 
        success: true, 
        preview: {
          mbid: artistData.id,
          name: artistData.name,
          country: artistData.country || null,
          type: artistData.type || null,
          bio: bio,
          releases: [],
        }
      };
    }

    const releasesData: any = await releasesResponse.json();
    const releases = releasesData.releases || [];

    // Deduplicate releases by release-group
    const releaseGroupMap = new Map<string, any>();

    for (const release of releases) {
      const rgId = release['release-group']?.id;
      if (!rgId) continue;

      const existing = releaseGroupMap.get(rgId);
      if (!existing) {
        releaseGroupMap.set(rgId, release);
      } else {
        // Prefer the most complete release (highest track count)
        const existingCount = existing['track-count'] ?? 0;
        const newCount = release['track-count'] ?? 0;
        if (newCount > existingCount) {
          releaseGroupMap.set(rgId, release);
        }
      }
    }

    const uniqueReleases = Array.from(releaseGroupMap.values());

    const coverTasks = uniqueReleases.map((release) => async () => {
      const rgId = release['release-group']?.id;
      const coverUrl = rgId ? await fetchCoverUrl(rgId) : null;

      return {
        ...release,
        cover: coverUrl,
      };
    });

    const releasesWithCovers = await limitConcurrency(coverTasks, 4, 300);

    return {
      success: true,
      preview: {
        mbid: artistData.id,
        name: artistData.name,
        country: artistData.country || null,
        type: artistData.type || null,
        bio: bio,
        releases: releasesWithCovers
          .filter((r) => r['release-group']?.['primary-type'] === 'Album' || r['release-group']?.['primary-type'] === 'EP')
          .map((r) => ({
            mbid: r.id,
            releaseGroupMbid: r['release-group']?.id,
            title: r.title,
            date: r.date || null,
            type: r['release-group']?.['primary-type'],
            cover: r.cover,
          }))
          .sort((a, b) => {
            // Sort by date descending
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
          }),
      },
    };
  } catch (err) {
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Fetch all studio albums & EPs for an artist from MusicBrainz.
 *
 * Uses the browse endpoint (/release-group?artist=MBID) instead of the search
 * endpoint (/release?query=arid:MBID) because:
 * - Browse is exhaustive — it returns ALL release-groups for the artist
 * - Search ranks by relevance score — recent albums can be pushed out of the top 100
 * - Results are already release-groups — no manual deduplication needed
 * - Primary type filtering is done client-side (pipe-separated syntax rejected by MB API with 400)
 *
 * inc=releases is NOT supported by the browse endpoint — previewAlbumFromMusicBrainz
 * handles the release-group MBID by doing a release-group lookup on 404.
 */
export async function getArtistReleases(mbid: string): Promise<{
  success: boolean;
  releases?: Array<{ mbid: string; releaseGroupMbid: string; title: string; date: string | null; type: string | null }>;
  error?: string;
}> {
  console.log(`[getArtistReleases] called with mbid="${mbid}"`);
  if (!mbid) {
    console.error('[getArtistReleases] ✗ mbid is empty/null — skipping MB fetch');
    return { success: false, error: 'mbid is empty' };
  }

  try {
    // 2 retries × 5s timeout = 10.1s max, runs in parallel with getOrFetchArtistMeta
    // NOTE: inc=releases is NOT supported by the browse endpoint — only by the lookup endpoint.
    // NOTE: type filter omitted — pipe-separated (Album|EP) and repeated params both cause 400.
    //       Primary type filtering is done client-side below.
    const browseUrl = `${MUSICBRAINZ_API}/release-group?artist=${encodeURIComponent(mbid)}&fmt=json&limit=100`;
    console.log(`[getArtistReleases] URL: ${browseUrl}`);
    const response = await fetchWithRetry(
      browseUrl,
      { headers: { 'User-Agent': USER_AGENT } },
      2,
      5000
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      console.error(`[getArtistReleases] ✗ HTTP ${response.status} — body: ${body}`);
      return { success: true, releases: [] };
    }

    const data: any = await response.json();
    const releaseGroups: any[] = data['release-groups'] || [];
    console.log(`[getArtistReleases] MB returned ${releaseGroups.length} release-groups for mbid="${mbid}"`);

    const ALLOWED_PRIMARY_TYPES = new Set(['Album', 'EP']);
    const filtered = releaseGroups.filter(rg => {
      const primary: string | null = rg['primary-type'] || null;
      if (primary && !ALLOWED_PRIMARY_TYPES.has(primary)) {
        console.log(`[getArtistReleases]   skip "${rg.title}" (primary-type: ${primary})`);
        return false;
      }
      const secondaries: string[] = rg['secondary-types'] || [];
      const excluded = secondaries.some(t => EXCLUDED_SECONDARY_TYPES.has(t));
      if (excluded) {
        console.log(`[getArtistReleases]   skip "${rg.title}" (secondary-types: ${secondaries.join(', ')})`);
      }
      return !excluded;
    });

    console.log(`[getArtistReleases] ${filtered.length} release-groups after secondary-type filter`);

    const result = filtered
      .map(rg => {
        console.log(`[getArtistReleases]   "${rg.title}" (${rg['primary-type']}, ${rg['first-release-date'] || 'no date'}) — rgId=${rg.id}`);
        return {
          mbid: rg.id,             // release-group MBID (browse endpoint doesn't support inc=releases)
          releaseGroupMbid: rg.id,
          title: rg.title,
          date: rg['first-release-date'] || null,
          type: rg['primary-type'] || null,
        };
      })
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

    console.log(`[getArtistReleases] ✓ returning ${result.length} releases for mbid="${mbid}"`);
    return { success: true, releases: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[getArtistReleases] ✗ exception: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch artist metadata (bio + image) from MusicBrainz/Wikipedia/Wikidata.
 * This is meant to be called once and cached in DB.
 */
export async function fetchArtistMetadata(mbid: string): Promise<{
  bio: string | null;
  imageUrl: string | null;
  country: string | null;
  type: string | null;
  name: string;
}> {
  try {
    // 2 retries × 3s = one-time cost (result cached in DB after first call)
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/artist/${encodeURIComponent(mbid)}?fmt=json&inc=url-rels`,
      { headers: { 'User-Agent': USER_AGENT } },
      2,
      3000
    );

    if (!response.ok) {
      return { bio: null, imageUrl: null, country: null, type: null, name: '' };
    }

    const data: any = await response.json();
    let bio: string | null = null;
    let imageUrl: string | null = null;

    // Extract Wikipedia URL for bio
    const wikipediaUrl = data.relations?.find((rel: any) =>
      rel.type === 'wikipedia' && rel.url?.resource
    )?.url?.resource;

    if (wikipediaUrl) {
      try {
        const urlObj = new URL(wikipediaUrl);
        const lang = urlObj.hostname.split('.')[0]; // "fr", "en", "de", etc.
        const pageName = urlObj.pathname.split('/wiki/').pop();
        if (pageName) {
          const wikiResp = await fetchWithRetry(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(pageName))}`,
            undefined,
            2,
            3000
          );
          if (wikiResp.ok) {
            const wikiData = await wikiResp.json();
            bio = wikiData.extract || null;
          }
        }
      } catch {}
    }

    if (!bio && data.disambiguation) {
      bio = data.disambiguation;
    }

    // Extract Wikidata URL for image
    const wikidataUrl = data.relations?.find((rel: any) =>
      rel.type === 'wikidata' && rel.url?.resource
    )?.url?.resource;

    if (wikidataUrl) {
      try {
        const wikidataId = wikidataUrl.split('/').pop();
        if (wikidataId) {
          const wdResp = await fetchWithRetry(
            `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`,
            undefined,
            2,
            3000
          );
          if (wdResp.ok) {
            const wdData = await wdResp.json();
            const entity = wdData.entities?.[wikidataId];
            const imageFile = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
            if (imageFile) {
              // Wikimedia Commons URL from filename
              const encoded = encodeURIComponent(imageFile.replace(/ /g, '_'));
              imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
            }
          }
        }
      } catch {}
    }

    return {
      bio,
      imageUrl,
      country: data.country || null,
      type: data.type || null,
      name: data.name || '',
    };
  } catch {
    return { bio: null, imageUrl: null, country: null, type: null, name: '' };
  }
}

export type StreamingLinks = {
  spotify?: string;
  appleMusic?: string;
  deezer?: string;
  tidal?: string;
};

function extractStreamingLinks(relations: any[]): StreamingLinks {
  const links: StreamingLinks = {};
  for (const rel of relations) {
    const url: string | undefined = rel.url?.resource;
    if (!url) continue;
    if (url.includes('spotify.com') && !links.spotify) links.spotify = url;
    else if (url.includes('music.apple.com') && !links.appleMusic) links.appleMusic = url;
    else if (url.includes('deezer.com') && !links.deezer) links.deezer = url;
    else if (url.includes('tidal.com') && !links.tidal) links.tidal = url;
  }
  return links;
}

/**
 * Fetch streaming platform links for an album via MusicBrainz url-rels.
 * Streaming links (Spotify, Apple Music…) are on specific releases in MB,
 * not necessarily the one stored (which may be a physical edition).
 *
 * Strategy:
 *   1. Lookup the stored release → check its url-rels, get the release-group id
 *   2. Browse sibling releases with inc=media to identify digital editions
 *   3. Lookup the best candidate (digital first, otherwise first sibling) for url-rels
 *
 * All fetches are cached 24h by Next.js Data Cache.
 */
export async function getAlbumStreamingLinks(mbid: string): Promise<StreamingLinks> {
  const headers = { 'User-Agent': USER_AGENT };
  const cache: RequestInit = { headers, next: { revalidate: 86400 } };

  try {
    // Step 1 — lookup the stored release
    const releaseRes = await fetch(
      `${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?inc=url-rels+release-groups&fmt=json`,
      cache
    );
    if (!releaseRes.ok) return {};

    const releaseData = await releaseRes.json();
    const releaseLinks = extractStreamingLinks(releaseData.relations || []);
    if (Object.keys(releaseLinks).length > 0) return releaseLinks;

    // Step 2 — browse sibling releases with their media formats (not url-rels,
    // which are not returned inline by the browse endpoint)
    const rgId: string | undefined = releaseData['release-group']?.id;
    if (!rgId) return {};

    const browseRes = await fetch(
      `${MUSICBRAINZ_API}/release?release-group=${encodeURIComponent(rgId)}&inc=media&fmt=json&limit=50`,
      cache
    );
    if (!browseRes.ok) return {};

    const browseData = await browseRes.json();
    const siblings: any[] = (browseData.releases || []).filter((r: any) => r.id !== mbid);
    if (siblings.length === 0) return {};

    // Prefer "Digital Media" releases; fall back to first sibling
    const digital = siblings.filter((r: any) =>
      r.media?.some((m: any) => m.format === 'Digital Media')
    );
    const candidate = (digital[0] || siblings[0]) as { id: string };

    // Step 3 — lookup the candidate release for its url-rels
    const candidateRes = await fetch(
      `${MUSICBRAINZ_API}/release/${encodeURIComponent(candidate.id)}?inc=url-rels&fmt=json`,
      cache
    );
    if (!candidateRes.ok) return {};

    const candidateData = await candidateRes.json();
    return extractStreamingLinks(candidateData.relations || []);
  } catch {
    return {};
  }
}

export async function searchMusicBrainzPreview(query: string): Promise<SearchResultUI[]> {
  const authUser = await getAuthUser();
  if (!authUser) return [];

  const limit = 5;
  try {
    const response = await fetch(
      `${MUSICBRAINZ_API}/release?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Waveform/1.0 (https://waveform.app)',
        },
      }
    );

    if (!response.ok) {
      console.error('MusicBrainz search failed');
      return [];
    }

    const data: MBSearchResult = await response.json();

    return data.releases.slice(0, limit).map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r['artist-credit']?.[0]?.artist?.name || 'Unknown',
      coverUrl: r['cover-art-archive']?.front
        ? `https://coverartarchive.org/release/${r.id}/front`
        : undefined,
      kind: "album",
      source: "musicbrainz",
    }));
  } catch (err) {
    console.error('Error fetching from MusicBrainz:', err);
    return [];
  }
}
