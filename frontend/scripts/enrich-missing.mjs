/**
 * Daily enrichment — fills missing covers, tags/genres, and streaming links.
 *
 * Phase 1 — Full enrichment: albums without an album_metadata row.
 *   Sources: MusicBrainz release-group (genres, tags, streaming url-rels)
 *            + Last.fm album.getinfo (tags, description, playcount)
 *            + iTunes / Deezer / Spotify search as streaming fallback.
 *
 * Phase 2 — Streaming retry: albums enriched > 7 days ago with all 3 links still null.
 *   Sources: iTunes Search API (free) + Deezer API (free) + Spotify (if creds set).
 *
 * Phase 3 — Cover enrichment: albums with cover_url IS NULL.
 *   Source: CoverArt Archive (release-group) → uploaded to Supabase Storage.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-missing.mjs
 *   node --env-file=.env.local scripts/enrich-missing.mjs --dry-run
 *   node --env-file=.env.local scripts/enrich-missing.mjs --limit 10
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
 *   SUPABASE_SERVICE_KEY       — Service-role key (bypasses RLS)
 *
 * Optional env vars (graceful degradation if absent):
 *   LASTFM_API_KEY             — Last.fm API key (tags + descriptions)
 *   SPOTIFY_CLIENT_ID          — Spotify app client ID
 *   SPOTIFY_CLIENT_SECRET      — Spotify app client secret
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ─────────────────────────────────────────────────────────────────────

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_UA  = 'Waveform/1.0 (https://waveformapp.online)';
const LFM_API = 'https://ws.audioscrobbler.com/2.0';
const CAA_URL = 'https://coverartarchive.org/release-group';
const DELAY_MS = 1250; // safely above MB's 1 req/s limit
const STREAMING_RETRY_DAYS = 7;

const DRY_RUN      = process.argv.includes('--dry-run');
const PHASE4_ONLY  = process.argv.includes('--phase4-only');
const limitArg     = process.argv.indexOf('--limit');
const LIMIT        = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// ── Supabase client (service-role, bypasses RLS) ───────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// ── Generic helpers ────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Supabase PostgREST caps responses at 1000 rows by default regardless of .limit().
 * This helper paginates through all rows using .range() to bypass that cap.
 */
async function fetchAllPages(buildQuery) {
  const PAGE = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1);
    if (error) throw error;
    if (data?.length) rows.push(...data);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Mirrors the NOISE_TAGS set in metadata.ts
const NOISE_TAGS = new Set([
  'seen live','loved','favorites','favourite','albums i own','favourite albums',
  'personal favourites','check in','albums','music','good','great','awesome',
  'love','my music','spotify','all','default','amazing','beautiful','best',
  'classic','cool','essential','excellent','perfect','aoty','worst album ever',
  'cult','feel-good','romantic','lush',
  'france','american','belgian','belgium','fr',
  'rhythm and blues','rhythm & blues','conscious','rap fr',
  'radiohead','sade','stevie wonder','buena vista social club',
  'johnny hallyday','ennio morricone','michael jackson','common',
  'mf doom','j dilla','ofwgkta','lauryn hill',
  'lana del rey','kanye west','kendrick lamar','frank ocean','jay-z',
  'pharrell williams','travis scott','post malone','drake','eminem',
  'rihanna','beyonce','beyoncé','ariana grande','billie eilish',
  'tyler the creator','chance the rapper','j. cole','j cole',
  'the weeknd','juice wrld','xxxtentacion','playboi carti','asap rocky',
  'a$ap rocky','future','young thug','lil wayne','nicki minaj',
  'childish gambino','daniel caesar','brockhampton','earl sweatshirt',
  'solange','sza','doja cat','dua lipa','harry styles',
  'bad bunny','j balvin','rosalia','rosalía',
  'daft punk','gorillaz','arcade fire','tame impala',
  'bon iver','sufjan stevens','lcd soundsystem','jay z',
]);

