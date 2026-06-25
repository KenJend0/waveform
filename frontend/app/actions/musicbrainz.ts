'use server';

import { after } from 'next/server';
import { logAuthedProductEvent } from '@/lib/productEvents';
import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { uploadCoverToSupabase } from '@/lib/storage';
import { enrichAlbumMetadata } from './metadata';
import type { SearchResultUI } from './search';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 heures

// Search timeout: prod (Vercel → MB) ~200ms, dev (localhost → MB) ~400ms.
// 800ms gives comfortable headroom in both environments.
const MB_SEARCH_TIMEOUT_MS = 800;

// Recording search is slower than album/artist search — give more time.
const MB_RECORDING_SEARCH_TIMEOUT_MS = 2000;

// Secondary types that indicate non-studio releases (live, compilation, etc.)
const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live', 'Compilation', 'Remix', 'Demo',
  'Spokenword', 'Interview',
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
      recording?: { length?: number };
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
// Search cache — L1: module-level Map (~1ms), L2: Supabase (~15ms prod / ~250ms dev)
// ---------------------------------------------------------------------------

/** In-memory cache — persists across requests within the same server instance.
 *  Shorter TTL than Supabase so stale data doesn't accumulate in long-running processes. */
const memCache = new Map<string, { data: unknown; expiresAt: number }>();
const MEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  // L1: memory (~1ms)
  const mem = memCache.get(key);
  if (mem && mem.expiresAt > Date.now()) return mem.data as T;

  // L2: Supabase (~15ms prod, ~250ms dev)
  try {
    const db = createSupabaseAdmin() as any;
    const { data } = await db
      .from('search_cache')
      .select('data')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const result = data.data as T;
    if (Array.isArray(result) && result.length === 0) return null;
    // Populate L1 from Supabase hit
    memCache.set(key, { data: result, expiresAt: Date.now() + MEM_CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}

async function setCachedResults<T>(key: string, results: T): Promise<void> {
  // L1: write synchronously (instant, no await)
  memCache.set(key, { data: results, expiresAt: Date.now() + MEM_CACHE_TTL_MS });

  // L2: persist to Supabase (async, survives server restarts)
  try {
    const db = createSupabaseAdmin() as any;
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
    await db.from('search_cache').delete().lt('expires_at', new Date().toISOString());
    await db
      .from('search_cache')
      .upsert({ key, data: results, expires_at: expiresAt }, { onConflict: 'key' });
  } catch {
    // Supabase write failure is non-fatal — L1 is already populated
  }
}

/**
 * Fetch cover URL from CoverArt Archive with retry
 * Same robust logic as for artist releases
 */
export async function fetchCoverUrl(mbid: string, entityType: 'release-group' | 'release' = 'release-group', maxRetries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds

      const coverArchiveUrl = `https://coverartarchive.org/${entityType}/${encodeURIComponent(mbid)}/front`;
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
  // Check cache first — no auth needed (admin client, public MB data)
  const cacheKey = hashCacheKey(query, 'albums');
  const cached = await getCachedResults<AlbumSearchResult[]>(cacheKey);
  if (cached) {
    return { success: true, results: cached }; // already sorted by releaseCount
  }

  try {
    // Expand common apostrophe-less contractions so MB's standard analyser can match them.
    // MB indexes "What's" as "what" and "Who's" as "who" — if the user types "whats" or
    // "whos" (no apostrophe), our query must send "what"/"who" or both to get a match.
    const CONTRACTION_MAP: Record<string, string> = {
      'whats': 'what', 'whos': 'who', 'hows': 'how', 'thats': 'that',
      'wont': 'will not', 'dont': 'do not', 'cant': 'can', 'doesnt': 'does not',
      'isnt': 'is not', 'wasnt': 'was not', 'werent': 'were not',
      'im': 'i am', 'youre': 'you are', 'theyre': 'they are', 'its': 'it',
    };
    const expandContractions = (s: string) =>
      s.split(/\s+/).map((w) => CONTRACTION_MAP[w.toLowerCase()] ?? w).join(' ');
    const queryExpanded = expandContractions(query);

    // Preserve original terms to detect apostrophes before stripping them.
    const preEscape = queryExpanded.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, ' ').trim();
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

    // Clause B: per-term cross-field AND — use DECONTRACTED terms so "what's" → "what"
    // matches MB's standard-analyser tokens (which strip apostrophe+suffix).
    const termsClause = `(${decontractedTerms.map((t) => `(releasegroup:${t} OR artistname:${t})`).join(' AND ')})`;

    // Split strategy — generates multiple hypotheses when query mixes title + artist.
    // All OR-combined so spurious matches are absorbed into a larger candidate pool
    // and re-sorted by computeRank (text similarity + popularity).
    //
    // Strategy A — TITLE-THEN-ARTIST (user typed title first, artist last):
    //   Clause C: last 1 word = artist  → releasegroup:title AND artistname:last*
    //   Clause D: last 2 words = artist → releasegroup:title AND artistname:"last two"
    //
    // Strategy B — ARTIST-THEN-TITLE (user typed artist first, title last):
    //   Clause F: first 1 word = artist → artistname:first* AND releasegroup:title
    //             (skipped if first word is a stop word like "the", "a", "my"…)
    //   Clause G: first 2 words = artist → artistname:"first two" AND releasegroup:title
    //             e.g. "ar rahman roja" → artistname:"ar rahman" AND releasegroup:roja
    //             e.g. "utada hikaru first love" → artistname:"utada hikaru" AND releasegroup:"first love"~1
    //
    // Strategy E — TITLE-ONLY fallbacks (no artist constraint, 3+ words only):
    //   E1: title = all-but-last-1 (phrase) → catches "college dropout kanye"
    //   E2: title = all-but-last-2 (word or phrase) → catches "graduation kanye west"
    //   Handles renamed artists (e.g. Kanye West → Ye on MB) where artist clauses all fail.
    const SPLIT_STOP_WORDS = new Set([
      'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'my',
      'it', 'its', 'or', 'and', 'as', 'if', 'so', 'is', 'am', 'are', 'be',
    ]);

    let splitClauses = '';

    if (decontractedTerms.length >= 2) {
      // Clause C — title-last-1
      const titleC = decontractedTerms.slice(0, -1).join(' ');
      const artistC = decontractedTerms[decontractedTerms.length - 1];
      const titleQC = titleC.includes(' ') ? `"${titleC}"~1` : titleC;
      splitClauses += ` OR (releasegroup:${titleQC} AND artistname:${artistC}*)`;

      // Clause F — artist-first-1 (only when first word is not a stop word)
      const artistF = decontractedTerms[0];
      if (!SPLIT_STOP_WORDS.has(artistF)) {
        const titleF = decontractedTerms.slice(1).join(' ');
        const titleQF = titleF.includes(' ') ? `"${titleF}"~1` : titleF;
        splitClauses += ` OR (artistname:${artistF}* AND releasegroup:${titleQF})`;
      }
    }

    if (decontractedTerms.length >= 3) {
      // Clause D — title-last-2
      const titleD = decontractedTerms.slice(0, -2).join(' ');
      const artistD = decontractedTerms.slice(-2).join(' ');
      const titleQD = titleD.includes(' ') ? `"${titleD}"~1` : titleD;
      splitClauses += ` OR (releasegroup:${titleQD} AND artistname:"${artistD}")`;

      // Clause G — artist-first-2
      const artistG = decontractedTerms.slice(0, 2).join(' ');
      const titleG = decontractedTerms.slice(2).join(' ');
      if (titleG.length > 0) {
        const titleQG = titleG.includes(' ') ? `"${titleG}"~1` : titleG;
        splitClauses += ` OR (artistname:"${artistG}" AND releasegroup:${titleQG})`;
      }

      // Clause E1 — title-only (all-but-last-1), phrase search
      const titleC = decontractedTerms.slice(0, -1).join(' ');
      const titleQC = titleC.includes(' ') ? `"${titleC}"~1` : titleC;
      splitClauses += ` OR releasegroup:${titleQC}`;

      // Clause E2 — title-only (all-but-last-2), word or short phrase
      splitClauses += ` OR releasegroup:${titleQD}`;
    }

    const luceneQuery = terms.length === 1
      ? `releasegroup:${terms[0]}`
      : `${phraseA}${phraseB} OR ${termsClause}${splitClauses}`;

    const mbUrl = new URL(`${MUSICBRAINZ_API}/release-group`);
    mbUrl.searchParams.set('query', luceneQuery);
    mbUrl.searchParams.set('limit', '100'); // Always max — popularity-agnostic API
    mbUrl.searchParams.set('fmt', 'json');
    // Don't use inc=releases — rg['release-count'] already gives the count without bloating the payload

    // No retry — fail fast for search, rely on cache/internal if MB is slow
    const response = await fetchWithRetry(mbUrl.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    }, 1, MB_SEARCH_TIMEOUT_MS);

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
    // Threshold: 60 for single-word (avoids noise), 20 for multi-word.
    // Was 30 — lowered to 20 because combined OR queries (phrase + terms) dilute individual
    // scores: "graduation kanye west" matches Kanye West's Graduation via the terms clause
    // but MB assigns it ~20-28 because title+artist terms are split across fields.
    // computeRank's text-similarity + popularity re-sorts quality after retrieval.
    const scoreThreshold = terms.length === 1 ? 60 : 20;
    const preFilterCount = releaseGroups.length;
    console.log(`[searchMusicBrainzAlbums] "${query}" → ${preFilterCount} raw results (threshold=${scoreThreshold})`);
    const studioAlbums = releaseGroups.filter((rg) => {
      if ((rg.score || 0) < scoreThreshold) return false;
      const primaryType: string = rg['primary-type'] || '';
      if (!['Album', 'EP'].includes(primaryType)) return false;
      const secondaryTypes: string[] = rg['secondary-types'] || [];
      return !secondaryTypes.some((t) => EXCLUDED_SECONDARY_TYPES.has(t));
    });

    // Sort by releases.length DESC — more releases = more iconic/widely-distributed album.
    // MB doesn't rank by popularity; this re-sorts its arbitrary ordering so canonical
    // albums (MJ's Thriller, Pink Floyd's DSOTM…) surface before obscure homonyms.
    // Requires inc=releases in the search URL to get the releases array per release-group.
    const releaseCountOf = (rg: any): number => rg['release-count'] ?? 0;
    console.log(`[searchMusicBrainzAlbums] "${query}" → ${studioAlbums.length}/${preFilterCount} passed filter`);
    if (process.env.NODE_ENV === 'development') {
      studioAlbums.slice(0, 5).forEach(rg => {
        console.log(`[MB] "${rg.title}" score=${rg.score} release-count=${releaseCountOf(rg)} type=${rg['primary-type']}`);
      });
    }
    studioAlbums.sort((a, b) => releaseCountOf(b) - releaseCountOf(a));

    // Results are already unique release-groups — no deduplication needed.
    // No slice here: return all filtered results so mergeAndRank can re-rank
    // client-side with the full set (text similarity + releaseCount bonus).
    const results: AlbumSearchResult[] = studioAlbums.map((rg) => {
        const artists = rg['artist-credit'] || [];
        const artistName = artists.map((a: any) => a.name || a.artist?.name).join(', ');
        // releases[0] gives us a release MBID for import & cover fallback
        // releases array absent (inc=releases removed) — use release-count for popularity, releaseId unavailable
        const releaseId: string | undefined = undefined;

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
          releaseCount: rg['release-count'] || 0,
        };
      });

    // Store in cache before returning (fire-and-forget)
    setCachedResults(cacheKey, results);

    // Fire-and-forget — analytics must not block the search response
    logAuthedProductEvent('search_used', {
      surface: 'musicbrainz_albums',
      properties: {
        query_length: query.trim().length,
        result_count: results.length,
      },
    }).catch(() => {});

    if (results.length === 0) {
      logAuthedProductEvent('search_no_results', {
        surface: 'musicbrainz_albums',
        properties: {
          query_length: query.trim().length,
        },
      }).catch(() => {});
    }

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
  // Check cache first — no auth needed (admin client, public MB data)
  const cacheKey = hashCacheKey(query, 'artists');
  const cached = await getCachedResults<ArtistSearchResult[]>(cacheKey);
  if (cached) {
    return { success: true, results: cached.slice(0, limit) };
  }

  try {
    // Build term-by-term query:
    //   - last term: wildcard for prefix ("marvin ga" → artist:ga*)
    //   - all terms: fuzzy ~1 clause as OR fallback ("radiohed" → artist:radiohed~1 finds "Radiohead")
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const luceneParts = terms.map((t, i) => {
      const esc = t.replace(/[+\-&|!(){}\[\]^"~?:\\\/]/g, '\\$&');
      return i === terms.length - 1 ? `artist:${esc}*` : `artist:${esc}`;
    });
    const exactClause = luceneParts.join(' AND ');
    // Fuzzy fallback: each term with edit-distance 1 — catches typos like "radiohed" → "Radiohead"
    const fuzzyParts = terms.map((t) => {
      const esc = t.replace(/[+\-&|!(){}\[\]^"~?:\\\/]/g, '\\$&');
      return `artist:${esc}~1`;
    });
    const fuzzyClause = fuzzyParts.join(' AND ');
    const luceneQuery = `(${exactClause}) OR (${fuzzyClause})`;
    // No retry — fail fast for search, rely on cache/internal if MB is slow
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/artist?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=${limit}`,
      { headers: { 'User-Agent': USER_AGENT } },
      1, MB_SEARCH_TIMEOUT_MS
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

    // Fire-and-forget — analytics must not block the search response
    logAuthedProductEvent('search_used', {
      surface: 'musicbrainz_artists',
      properties: {
        query_length: query.trim().length,
        result_count: results.length,
      },
    }).catch(() => {});

    if (results.length === 0) {
      logAuthedProductEvent('search_no_results', {
        surface: 'musicbrainz_artists',
        properties: {
          query_length: query.trim().length,
        },
      }).catch(() => {});
    }

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
    let rgPrimaryType: string | null = null;

    if (releaseResponse.status === 404) {
      const rgResponse = await fetch(
        `${MUSICBRAINZ_API}/release-group/${encodeURIComponent(mbid)}?inc=releases&fmt=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!rgResponse.ok) {
        return { success: false, error: 'Album not found' };
      }
      const rgData: any = await rgResponse.json();
      rgPrimaryType = rgData['primary-type'] || null;
      const releases: any[] = rgData.releases ?? [];
      if (releases.length === 0) {
        return { success: false, error: 'No releases found for this release group' };
      }
      // Préfère une release "Official" — la première de la liste peut être un promo/bootleg sans tracklist
      const officialRelease = releases.find((r: any) => r.status === 'Official') ?? releases[0];
      const firstReleaseId: string = officialRelease.id;
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

    // Get release-group ID and primary-type for consistent cover lookup and type classification
    const releaseGroupId = (data as any)['release-group']?.id || mbid;
    const primaryType: string | null = rgPrimaryType || (data as any)['release-group']?.['primary-type'] || null;

    // Fetch cover art from CoverArt Archive — uses fetchCoverUrl (2 retries, consistent with refreshAlbumCover)
    const coverUrl = releaseGroupId
      ? await fetchCoverUrl(releaseGroupId, 'release-group', 2).catch(() => null)
      : null;

    return {
      success: true,
      preview: {
        mbid: data.id,
        releaseGroupMbid: releaseGroupId, // canonical identifier — always use this for dedup & storage
        primaryType,
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
          duration: t.length ?? t['track_or_recording_length'] ?? t.recording?.length ?? null,
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

    await logAuthedProductEvent('album_import_started', {
      surface: 'musicbrainz_import',
      properties: {
        mbid,
      },
    });

    const supabase = await createSupabaseServer();
    const supabaseAdmin = createSupabaseAdmin();

    // Fetch preview
    const previewResult = await previewAlbumFromMusicBrainz(mbid);
    if (!previewResult.success) {
      await logAuthedProductEvent('album_import_failed', {
        surface: 'musicbrainz_import',
        properties: {
          mbid,
          reason: previewResult.error ?? 'preview_failed',
        },
      });
      return previewResult;
    }

    const preview = previewResult.preview!;

    const isSingle = preview.tracks.length === 1 || preview.primaryType === 'Single';

    // Always use release-group MBID as canonical identifier.
    // The caller may pass a release MBID or a release-group MBID depending on entry point
    // (search overlay uses release MBID, artist page uses release-group MBID).
    // Normalising here ensures the dedup check and stored mbid are always the same value.
    const canonicalMbid = preview.releaseGroupMbid || mbid;

    // Check if album already imported
    const { data: existingAlbum, error: existingAlbumError } = await supabase
      .from('albums')
      .select('id')
      .eq('mbid', canonicalMbid)
      .limit(1)
      .maybeSingle();

    if (existingAlbumError) {
      await logAuthedProductEvent('album_import_failed', {
        surface: 'musicbrainz_import',
        properties: {
          mbid: canonicalMbid,
          reason: existingAlbumError.message,
        },
      });
      return { success: false, error: existingAlbumError.message };
    }

    if (existingAlbum) {
      if (isSingle) {
        const { data: firstTrack } = await supabase
          .from('tracks')
          .select('id')
          .eq('album_id', existingAlbum.id)
          .order('track_no', { ascending: true })
          .limit(1)
          .maybeSingle();
        const trackId = firstTrack?.id ?? null;
        return {
          success: true,
          albumId: existingAlbum.id,
          redirectUrl: trackId ? `/tracks/${trackId}` : `/albums/${existingAlbum.id}`,
          imported: false,
        };
      }
      return { success: true, albumId: existingAlbum.id, redirectUrl: `/albums/${existingAlbum.id}`, imported: false };
    }

    // Get or create artist
    let artistId: string;
    let createdArtist = false;
    const { data: existingArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('mbid', preview.artistMbid)
      .maybeSingle();

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
        await logAuthedProductEvent('album_import_failed', {
          surface: 'musicbrainz_import',
          properties: {
            mbid: canonicalMbid,
            reason: artistError.message,
          },
        });
        return { success: false, error: artistError.message };
      }
      artistId = newArtistId;
      createdArtist = true;
    }

    // Upload cover to Supabase Storage synchronously so the album is born with a stable URL
    let finalCoverUrl: string | null = preview.coverUrl || null;
    if (preview.coverUrl && canonicalMbid) {
      const storedUrl = await uploadCoverToSupabase(preview.coverUrl, canonicalMbid, supabaseAdmin);
      if (storedUrl) finalCoverUrl = storedUrl;
    }

    // Create album
    const newAlbumId = crypto.randomUUID();
    const { error: albumError } = await (supabase as any)
      .from('albums')
      .insert({
        id: newAlbumId,
        title: preview.title,
        artist_id: artistId,
        mbid: canonicalMbid,
        release_date: normalizeReleaseDate(preview.date),
        cover_url: finalCoverUrl,
        type: preview.primaryType ?? 'Album',
      });

    if (albumError) {
      if (createdArtist) {
        await supabase.from('artists').delete().eq('id', artistId);
      }
      await logAuthedProductEvent('album_import_failed', {
        surface: 'musicbrainz_import',
        properties: {
          mbid: canonicalMbid,
          reason: albumError.message,
        },
      });
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
        await logAuthedProductEvent('album_import_failed', {
          surface: 'musicbrainz_import',
          properties: {
            mbid: canonicalMbid,
            reason: tracksError.message,
          },
        });
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

    // Supprimer les lignes orphelines (album supprimé sans CASCADE sur external_ids)
    await supabaseAdmin
      .from('external_ids')
      .delete()
      .in('value', externalRows.map((r) => r.value));

    const { error: externalError } = await supabaseAdmin
      .from('external_ids')
      .insert(externalRows);
    if (externalError) {
      console.error('[importAlbumFromMusicBrainz] external_ids error:', externalError);
      await rollbackImport();
      await logAuthedProductEvent('album_import_failed', {
        surface: 'musicbrainz_import',
        properties: {
          mbid: canonicalMbid,
          reason: externalError.message,
        },
      });
      return { success: false, error: externalError.message };
    }

    // Enrichit en tâche de fond (tags/bio/streaming) sans bloquer la réponse —
    // after() garantit l'exécution même une fois la réponse renvoyée (Vercel tue
    // sinon les promesses non-attendues dès la fin de la requête). L'EnrichmentPoller
    // sur la page album guettait déjà ce signal, mais rien ne le déclenchait jamais
    // avant — l'album restait "en cours d'enrichissement" jusqu'au cron nocturne.
    after(() => enrichAlbumMetadata(newAlbumId, canonicalMbid, preview.title, preview.artist).catch((err) => {
      console.error('[importAlbumFromMusicBrainz] enrichissement à la volée échoué:', err);
    }));

    const firstTrackId = isSingle ? (trackRows[0]?.id ?? null) : null;
    return {
      success: true,
      albumId: newAlbumId,
      redirectUrl: firstTrackId ? `/tracks/${firstTrackId}` : `/albums/${newAlbumId}`,
      imported: true,
      title: preview.title,
      artist: preview.artist,
      mbid,
    };
  } catch (err) {
    console.error('[importAlbumFromMusicBrainz] catch:', err);
    await logAuthedProductEvent('album_import_failed', {
      surface: 'musicbrainz_import',
      properties: {
        mbid,
        reason: String(err),
      },
    });
    return { success: false, error: String(err) };
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
const _artistReleasesCache = new Map<string, { result: any; expiresAt: number }>();
const ARTIST_RELEASES_TTL_MS = 5 * 60 * 1000; // 5 min

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

  const cached = _artistReleasesCache.get(mbid);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[getArtistReleases] cache hit for mbid="${mbid}"`);
    return cached.result;
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

    const ALLOWED_PRIMARY_TYPES = new Set(['Album', 'EP', 'Single']);
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
    const finalResult = { success: true, releases: result };
    _artistReleasesCache.set(mbid, { result: finalResult, expiresAt: Date.now() + ARTIST_RELEASES_TTL_MS });
    return finalResult;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[getArtistReleases] ✗ exception: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetch artist image from MusicBrainz/Wikidata.
 * This is meant to be called once and cached in DB.
 */
export async function fetchArtistMetadata(mbid: string): Promise<{
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
      return { imageUrl: null, country: null, type: null, name: '' };
    }

    const data: any = await response.json();
    let imageUrl: string | null = null;

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
      imageUrl,
      country: data.country || null,
      type: data.type || null,
      name: data.name || '',
    };
  } catch {
    return { imageUrl: null, country: null, type: null, name: '' };
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
          'User-Agent': 'Waveform/1.0 (https://waveformapp.online)',
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

// ============================================================================
// RECORDING (TRACK) SEARCH & IMPORT
// ============================================================================

export type RecordingSearchResult = {
  mbid: string;          // recording MBID
  title: string;
  artistName: string;
  albumTitle: string;
  albumMbid: string;     // release-group MBID du premier parent
  releaseId: string;     // release MBID (pour import)
  duration: number | null;
  coverUrl: string | null;
  score: number;
};

/**
 * Search MusicBrainz for individual recordings (songs/tracks).
 * Uses the /recording endpoint with Lucene query syntax.
 * Results include parent release info needed for import.
 */
export async function searchMusicBrainzRecordings(
  query: string,
  limit = 20
): Promise<{ success: boolean; results?: RecordingSearchResult[]; error?: string }> {
  if (!query || query.trim().length < 2) {
    return { success: true, results: [] };
  }

  const cacheKey = hashCacheKey(query, `recordings_${limit}`);
  const cached = await getCachedResults<RecordingSearchResult[]>(cacheKey);
  if (cached) return { success: true, results: cached };

  try {
    const trimmed = query.trim().replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, ' ').trim();
    // Phrase with slop-2 for tolerance ("bohemian rhapsodie" finds "Bohemian Rhapsody")
    // OR per-term fallback so partial queries also match
    const terms = trimmed.split(/\s+/).filter(Boolean);
    const phraseClause = `"${trimmed}"~2`;
    const termClause = terms.map((t) => `recording:${t}`).join(' AND ');
    const lucene = terms.length > 1 ? `(${phraseClause}) OR (${termClause})` : phraseClause;
    const encoded = encodeURIComponent(lucene);
    const url = `${MUSICBRAINZ_API}/recording?query=${encoded}&limit=${limit}&fmt=json&inc=releases`;
    const response = await fetchWithRetry(
      url,
      { headers: { 'User-Agent': USER_AGENT } },
      2,
      MB_RECORDING_SEARCH_TIMEOUT_MS
    );

    if (!response.ok) {
      return { success: false, error: `MusicBrainz returned ${response.status}` };
    }

    const data: any = await response.json();
    const recordings: any[] = data.recordings || [];

    const results: RecordingSearchResult[] = recordings
      .filter((r: any) => r.releases && r.releases.length > 0)
      .map((r: any) => {
        const artistName = r['artist-credit']?.[0]?.artist?.name || 'Unknown';
        // Prefer the first non-single release (Albums first, then anything)
        const release = r.releases.find((rel: any) => {
          const pt = rel['release-group']?.['primary-type'];
          return pt === 'Album' || pt === 'EP';
        }) || r.releases[0];
        const rgMbid = release?.['release-group']?.id || '';
        const coverUrl = rgMbid
          ? `https://coverartarchive.org/release-group/${rgMbid}/front`
          : null;
        return {
          mbid: r.id,
          title: r.title,
          artistName,
          albumTitle: release?.title || 'Unknown',
          albumMbid: rgMbid,
          releaseId: release?.id || '',
          duration: r.length ?? null,
          coverUrl,
          score: r.score ?? 0,
        };
      });

    // Deduplicate by (title, artistName) — a single can have multiple versions
    // of the same track (main, instrumental, feat.). Keep the best-scored one.
    const seen = new Set<string>();
    const deduped = results.filter((r) => {
      const key = `${r.title.toLowerCase().trim()}|||${r.artistName.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await setCachedResults(cacheKey, deduped);
    return { success: true, results: deduped };
  } catch (err) {
    console.error('[searchMusicBrainzRecordings] error:', err);
    return { success: false, error: 'Une erreur est survenue lors de la recherche' };
  }
}

/**
 * Import a track from MusicBrainz.
 * - Imports the parent album if not already in DB (via importAlbumFromMusicBrainz)
 * - Returns the internal track ID matched by recording MBID
 *
 * @param recordingMbid - MusicBrainz recording ID of the track
 * @param releaseId     - MusicBrainz release ID of the parent album
 */
export async function importTrackFromMusicBrainz(
  recordingMbid: string,
  releaseId: string,
  trackTitle?: string  // fallback: search by title in album when MBID doesn't match
): Promise<{ success: boolean; trackId?: string; albumId?: string; artistId?: string; title?: string; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const supabase = await createSupabaseServer();

    // Helper: find track by title within an album (case-insensitive)
    const findByTitle = async (albumId: string, title: string) => {
      const { data } = await supabase
        .from('tracks')
        .select('id, title, album_id, artist_id')
        .eq('album_id', albumId)
        .ilike('title', title)
        .maybeSingle();
      return data;
    };

    // 1. Check if the track is already in DB (matched by recording MBID)
    // Note: stored mbid may be the MB track-position ID, not the recording MBID —
    // so we also fall through to the title-based lookup below.
    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('id, title, album_id, artist_id')
      .eq('mbid', recordingMbid)
      .maybeSingle();

    if (existingTrack) {
      return {
        success: true,
        trackId: existingTrack.id,
        albumId: existingTrack.album_id,
        artistId: existingTrack.artist_id,
        title: existingTrack.title,
      };
    }

    // 2. Import the parent album (idempotent — returns existing albumId if already imported)
    const importResult = await importAlbumFromMusicBrainz(releaseId);
    if (!importResult.success || !('albumId' in importResult) || !importResult.albumId) {
      return { success: false, error: ('error' in importResult ? importResult.error : undefined) || 'Échec de l\'import de l\'album parent' };
    }

    const albumId = importResult.albumId;

    // 3a. Try MBID again (in case the album was just imported and now has tracks)
    const { data: importedTrack } = await supabase
      .from('tracks')
      .select('id, title, album_id, artist_id')
      .eq('mbid', recordingMbid)
      .maybeSingle();

    if (importedTrack) {
      return {
        success: true,
        trackId: importedTrack.id,
        albumId: importedTrack.album_id,
        artistId: importedTrack.artist_id,
        title: importedTrack.title,
      };
    }

    // 3b. MBID mismatch (track MBID stored vs recording MBID) — fall back to title search
    if (trackTitle) {
      const byTitle = await findByTitle(albumId, trackTitle);
      if (byTitle) {
        return {
          success: true,
          trackId: byTitle.id,
          albumId: byTitle.album_id,
          artistId: byTitle.artist_id,
          title: byTitle.title,
        };
      }
    }

    return { success: false, error: 'Titre introuvable après import de l\'album' };
  } catch (err) {
    console.error('[importTrackFromMusicBrainz] error:', err);
    return { success: false, error: 'Une erreur est survenue' };
  }
}
