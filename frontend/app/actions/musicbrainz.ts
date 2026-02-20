'use server';

import { getAuthUser, createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import type { SearchResultUI } from './search';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveform.app)';

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
    'life-span'?: { begin?: string; end?: string };
  }>;
}

interface MBReleaseDetail {
  id: string;
  title: string;
  date?: string;
  'artist-credit': Array<{ artist: { id: string; name: string } }>;
  media: Array<{
    tracks: Array<{
      id: string;
      title: string;
      position: number;
      'track_or_recording_length'?: number;
    }>;
  }>;
}

export type AlbumSearchResult = {
  id: string; // MBID
  title: string;
  artistName: string;
  releaseDate?: string;
  coverUrl?: string;
  hasCover: boolean;
};

export type ArtistSearchResult = {
  id: string; // MBID
  name: string;
  type?: string;
  country?: string;
};

export type SearchFilter = 'all' | 'albums' | 'artists';

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
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(url, { 
        ...options,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries - 1) {
        console.error(`[fetchWithRetry] Failed after ${maxRetries} attempts for ${url.split('?')[0]}: ${errorMsg}`);
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
 * Search MusicBrainz for albums - direct implementation
 * Ported from backend for single source of truth
 * 
 * Cover strategy:
 * - Only test covers for top 6 results (avoid rate limiting)
 * - Use release-group ID (more consistent than release)
 * - Frontend handles fallback gracefully
 */
export async function searchMusicBrainzAlbums(query: string, limit = 30): Promise<{ success: boolean; results?: AlbumSearchResult[]; error?: string }> {
  try {
    // Direct query to MusicBrainz - single source, no double calls
    const mbUrl = new URL('https://musicbrainz.org/ws/2/release');
    mbUrl.searchParams.set('query', query);
    mbUrl.searchParams.set('limit', Math.min(limit * 2, 50).toString()); // Fetch more to account for filtering
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
    const releases = data.releases || [];

    if (releases.length === 0) {
      return { success: true, results: [] };
    }

    // Group by release-group to deduplicate (same album in different formats)
    const releaseGroupMap = new Map<string, any>();
    
    for (const release of releases) {
      const rgId = release['release-group']?.id;
      if (!rgId) continue;
      
      // Keep the first (best) release for each group
      if (!releaseGroupMap.has(rgId)) {
        releaseGroupMap.set(rgId, release);
      }
    }

    // Get deduplicated list and exclude release-groups that are Singles
    const uniqueAlbums = Array.from(releaseGroupMap.values())
      .filter((release) => {
        const primaryType = release['release-group']?.['primary-type'];
        // Keep only Album or EP types (exclude Single and other types)
        return primaryType === 'Album' || primaryType === 'EP';
      })
      .slice(0, limit);

    // Fetch covers for top 8 results only (not all 30) to avoid rate limiting and slow responses
    const coverLimit = Math.min(8, uniqueAlbums.length);
    const coverPromises = uniqueAlbums.slice(0, coverLimit).map(release =>
      fetchCoverUrl(release['release-group'].id)
    );
    const coverUrls = await Promise.all(coverPromises);

    // Transform to our format
    const results: AlbumSearchResult[] = uniqueAlbums.map((release: any, index: number) => {
      const artists = release['artist-credit'] || [];
      const artistName = artists.map((a: any) => a.name || a.artist?.name).join(', ');
      const rgId = release['release-group'].id;
      // Only first 8 have covers fetched
      const coverUrl = index < coverLimit ? coverUrls[index] : null;
      
      return {
        id: release.id,
        title: release.title,
        artistName: artistName || 'Unknown',
        releaseDate: release.date,
        // Use actual cover URL if found, otherwise undefined
        coverUrl: coverUrl || undefined,
        hasCover: !!coverUrl,
      };
    });

    return { success: true, results };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[searchMusicBrainzAlbums]', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Search MusicBrainz for artists - direct implementation
 * Ported from backend for single source of truth
 */
export async function searchMusicBrainzArtists(query: string, limit = 30): Promise<{ success: boolean; results?: ArtistSearchResult[]; error?: string }> {
  try {
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
      {
        headers: { 'User-Agent': USER_AGENT },
      }
    );

    if (!response.ok) {
      return { success: false, error: 'MusicBrainz artist search failed' };
    }

    const data: MBArtistSearchResult = await response.json();
    const results: ArtistSearchResult[] = (data.artists || [])
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        country: a.country,
      }));

    return { success: true, results };
  } catch (err) {
    return { success: false, error: String(err) };
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
    const response = await fetch(
      `${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+release-groups&fmt=json`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      return { success: false, error: 'Album not found' };
    }

    const data: MBReleaseDetail = await response.json();

    const artistCredit = data['artist-credit']?.[0];
    const artist = artistCredit?.artist || { id: '', name: 'Unknown' };

    const tracks = data.media?.[0]?.tracks || [];

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
          duration: t.track_or_recording_length || null,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
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

    return { success: true, albumId: newAlbumId, imported: true };
  } catch (err) {
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
      
      // Keep the first (best) release for each group
      if (!releaseGroupMap.has(rgId)) {
        releaseGroupMap.set(rgId, release);
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
    return { success: false, error: String(err) };
  }
}

/**
 * Lightweight: fetch artist releases from MusicBrainz WITHOUT covers.
 * Returns just the release list (1 API call, no CoverArt Archive).
 * Covers are handled client-side via direct CoverArt Archive URLs.
 */
export async function getArtistReleases(mbid: string): Promise<{
  success: boolean;
  releases?: Array<{ mbid: string; releaseGroupMbid: string; title: string; date: string | null; type: string | null }>;
  error?: string;
}> {
  try {
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/release?query=arid:${encodeURIComponent(mbid)}&limit=100&fmt=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) {
      return { success: true, releases: [] };
    }

    const data: any = await response.json();
    const releases = data.releases || [];

    // Deduplicate by release-group
    const rgMap = new Map<string, any>();
    for (const r of releases) {
      const rgId = r['release-group']?.id;
      if (rgId && !rgMap.has(rgId)) {
        rgMap.set(rgId, r);
      }
    }

    const result = Array.from(rgMap.values())
      .filter(r => {
        const type = r['release-group']?.['primary-type'];
        return type === 'Album' || type === 'EP';
      })
      .map(r => ({
        mbid: r.id,
        releaseGroupMbid: r['release-group']?.id || r.id,
        title: r.title,
        date: r.date || null,
        type: r['release-group']?.['primary-type'] || null,
      }))
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

    return { success: true, releases: result };
  } catch (err) {
    return { success: false, error: String(err) };
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
    const response = await fetchWithRetry(
      `${MUSICBRAINZ_API}/artist/${encodeURIComponent(mbid)}?fmt=json&inc=url-rels`,
      { headers: { 'User-Agent': USER_AGENT } }
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
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(pageName))}`
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
            `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`
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

export async function searchMusicBrainzPreview(query: string): Promise<SearchResultUI[]> {
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