function isValidTag(name) {
  if (name.length < 2 || name.length > 50) return false;
  if (NOISE_TAGS.has(name)) return false;
  if (/^\d{4}s?$/.test(name) || /^\d{2}s$/.test(name)) return false;
  if (name.split(/\s+/).length >= 5) return false;
  return true;
}

// ── MusicBrainz helpers ────────────────────────────────────────────────────────

async function mbFetch(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await delay((attempt + 2) * 2000);
      return mbFetch(url, attempt + 1);
    }
    return res;
  } catch (err) {
    if (attempt < 2) { await delay(2000); return mbFetch(url, attempt + 1); }
    throw err;
  }
}

function extractStreamingLinks(relations = []) {
  const links = { spotify: null, appleMusic: null, deezer: null };
  for (const rel of relations) {
    const url = rel.url?.resource;
    if (!url) continue;
    if (!links.spotify && url.includes('spotify.com'))    links.spotify = url;
    if (!links.appleMusic && url.includes('music.apple.com')) links.appleMusic = url;
    if (!links.deezer && url.includes('deezer.com'))      links.deezer = url;
  }
  return links;
}

/**
 * Fetches genres, tags, streaming url-rels, and annotation from a release-group.
 * albums.mbid is always a release-group MBID, so we go straight to the RG endpoint.
 * If streaming links are not on the RG, browse the first 25 releases as fallback.
 */
async function fetchMBReleaseGroup(rgMbid) {
  const empty = { tags: [], streamingLinks: { spotify: null, appleMusic: null, deezer: null } };
  try {
    const res = await mbFetch(
      `${MB_API}/release-group/${encodeURIComponent(rgMbid)}?fmt=json&inc=genres+tags+url-rels+annotation`,
    );
    if (!res.ok) return empty;
    const data = await res.json();

    const genres = (data.genres ?? []).map((g) => ({ name: g.name.toLowerCase().trim(), count: g.count ?? 1 }));
    const tags = (data.tags ?? [])
      .filter((t) => (t.count ?? 0) >= 3)
      .map((t) => ({ name: t.name.toLowerCase().trim(), count: t.count }));

    const seen = new Set(genres.map((g) => g.name));
    const combined = [...genres];
    for (const t of tags) {
      if (!seen.has(t.name)) { combined.push(t); seen.add(t.name); }
    }

    let links = extractStreamingLinks(data.relations ?? []);

    // Browse releases for streaming links when the RG url-rels are empty
    if (!links.spotify && !links.appleMusic && !links.deezer) {
      try {
        await delay(DELAY_MS);
        const rRes = await mbFetch(
          `${MB_API}/release?release-group=${encodeURIComponent(rgMbid)}&fmt=json&inc=url-rels&limit=25`,
        );
        if (rRes.ok) {
          const rData = await rRes.json();
          for (const release of rData.releases ?? []) {
            const rLinks = extractStreamingLinks(release.relations ?? []);
            links = {
              spotify:    links.spotify    ?? rLinks.spotify,
              appleMusic: links.appleMusic ?? rLinks.appleMusic,
              deezer:     links.deezer     ?? rLinks.deezer,
            };
            if (links.spotify && links.appleMusic && links.deezer) break;
          }
        }
      } catch { /* best-effort */ }
    }

    return { tags: combined.slice(0, 12), streamingLinks: links };
  } catch {
    return empty;
  }
}

// ── Last.fm ────────────────────────────────────────────────────────────────────

