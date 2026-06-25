/**
 * Enrichissement d'un album (genres/tags + bio + liens streaming) — extrait
 * de scripts/enrich-missing.mjs pour être réutilisable depuis n'importe quel
 * script Node autonome (pas de dépendance Next.js : pas de cookies()/getAuthUser()).
 *
 * Utilisé par :
 *   - scripts/enrich-missing.mjs (Phase 1 — passe nocturne sur tout le catalogue)
 *   - scripts/process-external-imports.mjs (enrichissement immédiat à l'import RYM/Last.fm)
 */

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_UA = 'Waveform/1.0 (https://waveformapp.online)';
const LFM_API = 'https://ws.audioscrobbler.com/2.0';
const DELAY_MS = 1250; // safely above MB's 1 req/s limit

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Mirrors the NOISE_TAGS set in app/actions/metadata.ts
const NOISE_TAGS = new Set([
  'seen live', 'loved', 'favorites', 'favourite', 'albums i own', 'favourite albums',
  'personal favourites', 'check in', 'albums', 'music', 'good', 'great', 'awesome',
  'love', 'my music', 'spotify', 'all', 'default', 'amazing', 'beautiful', 'best',
  'classic', 'cool', 'essential', 'excellent', 'perfect', 'aoty', 'worst album ever',
  'cult', 'feel-good', 'romantic', 'lush',
  'france', 'american', 'belgian', 'belgium', 'fr',
  'rhythm and blues', 'rhythm & blues', 'conscious', 'rap fr',
  'radiohead', 'sade', 'stevie wonder', 'buena vista social club',
  'johnny hallyday', 'ennio morricone', 'michael jackson', 'common',
  'mf doom', 'j dilla', 'ofwgkta', 'lauryn hill',
  'lana del rey', 'kanye west', 'kendrick lamar', 'frank ocean', 'jay-z',
  'pharrell williams', 'travis scott', 'post malone', 'drake', 'eminem',
  'rihanna', 'beyonce', 'beyoncé', 'ariana grande', 'billie eilish',
  'tyler the creator', 'chance the rapper', 'j. cole', 'j cole',
  'the weeknd', 'juice wrld', 'xxxtentacion', 'playboi carti', 'asap rocky',
  'a$ap rocky', 'future', 'young thug', 'lil wayne', 'nicki minaj',
  'childish gambino', 'daniel caesar', 'brockhampton', 'earl sweatshirt',
  'solange', 'sza', 'doja cat', 'dua lipa', 'harry styles',
  'bad bunny', 'j balvin', 'rosalia', 'rosalía',
  'daft punk', 'gorillaz', 'arcade fire', 'tame impala',
  'bon iver', 'sufjan stevens', 'lcd soundsystem', 'jay z',
]);

function isValidTag(name) {
  if (name.length < 2 || name.length > 50) return false;
  if (NOISE_TAGS.has(name)) return false;
  if (/^\d{4}s?$/.test(name) || /^\d{2}s$/.test(name)) return false;
  if (name.split(/\s+/).length >= 5) return false;
  return true;
}

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
    if (!links.spotify && url.includes('spotify.com')) links.spotify = url;
    if (!links.appleMusic && url.includes('music.apple.com')) links.appleMusic = url;
    if (!links.deezer && url.includes('deezer.com')) links.deezer = url;
  }
  return links;
}

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

async function upsertGenresAndAlbumGenres(supabase, albumId, tagMap) {
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

/**
 * Enrichit un album (genres/tags + bio Last.fm + liens streaming) et persiste le résultat.
 * Best-effort : ne lève jamais — retourne un résumé même en cas d'échec partiel.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - client service-role
 * @param {{ id: string, mbid: string, title: string, artistName: string }} album
 */
export async function enrichOneAlbum(supabase, { id, mbid, title, artistName }) {
  try {
    const [mbData, lfmData] = await Promise.all([
      fetchMBReleaseGroup(mbid),
      fetchLastFm(artistName, title, mbid),
    ]);

    const tagMap = new Map();
    for (const tag of lfmData.tags) {
      if (isValidTag(tag.name)) tagMap.set(tag.name, { count: tag.count, source: 'lastfm' });
    }
    for (const tag of mbData.tags) {
      if (isValidTag(tag.name) && !tagMap.has(tag.name)) {
        tagMap.set(tag.name, { count: tag.count, source: 'musicbrainz' });
      }
    }

    let streaming = mbData.streamingLinks;
    if (!streaming.spotify || !streaming.appleMusic || !streaming.deezer) {
      const [spot, apl, dz] = await Promise.all([
        streaming.spotify    ? streaming.spotify    : searchSpotify(artistName, title),
        streaming.appleMusic ? streaming.appleMusic : searchAppleMusic(artistName, title),
        streaming.deezer     ? streaming.deezer     : searchDeezer(artistName, title),
      ]);
      streaming = { spotify: spot, appleMusic: apl, deezer: dz };
    }

    const genreCount = await upsertGenresAndAlbumGenres(supabase, id, tagMap);

    await supabase.from('album_metadata').upsert({
      album_id:         id,
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

    return { ok: true, genreCount, streaming };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