async function fetchLastFm(artistName, title, rgMbid) {
  const empty = { tags: [], description: null, url: null, listeners: null, playcount: null };
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return empty;

  const base = `${LFM_API}/?method=album.getinfo&api_key=${encodeURIComponent(apiKey)}&format=json`;
  const urls = [
    ...(rgMbid ? [`${base}&mbid=${encodeURIComponent(rgMbid)}`] : []),
    `${base}&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(title)}&autocorrect=1`,
  ];

  let data = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.album && (Array.isArray(json.album.tags?.tag) || typeof json.album.tags?.tag === 'object')) {
        data = json; break;
      }
      if (json.album && !data) data = json;
    } catch { continue; }
  }

  if (!data?.album) return empty;

  const rawTagsRaw = data.album.tags?.tag ?? [];
  const rawTags = Array.isArray(rawTagsRaw) ? rawTagsRaw : (rawTagsRaw ? [rawTagsRaw] : []);
  const tags = rawTags.map((t, i) => ({
    name: t.name.toLowerCase().trim(),
    count: Math.max(1, 10 - i),
  }));

  let description = null;
  const rawDesc = data.album.wiki?.summary || data.album.wiki?.content;
  if (rawDesc) {
    description = rawDesc
      .replace(/<a\s[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim() || null;
    if (description && description.length < 30) description = null;
  }

  return {
    tags,
    description,
    url: data.album.url ?? null,
    listeners: data.album.listeners ? parseInt(data.album.listeners, 10) : null,
    playcount: data.album.playcount ? parseInt(data.album.playcount, 10) : null,
  };
}

// ── Streaming search (fallback when MB has no url-rels) ────────────────────────

async function searchAppleMusic(artist, title) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${q}&entity=album&limit=10`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results ?? [];
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match =
      results.find(
        (r) =>
          r.collectionType === 'Album' &&
          r.collectionName.toLowerCase().includes(titleLow.slice(0, 6)) &&
          r.artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()),
      ) ?? results.find((r) => r.collectionType === 'Album');
    return match?.collectionViewUrl ?? null;
  } catch { return null; }
}

async function searchDeezer(artist, title) {
  try {
    const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${q}&limit=5`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.data ?? [];
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match =
      results.find(
        (r) =>
          r.title.toLowerCase().includes(titleLow.slice(0, 6)) &&
          r.artist.name.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()),
      ) ?? results[0];
    return match?.link ?? null;
  } catch { return null; }
}

let _spotifyToken = null;
async function getSpotifyToken() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) return null;
  if (_spotifyToken && _spotifyToken.expiresAt > Date.now() + 60_000) return _spotifyToken.token;
  try {
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
    ).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _spotifyToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return _spotifyToken.token;
  } catch { return null; }
}

async function searchSpotify(artist, title) {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const q = encodeURIComponent(`album:${title} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.albums?.items ?? [];
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match =
      items.find(
        (r) =>
          r.name.toLowerCase().includes(titleLow.slice(0, 6)) &&
          r.artists.some((a) => a.name.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())),
      ) ?? items[0];
    return match?.external_urls?.spotify ?? null;
  } catch { return null; }
}

// ── Track-level streaming search ──────────────────────────────────────────────
// Distinct from the album variants: different endpoints, query syntax, and response fields.

async function searchSpotifyTrack(artist, title) {
  const token = await getSpotifyToken();
  if (!token) return null;
  const titleLow = title.toLowerCase();
  const artistLow = artist.toLowerCase();
  const queries = [
    encodeURIComponent(`track:"${title}" artist:"${artist}"`),
    encodeURIComponent(`${title} ${artist}`),
  ];
  for (const q of queries) {
    let attempt = 0;
    while (attempt < 3) {
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${q}&type=track&limit=10`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
        );
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') ?? '10', 10);
          console.warn(`      ⏳ Spotify rate limit — attente ${retryAfter}s`);
          await delay(retryAfter * 1000);
          attempt++;
          continue;
        }
        if (!res.ok) break;
        const data = await res.json();
        const items = data.tracks?.items ?? [];
        const match = items.find(
          (r) =>
            r.name.toLowerCase().includes(titleLow.slice(0, 6)) &&
            r.artists.some((a) => a.name.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())),
        );
        if (match) return match.external_urls?.spotify ?? null;
        break;
      } catch { break; }
    }
  }
  return null;
}

function titleMatches(candidate, target) {
  // Normalize both sides: lowercase, strip quotes/punctuation noise, collapse spaces
  const norm = (s) => s.toLowerCase().replace(/[''`"]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const c = norm(candidate);
  const t = norm(target);
  return c === t || c.startsWith(t) || t.startsWith(c) || c.includes(t) || t.includes(c);
}

async function searchAppleMusicTrack(artist, title) {
  const artistLow = artist.toLowerCase();
  const terms = [
    encodeURIComponent(`${artist} ${title}`),
    encodeURIComponent(title),
  ];
  for (const term of terms) {
    let attempt = 0;
    while (attempt < 3) {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${term}&entity=song&limit=15`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (res.status === 429) {
          console.warn(`      ⏳ Apple Music rate limit — attente 10s`);
          await delay(10_000);
          attempt++;
          continue;
        }
        if (!res.ok) break;
        const data = await res.json();
        const results = (data.results ?? []).filter((r) => r.wrapperType === 'track');
        // 1st pass: title + artist match
        const withArtist = results.find(
          (r) =>
            titleMatches(r.trackName ?? '', title) &&
            r.artistName?.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()),
        );
        if (withArtist) return withArtist.trackViewUrl ?? null;
        // 2nd pass: title only (artist search already constrains the query)
        const titleOnly = results.find((r) => titleMatches(r.trackName ?? '', title));
        if (titleOnly) return titleOnly.trackViewUrl ?? null;
        break;
      } catch { break; }
    }
  }
  return null;
}

async function searchDeezerTrack(artist, title) {
  try {
    const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
    const res = await fetch(
      `https://api.deezer.com/search/track?q=${q}&limit=10`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.data ?? [];
    const artistLow = artist.toLowerCase();
    // 1st pass: title + artist match
    const withArtist = results.find(
      (r) =>
        titleMatches(r.title ?? '', title) &&
        r.artist.name.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()),
    );
    if (withArtist) return withArtist.link ?? null;
    // 2nd pass: title only
    const titleOnly = results.find((r) => titleMatches(r.title ?? '', title));
    return titleOnly?.link ?? null;
  } catch { return null; }
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

async function upsertGenresAndAlbumGenres(albumId, tagMap) {
  const validTags = [...tagMap.entries()]
    .map(([name, { count, source }]) => ({ name, slug: toSlug(name), count, source }))
    .filter((t) => t.slug);
  if (!validTags.length) return 0;

  await supabase
    .from('genres')
    .upsert(validTags.map((t) => ({ name: t.name, slug: t.slug })), { onConflict: 'slug' });

  const { data: genreRows } = await supabase
    .from('genres')
    .select('id, slug')
    .in('slug', validTags.map((t) => t.slug));

  if (!genreRows?.length) return 0;

  const slugToId = new Map(genreRows.map((g) => [g.slug, g.id]));
  const albumGenreRows = validTags
    .map((t) => ({ album_id: albumId, genre_id: slugToId.get(t.slug), source: t.source, weight: t.count }))
    .filter((r) => r.genre_id != null);

  if (albumGenreRows.length) {
    await supabase
      .from('album_genres')
      .upsert(albumGenreRows, { onConflict: 'album_id,genre_id' });
  }
  return albumGenreRows.length;
}

// ── Phase 1: Full enrichment ───────────────────────────────────────────────────

async function runPhase1() {
  console.log('── Phase 1 : enrichissement complet (tags + streaming) ──────────');

  // Albums without any album_metadata row
  const { data: albums, error } = await supabase
    .from('albums')
    .select('id, mbid, title, artists(name)')
    .not('mbid', 'is', null)
    .limit(10_000);

  if (error) { console.error('  ❌ Query error:', error.message); return; }

  // Filter to albums that truly have no album_metadata row
  const { data: existingMeta } = await supabase
    .from('album_metadata')
    .select('album_id, fetched_at')
    .not('fetched_at', 'is', null);

  const enrichedIds = new Set((existingMeta ?? []).map((m) => m.album_id));
  const toEnrich = (albums ?? [])
    .filter((a) => !enrichedIds.has(a.id))
    .slice(0, LIMIT);

  if (!toEnrich.length) {
    console.log('  ✅ Aucun album à enrichir.\n');
    return;
  }
  console.log(`  ${toEnrich.length} album(s) à enrichir.\n`);

  let done = 0, skipped = 0;

  for (const album of toEnrich) {
    const artistName = album.artists?.name ?? '';
    console.log(`  [${done + skipped + 1}/${toEnrich.length}] ${album.title} — ${artistName} (${album.mbid})`);

    try {
      await delay(DELAY_MS);
      const [mbData, lfmData] = await Promise.all([
        fetchMBReleaseGroup(album.mbid),
        fetchLastFm(artistName, album.title, album.mbid),
      ]);

      // Merge tags: Last.fm first (higher priority), MB to fill gaps
      const tagMap = new Map();
      for (const tag of lfmData.tags) {
        if (isValidTag(tag.name)) tagMap.set(tag.name, { count: tag.count, source: 'lastfm' });
      }
      for (const tag of mbData.tags) {
        if (isValidTag(tag.name) && !tagMap.has(tag.name)) {
          tagMap.set(tag.name, { count: tag.count, source: 'musicbrainz' });
        }
      }

      // Streaming: MB url-rels first, then fallback search APIs
      let streaming = mbData.streamingLinks;
      if (!streaming.spotify || !streaming.appleMusic || !streaming.deezer) {
        const [spot, apl, dz] = await Promise.all([
          streaming.spotify    ? streaming.spotify    : searchSpotify(artistName, album.title),
          streaming.appleMusic ? streaming.appleMusic : searchAppleMusic(artistName, album.title),
          streaming.deezer     ? streaming.deezer     : searchDeezer(artistName, album.title),
        ]);
        streaming = { spotify: spot, appleMusic: apl, deezer: dz };
      }

      const genreCount = DRY_RUN ? tagMap.size : await upsertGenresAndAlbumGenres(album.id, tagMap);

      if (!DRY_RUN) {
        await supabase.from('album_metadata').upsert({
          album_id:         album.id,
          description:      lfmData.description ?? null,
          description_src:  lfmData.description ? 'lastfm' : null,
          lastfm_url:       lfmData.url ?? null,
          lastfm_listeners: lfmData.listeners ?? null,
          lastfm_playcount: lfmData.playcount ?? null,
          spotify_url:      streaming.spotify ?? null,
          apple_music_url:  streaming.appleMusic ?? null,
          deezer_url:       streaming.deezer ?? null,
          fetched_at:       new Date().toISOString(),
        }, { onConflict: 'album_id' });
      }

      const linkSummary = [
        streaming.spotify    ? '🎵 Spotify'     : null,
        streaming.appleMusic ? '🍎 Apple Music' : null,
        streaming.deezer     ? '🎶 Deezer'      : null,
      ].filter(Boolean).join(', ') || '— aucun lien';

      console.log(`    ✅ ${genreCount} genre(s) · ${linkSummary}${DRY_RUN ? ' [dry-run]' : ''}`);
      done++;
    } catch (err) {
      console.error(`    ❌ Erreur: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n  Phase 1 terminée — ${done} enrichi(s), ${skipped} ignoré(s).\n`);
}

// ── Phase 2: Streaming link retry ─────────────────────────────────────────────

async function runPhase2() {
  console.log('── Phase 2 : retry liens de streaming ──────────────────────────');

  const cutoff = new Date(Date.now() - STREAMING_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Albums enriched but with at least one streaming link still null + fetched_at older than N days
  const { data: rows, error } = await supabase
    .from('album_metadata')
    .select('album_id, spotify_url, apple_music_url, deezer_url, albums(id, mbid, title, artists(name))')
    .or('spotify_url.is.null,apple_music_url.is.null,deezer_url.is.null')
    .not('fetched_at', 'is', null)
    .lt('fetched_at', cutoff)
    .limit(LIMIT === Infinity ? 10_000 : LIMIT);

  if (error) { console.error('  ❌ Query error:', error.message); return; }

  const toRetry = (rows ?? []).filter((r) => r.albums?.mbid);

  if (!toRetry.length) {
    console.log('  ✅ Aucun album à retenter.\n');
    return;
  }
  console.log(`  ${toRetry.length} album(s) à retenter.\n`);

  let found = 0, empty = 0;

  for (const row of toRetry) {
    const album = row.albums;
    const artistName = album.artists?.name ?? '';
    console.log(`  ${album.title} — ${artistName}`);

    try {
      const [spot, apl, dz] = await Promise.all([
        row.spotify_url     ? Promise.resolve(row.spotify_url)     : searchSpotify(artistName, album.title),
        row.apple_music_url ? Promise.resolve(row.apple_music_url) : searchAppleMusic(artistName, album.title),
        row.deezer_url      ? Promise.resolve(row.deezer_url)      : searchDeezer(artistName, album.title),
      ]);

      // Only patch columns that were actually null
      const patch = { fetched_at: new Date().toISOString() };
      if (!row.spotify_url)     patch.spotify_url     = spot ?? null;
      if (!row.apple_music_url) patch.apple_music_url = apl  ?? null;
      if (!row.deezer_url)      patch.deezer_url      = dz   ?? null;

      const hasNew = (!row.spotify_url && spot) || (!row.apple_music_url && apl) || (!row.deezer_url && dz);
      if (!DRY_RUN) {
        await supabase.from('album_metadata').update(patch).eq('album_id', row.album_id);
      }

      if (hasNew) {
        const newLinks = [
          !row.spotify_url     && spot ? '🎵 Spotify'     : null,
          !row.apple_music_url && apl  ? '🍎 Apple Music' : null,
          !row.deezer_url      && dz   ? '🎶 Deezer'      : null,
        ].filter(Boolean).join(', ');
        console.log(`    ✅ Ajouté: ${newLinks}${DRY_RUN ? ' [dry-run]' : ''}`);
        found++;
      } else {
        console.log(`    — aucun nouveau lien trouvé${DRY_RUN ? ' [dry-run]' : ''}`);
        empty++;
      }
    } catch (err) {
      console.error(`    ❌ Erreur: ${err.message}`);
    }
  }

  console.log(`\n  Phase 2 terminée — ${found} lien(s) trouvé(s), ${empty} toujours vides.\n`);
}

// ── Phase 3: Cover enrichment ─────────────────────────────────────────────────

async function runPhase3() {
  console.log('── Phase 3 : covers manquantes ─────────────────────────────────');

  const { data: albums, error } = await supabase
    .from('albums')
    .select('id, mbid, title')
    .is('cover_url', null)
    .not('mbid', 'is', null)
    .limit(LIMIT === Infinity ? 10_000 : LIMIT);

  if (error) { console.error('  ❌ Query error:', error.message); return; }

  if (!albums?.length) {
    console.log('  ✅ Aucune cover manquante.\n');
    return;
  }
  console.log(`  ${albums.length} album(s) sans cover.\n`);

  let done = 0, missing = 0;

  for (const album of albums) {
    console.log(`  ${album.title} (${album.mbid})`);
    try {
      const coverRes = await fetch(`${CAA_URL}/${album.mbid}/front`, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!coverRes.ok) {
        console.log(`    — CoverArt Archive: ${coverRes.status}`);
        missing++;
        continue;
      }

      if (!DRY_RUN) {
        const buffer = Buffer.from(await coverRes.arrayBuffer());
        const filename = `${album.mbid}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('covers')
          .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

        if (uploadErr) {
          console.error(`    ❌ Upload error: ${uploadErr.message}`);
          missing++;
          continue;
        }

        const { data: urlData } = supabase.storage.from('covers').getPublicUrl(filename);
        await supabase.from('albums').update({ cover_url: urlData.publicUrl }).eq('id', album.id);
        console.log(`    ✅ Cover uploadée`);
      } else {
        console.log(`    ✅ Cover disponible [dry-run]`);
      }
      done++;
    } catch (err) {
      console.error(`    ❌ Erreur: ${err.message}`);
      missing++;
    }
  }

  console.log(`\n  Phase 3 terminée — ${done} cover(s) ajoutée(s), ${missing} introuvable(s).\n`);
}

// ── Phase 4: Track streaming links ────────────────────────────────────────────
// Spotify: 1 call per album via /v1/albums/{id}/tracks (position-based match).
//   Per-track Spotify search is banned — causes extreme rate limiting (63000s retry-after).
// Apple Music + Deezer: per-track search (more lenient rate limits).

async function searchSpotifyAlbumId(artist, title, token, attempt = 0) {
  if (!token) return null;
  try {
    const q = encodeURIComponent(`album:"${title}" artist:"${artist}"`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 429 && attempt < 2) {
      const wait = Math.min(parseInt(res.headers.get('retry-after') ?? '10', 10), 30);
      await delay(wait * 1000);
      return searchSpotifyAlbumId(artist, title, token, attempt + 1);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.albums?.items ?? [];
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = items.find(
      (r) =>
        r.name.toLowerCase().includes(titleLow.slice(0, 6)) &&
        r.artists.some((a) => a.name.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())),
    ) ?? items[0];
    const url = match?.external_urls?.spotify;
    return url?.match(/album\/([A-Za-z0-9]+)/)?.[1] ?? null;
  } catch { return null; }
}

async function fetchSpotifyAlbumTracks(spotifyAlbumId, token) {
  // Returns { byPosition: Map<"disc-trackNo", url>, byTitle: Map<normalizedTitle, url> }
  const byPosition = new Map();
  const byTitle    = new Map();
  if (!spotifyAlbumId || !token) return { byPosition, byTitle };
  try {
    let nextUrl = `https://api.spotify.com/v1/albums/${spotifyAlbumId}/tracks?limit=50`;
    let pages   = 0;
    while (nextUrl && pages < 10) {
      const currentUrl = nextUrl;
      let retries = 0;
      let res;
      while (retries < 3) {
        res = await fetch(currentUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        });
        if (res.status === 429) {
          const wait = Math.min(parseInt(res.headers.get('retry-after') ?? '10', 10), 30);
          console.warn(`    ⏳ Spotify rate limit — attente ${wait}s`);
          await delay(wait * 1000);
          retries++;
          continue;
        }
        break;
      }
      if (!res.ok) break;
      const data = await res.json();
      for (const t of data.items ?? []) {
        const trackUrl = t.external_urls?.spotify ?? null;
        byPosition.set(`${t.disc_number ?? 1}-${t.track_number}`, trackUrl);
        const norm = t.name.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, ' ').trim();
        byTitle.set(norm, trackUrl);
      }
      nextUrl = data.next ?? null;
      pages++;
    }
  } catch { /* best-effort */ }
  return { byPosition, byTitle };
}

async function runPhase4() {
  console.log('── Phase 4 : liens de streaming par titre ──────────────────────');

  let allTracks, existingMeta, albumMetas;
  try {
    [allTracks, existingMeta, albumMetas] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase.from('tracks')
          .select('id, title, album_id, track_no, disc_no, albums(title, artists(name))')
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from('track_metadata').select('track_id').range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from('album_metadata')
          .select('album_id, spotify_url')
          .not('spotify_url', 'is', null)
          .range(from, to)
      ),
    ]);
  } catch (error) {
    console.error('  ❌ Query error:', error.message);
    return;
  }

  // album_id → Spotify album ID (extracted from album URL)
  const spotifyAlbumIdByAlbum = new Map();
  for (const m of albumMetas ?? []) {
    const match = m.spotify_url?.match(/album\/([A-Za-z0-9]+)/);
    if (match) spotifyAlbumIdByAlbum.set(m.album_id, match[1]);
  }

  const enrichedIds = new Set((existingMeta ?? []).map((m) => m.track_id));
  const toEnrich = (allTracks ?? [])
    .filter((t) => !enrichedIds.has(t.id))
    .slice(0, LIMIT === Infinity ? 50_000 : LIMIT);

  if (!toEnrich.length) {
    console.log('  ✅ Aucun titre à enrichir.\n');
    return;
  }
  console.log(`  ${toEnrich.length} titre(s) à enrichir.\n`);

  // Group by album
  const byAlbum = new Map();
  for (const track of toEnrich) {
    if (!byAlbum.has(track.album_id)) {
      byAlbum.set(track.album_id, {
        artistName: track.albums?.artists?.name ?? '',
        albumTitle:  track.albums?.title ?? '',
        tracks: [],
      });
    }
    byAlbum.get(track.album_id).tracks.push(track);
  }

  const spotifyToken = await getSpotifyToken();
  let done = 0, skipped = 0, albumIdx = 0;

  for (const [albumId, { artistName, albumTitle, tracks }] of byAlbum) {
    console.log(`  Album [${++albumIdx}/${byAlbum.size}] — ${artistName} (${tracks.length} titre(s))`);

    // Fetch all Spotify track URLs for this album in one API call.
    // If the album has no cached Spotify URL, search for it first (1 call).
    let spotifyAlbumId = spotifyAlbumIdByAlbum.get(albumId);
    if (!spotifyAlbumId && spotifyToken) {
      spotifyAlbumId = await searchSpotifyAlbumId(artistName, albumTitle, spotifyToken);
      await delay(200);
    }
    const spotifyTrackMap = await fetchSpotifyAlbumTracks(spotifyAlbumId, spotifyToken);
    if (spotifyAlbumId) await delay(200); // gentle pause between Spotify album calls

    for (const track of tracks) {
      console.log(`    → ${track.title}`);
      try {
        // Spotify: title-based lookup first (covers NULL track_no), position as fallback
        const normTitle = track.title.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, ' ').trim();
        const posKey    = `${track.disc_no ?? 1}-${track.track_no}`;
        const spot = spotifyTrackMap.byTitle.get(normTitle)
          ?? spotifyTrackMap.byPosition.get(posKey)
          ?? null;

        // Apple Music + Deezer: per-track search
        await delay(110);
        const [apl, dz] = await Promise.all([
          searchAppleMusicTrack(artistName, track.title),
          searchDeezerTrack(artistName, track.title),
        ]);

        if (!DRY_RUN) {
          await supabase.from('track_metadata').upsert({
            track_id:        track.id,
            spotify_url:     spot ?? null,
            apple_music_url: apl  ?? null,
            deezer_url:      dz   ?? null,
            fetched_at:      new Date().toISOString(),
          }, { onConflict: 'track_id' });
        }

        const linkSummary = [
          spot ? '🎵 Spotify'     : null,
          apl  ? '🍎 Apple Music' : null,
          dz   ? '🎶 Deezer'      : null,
        ].filter(Boolean).join(', ') || '— aucun lien';
        console.log(`      ✅ ${linkSummary}${DRY_RUN ? ' [dry-run]' : ''}`);
        done++;
      } catch (err) {
        console.error(`      ❌ Erreur: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log(`\n  Phase 4 terminée — ${done} enrichi(s), ${skipped} ignoré(s).\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis.');
    process.exit(1);
  }

  console.log('🎵 Waveform — Enrichissement');
  if (DRY_RUN)     console.log('   Mode dry-run activé — aucune écriture en BDD.');
  if (PHASE4_ONLY) console.log('   Mode phase4-only — backfill liens streaming par titre.');
  if (LIMIT !== Infinity) console.log(`   Limite : ${LIMIT} élément(s) par phase.`);
  console.log('');

  const warnings = [];
  if (!process.env.LASTFM_API_KEY)         warnings.push('LASTFM_API_KEY absente — descriptions et tags Last.fm désactivés');
  if (!process.env.SPOTIFY_CLIENT_ID)      warnings.push('SPOTIFY_CLIENT_ID absente — Spotify désactivé');
  if (!process.env.SPOTIFY_CLIENT_SECRET)  warnings.push('SPOTIFY_CLIENT_SECRET absente — Spotify désactivé');
  if (warnings.length) {
    for (const w of warnings) console.warn(`  ⚠️  ${w}`);
    console.log('');
  }

  if (PHASE4_ONLY) {
    await runPhase4();
  } else {
    await runPhase1();
    await runPhase2();
    await runPhase3();
    // Phase 4 (track streaming links) runs via backfill-track-streaming.yml (6h timeout).
    // Once the initial backfill is complete, re-enable it here — daily cost will be minimal.
  }

  console.log('✅  Enrichissement terminé.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
