// Miroir de apps/web/app/actions/metadata.ts — enrichAlbumMetadata + fetchAlbumStreamingLinks
// et leurs dépendances (recherche Spotify/Apple Music/Deezer, MusicBrainz genres/tags/url-rels,
// Last.fm tags/bio, fallback Wikipedia). Toujours en admin (service_role) — mêmes tables que
// le web (album_metadata, genres, album_genres), jamais exposées en écriture directe au client.
//
// Différence volontaire avec le web : ici on APPELLE l'enrichissement complet (liens + tags/
// genres + description) après chaque import, alors que le web ne déclenche que les liens de
// streaming en tâche de fond (les genres/tags passent par un cron nocturne GitHub Actions,
// pour ne pas exploser le quota CPU Vercel — cf. apps/web/app/actions/musicbrainz.ts). Les
// Edge Functions Supabase n'ont pas cette contrainte : le mobile peut se permettre le pipeline
// complet à chaque import.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  arrayValue,
  isRecord,
  logInvalidExternalResponse,
  numberValue,
  recordValue,
  stringValue,
} from './externalValidation.ts';

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';
const FETCH_TIMEOUT_MS = 10_000;
const ENRICHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

type StreamingLinks = { spotify: string | null; appleMusic: string | null; deezer: string | null };

// ── Recherche streaming (fallback si MB url-rels ne retourne rien) ─────────────

function parseAppleMusicAlbums(raw: unknown): Array<{ collectionType: string; artistName: string; collectionName: string; collectionViewUrl: string }> {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('itunes.searchAlbum', 'root is not an object');
    return [];
  }
  return arrayValue(raw.results).flatMap((item) => {
    const row = recordValue(item);
    const collectionType = stringValue(row?.collectionType);
    const artistName = stringValue(row?.artistName);
    const collectionName = stringValue(row?.collectionName);
    const collectionViewUrl = stringValue(row?.collectionViewUrl);
    if (!collectionType || !artistName || !collectionName || !collectionViewUrl) return [];
    return [{ collectionType, artistName, collectionName, collectionViewUrl }];
  });
}

async function searchAppleMusic(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=10`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const results = parseAppleMusicAlbums(raw);
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = results.find(
      (r) => r.collectionType === 'Album'
        && r.collectionName.toLowerCase().includes(titleLow.slice(0, 6))
        && r.artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())
    ) ?? results.find((r) => r.collectionType === 'Album');
    return match?.collectionViewUrl ?? null;
  } catch { return null; }
}

function parseDeezerAlbums(raw: unknown): Array<{ title: string; artistName: string; link: string }> {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('deezer.searchAlbum', 'root is not an object');
    return [];
  }
  return arrayValue(raw.data).flatMap((item) => {
    const row = recordValue(item);
    const artist = recordValue(row?.artist);
    const title = stringValue(row?.title);
    const artistName = stringValue(artist?.name);
    const link = stringValue(row?.link);
    if (!title || !artistName || !link) return [];
    return [{ title, artistName, link }];
  });
}

async function searchDeezer(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
    const res = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=5`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const results = parseDeezerAlbums(raw);
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = results.find(
      (r) => r.title.toLowerCase().includes(titleLow.slice(0, 6))
        && r.artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())
    ) ?? results[0];
    return match?.link ?? null;
  } catch { return null; }
}

function parseSpotifyToken(raw: unknown): { token: string; expiresIn: number } | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('spotify.token', 'root is not an object');
    return null;
  }
  const token = stringValue(raw.access_token);
  const expiresIn = numberValue(raw.expires_in);
  if (!token || !expiresIn) {
    logInvalidExternalResponse('spotify.token', 'missing token fields');
    return null;
  }
  return { token, expiresIn };
}

function parseSpotifyAlbums(raw: unknown): Array<{ name: string; artistNames: string[]; spotifyUrl: string }> {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('spotify.searchAlbum', 'root is not an object');
    return [];
  }
  return arrayValue(recordValue(raw.albums)?.items).flatMap((item) => {
    const row = recordValue(item);
    const externalUrls = recordValue(row?.external_urls);
    const name = stringValue(row?.name);
    const spotifyUrl = stringValue(externalUrls?.spotify);
    const artistNames = arrayValue(row?.artists).flatMap((artist) => {
      const artistName = stringValue(recordValue(artist)?.name);
      return artistName ? [artistName] : [];
    });
    if (!name || !spotifyUrl || artistNames.length === 0) return [];
    return [{ name, artistNames, spotifyUrl }];
  });
}

let _spotifyToken: { token: string; expiresAt: number } | null = null;
async function getSpotifyToken(): Promise<string | null> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  if (_spotifyToken && _spotifyToken.expiresAt > Date.now() + 60_000) return _spotifyToken.token;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = parseSpotifyToken(raw);
    if (!parsed) return null;
    _spotifyToken = { token: parsed.token, expiresAt: Date.now() + parsed.expiresIn * 1000 };
    return _spotifyToken.token;
  } catch { return null; }
}

async function searchSpotify(artist: string, title: string): Promise<string | null> {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const q = encodeURIComponent(`album:${title} artist:${artist}`);
    const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=album&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const items = parseSpotifyAlbums(raw);
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = items.find(
      (r) => r.name.toLowerCase().includes(titleLow.slice(0, 6))
        && r.artistNames.some((artistName) => artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()))
    ) ?? items[0];
    return match?.spotifyUrl ?? null;
  } catch { return null; }
}

async function searchStreamingLinks(artist: string, title: string, existing: StreamingLinks): Promise<StreamingLinks> {
  const [spotify, appleMusic, deezer] = await Promise.all([
    existing.spotify ? Promise.resolve(existing.spotify) : searchSpotify(artist, title),
    existing.appleMusic ? Promise.resolve(existing.appleMusic) : searchAppleMusic(artist, title),
    existing.deezer ? Promise.resolve(existing.deezer) : searchDeezer(artist, title),
  ]);
  return { spotify, appleMusic, deezer };
}

// ── Tags / genres ────────────────────────────────────────────────────────────

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
  'bon iver', 'sufjan stevens', 'lcd soundsystem',
  'jay z',
]);

function isValidTag(name: string): boolean {
  if (name.length < 2 || name.length > 50) return false;
  if (NOISE_TAGS.has(name)) return false;
  if (/^\d{4}s?$/.test(name) || /^\d{2}s$/.test(name)) return false;
  if (name.split(/\s+/).length >= 5) return false;
  return true;
}

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── MusicBrainz (genres + tags + url-rels + annotation) ─────────────────────

type MBDataResult = {
  tags: Array<{ name: string; count: number }>;
  rgMbid: string | null;
  wikipediaUrl: string | null;
  annotation: string | null;
  streamingLinks: StreamingLinks;
};

type ExternalTag = { name: string; count: number };
type ExternalRelation = { type: string; url?: { resource: string } };

function parseExternalRelations(value: unknown): ExternalRelation[] {
  return arrayValue(value).flatMap((item) => {
    const row = recordValue(item);
    const url = recordValue(row?.url);
    const type = stringValue(row?.type);
    const resource = stringValue(url?.resource);
    if (!type) return [];
    return [{ type, ...(resource ? { url: { resource } } : {}) }];
  });
}

function parseMbReleaseLookup(raw: unknown): { releaseGroupId: string | null; relations: ExternalRelation[] } | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('musicbrainz.releaseLookup', 'root is not an object');
    return null;
  }
  const releaseGroup = recordValue(raw['release-group']);
  return {
    releaseGroupId: stringValue(releaseGroup?.id),
    relations: parseExternalRelations(raw.relations),
  };
}

function parseExternalTags(value: unknown, minCount: number): ExternalTag[] {
  return arrayValue(value).flatMap((item) => {
    const row = recordValue(item);
    const name = stringValue(row?.name)?.toLowerCase().trim() ?? '';
    const count = numberValue(row?.count) ?? 1;
    if (!name || count < minCount) return [];
    return [{ name, count }];
  });
}

function parseMbReleaseGroupEnrichment(raw: unknown): {
  genres: ExternalTag[];
  tags: ExternalTag[];
  relations: ExternalRelation[];
  annotation: string | null;
} | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('musicbrainz.releaseGroupEnrichment', 'root is not an object');
    return null;
  }
  const annotation = stringValue(raw.annotation)?.trim() ?? null;
  return {
    genres: parseExternalTags(raw.genres, 0),
    tags: parseExternalTags(raw.tags, 3),
    relations: parseExternalRelations(raw.relations),
    annotation: annotation && annotation.length > 30 ? annotation : null,
  };
}

function parseWikidataSitelinks(raw: unknown, entityId: string): Array<{ site: string; title: string }> {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('wikidata.sitelinks', 'root is not an object');
    return [];
  }
  const entity = recordValue(recordValue(raw.entities)?.[entityId]);
  const sitelinks = recordValue(entity?.sitelinks);
  if (!sitelinks) return [];
  return Object.values(sitelinks).flatMap((value) => {
    const row = recordValue(value);
    const site = stringValue(row?.site);
    const title = stringValue(row?.title);
    if (!site || !title) return [];
    return [{ site, title }];
  });
}

function parseMbReleaseBrowseRelations(raw: unknown): Array<{ relations: ExternalRelation[] }> {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('musicbrainz.releaseBrowseRelations', 'root is not an object');
    return [];
  }
  return arrayValue(raw.releases).map((item) => ({
    relations: parseExternalRelations(recordValue(item)?.relations),
  }));
}

function extractStreamingLinks(relations: Array<{ url?: { resource: string } }>): StreamingLinks {
  const links: StreamingLinks = { spotify: null, appleMusic: null, deezer: null };
  for (const rel of relations) {
    const url = rel.url?.resource;
    if (!url) continue;
    if (!links.spotify && url.includes('spotify.com')) links.spotify = url;
    if (!links.appleMusic && url.includes('music.apple.com')) links.appleMusic = url;
    if (!links.deezer && url.includes('deezer.com')) links.deezer = url;
  }
  return links;
}

async function fetchMBData(releaseMbid: string): Promise<MBDataResult> {
  const noLinks: StreamingLinks = { spotify: null, appleMusic: null, deezer: null };
  const empty: MBDataResult = { tags: [], rgMbid: null, wikipediaUrl: null, annotation: null, streamingLinks: noLinks };
  try {
    let rgMbid: string | undefined;
    let streamingLinks: StreamingLinks = noLinks;
    const releaseRes = await fetch(
      `${MB_API}/release/${encodeURIComponent(releaseMbid)}?fmt=json&inc=release-groups+url-rels`,
      { headers: { 'User-Agent': MB_USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (releaseRes.ok) {
      const raw: unknown = await releaseRes.json();
      const releaseData = parseMbReleaseLookup(raw);
      if (!releaseData) return empty;
      rgMbid = releaseData.releaseGroupId ?? undefined;
      streamingLinks = extractStreamingLinks(releaseData.relations);
    } else if (releaseRes.status === 404) {
      rgMbid = releaseMbid;
    } else {
      return empty;
    }
    if (!rgMbid) return empty;

    await new Promise((r) => setTimeout(r, 1100));

    const res = await fetch(
      `${MB_API}/release-group/${encodeURIComponent(rgMbid)}?fmt=json&inc=genres+tags+url-rels+annotation`,
      { headers: { 'User-Agent': MB_USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    if (!res.ok) return { ...empty, rgMbid, streamingLinks };
    const raw: unknown = await res.json();
    const data = parseMbReleaseGroupEnrichment(raw);
    if (!data) return { ...empty, rgMbid, streamingLinks };

    const genres = data.genres;
    const tags = data.tags;

    const seen = new Set(genres.map((g) => g.name));
    const combined = [...genres];
    for (const tag of tags) {
      if (!seen.has(tag.name)) { combined.push(tag); seen.add(tag.name); }
    }

    const relations = data.relations;
    let wikipediaUrl = relations.find((r) => r.type === 'wikipedia')?.url?.resource ?? null;

    if (!wikipediaUrl) {
      const wikidataUrl = relations.find((r) => r.type === 'wikidata')?.url?.resource ?? null;
      if (wikidataUrl) {
        try {
          const wikidataId = wikidataUrl.split('/').pop();
          if (wikidataId) {
            const wdRes = await fetch(
              `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`,
              { headers: { 'User-Agent': MB_USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
            );
            if (wdRes.ok) {
              const rawWd: unknown = await wdRes.json();
              const sitelinks = parseWikidataSitelinks(rawWd, wikidataId);
              const wikiLink = sitelinks.find((s) => s.site === 'enwiki')
                ?? sitelinks.find((s) => s.site === 'frwiki')
                ?? sitelinks.find((s) => s.site.endsWith('wiki') && !s.site.endsWith('wikiquote'));
              if (wikiLink) {
                const lang = wikiLink.site.replace('wiki', '');
                wikipediaUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(wikiLink.title.replace(/ /g, '_'))}`;
              }
            }
          }
        } catch { /* best-effort */ }
      }
    }

    const rgLinks = extractStreamingLinks(relations);
    let mergedLinks: StreamingLinks = {
      spotify: streamingLinks.spotify ?? rgLinks.spotify,
      appleMusic: streamingLinks.appleMusic ?? rgLinks.appleMusic,
      deezer: streamingLinks.deezer ?? rgLinks.deezer,
    };

    const needsReleaseBrowse = !mergedLinks.spotify && !mergedLinks.appleMusic && !mergedLinks.deezer;
    if (needsReleaseBrowse) {
      try {
        await new Promise((r) => setTimeout(r, 1100));
        const releasesRes = await fetch(
          `${MB_API}/release?release-group=${encodeURIComponent(rgMbid)}&fmt=json&inc=url-rels&limit=25`,
          { headers: { 'User-Agent': MB_USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
        );
        if (releasesRes.ok) {
          const rawReleases: unknown = await releasesRes.json();
          const releases = parseMbReleaseBrowseRelations(rawReleases);
          for (const release of releases) {
            const releaseLinks = extractStreamingLinks(release.relations ?? []);
            mergedLinks = {
              spotify: mergedLinks.spotify ?? releaseLinks.spotify,
              appleMusic: mergedLinks.appleMusic ?? releaseLinks.appleMusic,
              deezer: mergedLinks.deezer ?? releaseLinks.deezer,
            };
            if (mergedLinks.spotify && mergedLinks.appleMusic && mergedLinks.deezer) break;
          }
        }
      } catch { /* best-effort */ }
    }

    const annotation = data.annotation;

    return { tags: combined.slice(0, 12), rgMbid, wikipediaUrl, annotation, streamingLinks: mergedLinks };
  } catch {
    return empty;
  }
}

// ── Last.fm (tags + bio) ─────────────────────────────────────────────────────

interface LastfmAlbumInfoResponse {
  album?: {
    tags?: { tag?: Array<{ name: string }> };
    wiki?: { summary?: string; content?: string };
    listeners?: string;
    playcount?: string;
    url?: string;
  };
}

function parseLastfmAlbumInfo(raw: unknown): LastfmAlbumInfoResponse | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('lastfm.albumInfo', 'root is not an object');
    return null;
  }
  const album = recordValue(raw.album);
  if (!album) return null;

  const tags = arrayValue(recordValue(album.tags)?.tag).flatMap((item) => {
    const name = stringValue(recordValue(item)?.name);
    return name ? [{ name }] : [];
  });
  const wiki = recordValue(album.wiki);

  return {
    album: {
      tags: { tag: tags },
      wiki: {
        summary: stringValue(wiki?.summary) ?? undefined,
        content: stringValue(wiki?.content) ?? undefined,
      },
      listeners: stringValue(album.listeners) ?? undefined,
      playcount: stringValue(album.playcount) ?? undefined,
      url: stringValue(album.url) ?? undefined,
    },
  };
}

function parseWikipediaSummary(raw: unknown): string | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('wikipedia.summary', 'root is not an object');
    return null;
  }
  const extract = stringValue(raw.extract)?.trim() ?? '';
  return extract.length > 30 ? extract : null;
}

async function fetchLastFmData(
  artistName: string,
  title: string,
  rgMbid?: string | null
): Promise<{
  tags: Array<{ name: string; count: number }>;
  description: string | null;
  url: string | null;
  listeners: number | null;
  playcount: number | null;
}> {
  const empty = { tags: [], description: null, url: null, listeners: null, playcount: null };
  const apiKey = Deno.env.get('LASTFM_API_KEY');
  if (!apiKey) return empty;

  const base = `${LASTFM_API}/?method=album.getinfo&api_key=${encodeURIComponent(apiKey)}&format=json`;
  const urls = [
    ...(rgMbid ? [`${base}&mbid=${encodeURIComponent(rgMbid)}`] : []),
    `${base}&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(title)}&autocorrect=1`,
  ];

  let data: LastfmAlbumInfoResponse | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const raw: unknown = await res.json();
      const parsed = parseLastfmAlbumInfo(raw);
      if (!parsed) continue;
      if (parsed.album && (Array.isArray(parsed.album.tags?.tag) || typeof parsed.album.tags?.tag === 'object')) {
        data = parsed;
        break;
      }
      if (parsed.album && !data) data = parsed;
    } catch { continue; }
  }

  if (!data?.album) return empty;

  const rawTags: Array<{ name: string }> = data.album.tags?.tag ?? [];
  const tags = rawTags.map((t, i) => ({ name: t.name.toLowerCase().trim(), count: Math.max(1, 10 - i) }));

  let description: string | null = null;
  const rawDesc: string | undefined = data.album.wiki?.summary || data.album.wiki?.content;
  if (rawDesc) {
    description = rawDesc
      .replace(/<a\s[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim() || null;
    if (description && description.length < 30) description = null;
  }

  const listeners = data.album.listeners ? parseInt(data.album.listeners, 10) : null;
  const playcount = data.album.playcount ? parseInt(data.album.playcount, 10) : null;

  return { tags, description, url: data.album.url ?? null, listeners, playcount };
}

// ── Fonctions exportées ──────────────────────────────────────────────────────

/** Récupère et sauvegarde uniquement les liens de streaming (upsert partiel, colonnes URL). */
export async function fetchAlbumStreamingLinks(
  supabaseAdmin: SupabaseClient,
  albumId: string,
  mbid: string,
  artistName?: string,
  title?: string
): Promise<StreamingLinks> {
  let links: StreamingLinks = { spotify: null, appleMusic: null, deezer: null };

  if (mbid) {
    const mbData = await fetchMBData(mbid);
    links = mbData.streamingLinks;
  }

  if (artistName && title && (!links.spotify || !links.appleMusic || !links.deezer)) {
    links = await searchStreamingLinks(artistName, title, links);
  }

  if (links.spotify || links.appleMusic || links.deezer) {
    const { error } = await supabaseAdmin.from('album_metadata').upsert(
      {
        album_id: albumId,
        spotify_url: links.spotify,
        apple_music_url: links.appleMusic,
        deezer_url: links.deezer,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'album_id' }
    );
    if (error) console.error('[fetchAlbumStreamingLinks] upsert error:', error.message);
  }

  return links;
}

export type EnrichResult = {
  genres: number;
  hasDescription: boolean;
  mbTagsRaw: number;
  lfmTagsRaw: number;
  errors: string[];
};

/**
 * Enrichit un album importé : genres/tags + description + liens streaming.
 * Sources : Last.fm (primaire) + MusicBrainz (secondaire) + Wikipedia (fallback bio).
 * Idempotent : skip si enrichi il y a moins de 30 jours (sauf force=true).
 * Best-effort : toute erreur est silencieuse, ne bloque jamais l'import.
 */
export async function enrichAlbumMetadata(
  supabaseAdmin: SupabaseClient,
  albumId: string,
  releaseMbid: string,
  title: string,
  artistName: string,
  force = false
): Promise<EnrichResult> {
  const errors: string[] = [];
  try {
    if (!force) {
      const { data: existing } = await supabaseAdmin
        .from('album_metadata')
        .select('fetched_at')
        .eq('album_id', albumId)
        .maybeSingle();

      if (existing?.fetched_at) {
        const ageMs = Date.now() - new Date(existing.fetched_at).getTime();
        if (ageMs < ENRICHMENT_TTL_MS) {
          return { genres: 0, hasDescription: false, mbTagsRaw: 0, lfmTagsRaw: 0, errors: ['skipped: TTL'] };
        }
      }
    }

    if (!Deno.env.get('LASTFM_API_KEY')) errors.push('LASTFM_API_KEY manquante');

    const mbData = await fetchMBData(releaseMbid);
    const mbTagsResult = mbData.tags;

    const lfmResult = await fetchLastFmData(artistName, title, mbData.rgMbid).catch(() => ({
      tags: [], description: null, url: null, listeners: null, playcount: null,
    }));

    let description = lfmResult.description;
    if (!description && mbData.wikipediaUrl) {
      try {
        const urlObj = new URL(mbData.wikipediaUrl);
        const lang = urlObj.hostname.split('.')[0];
        const pageName = urlObj.pathname.split('/wiki/').pop();
        if (pageName) {
          const wikiRes = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(pageName))}`,
            { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
          );
          if (wikiRes.ok) {
            const rawWiki: unknown = await wikiRes.json();
            description = parseWikipediaSummary(rawWiki) ?? description;
          }
        }
      } catch { /* best-effort */ }
    }

    if (!description && mbData.annotation) description = mbData.annotation;

    const tagMap = new Map<string, { count: number; source: 'lastfm' | 'musicbrainz' }>();
    for (const tag of lfmResult.tags) {
      if (isValidTag(tag.name)) tagMap.set(tag.name, { count: tag.count, source: 'lastfm' });
    }
    for (const tag of mbTagsResult) {
      if (isValidTag(tag.name) && !tagMap.has(tag.name)) {
        tagMap.set(tag.name, { count: tag.count, source: 'musicbrainz' });
      }
    }

    const rawTags = [...tagMap.entries()]
      .map(([name, { count, source }]) => ({ name, slug: toSlug(name), count, source }))
      .filter((t) => t.slug);

    const slugMap = new Map<string, typeof rawTags[number]>();
    for (const tag of rawTags) {
      const existing = slugMap.get(tag.slug);
      if (!existing || tag.count > existing.count) slugMap.set(tag.slug, tag);
    }
    const validTags = [...slugMap.values()];

    if (validTags.length > 0) {
      await supabaseAdmin
        .from('genres')
        .upsert(validTags.map((t) => ({ name: t.name, slug: t.slug })), { onConflict: 'slug' });

      const { data: genreRows } = await supabaseAdmin
        .from('genres')
        .select('id, slug')
        .in('slug', validTags.map((t) => t.slug));

      if (genreRows && genreRows.length > 0) {
        const slugToId = new Map(genreRows.map((g) => [g.slug, g.id]));
        const albumGenreRows = validTags
          .map((t) => ({ album_id: albumId, genre_id: slugToId.get(t.slug), source: t.source, weight: t.count }))
          .filter((r): r is { album_id: string; genre_id: string; source: 'lastfm' | 'musicbrainz'; weight: number } => r.genre_id != null);

        if (albumGenreRows.length > 0) {
          await supabaseAdmin.from('album_genres').upsert(albumGenreRows, { onConflict: 'album_id,genre_id' });
        }
      }
    }

    const hasDescription = !!description;
    const descSrc = description
      ? (lfmResult.description ? 'lastfm' : mbData.wikipediaUrl ? 'wikipedia' : 'musicbrainz')
      : null;

    const metaRow = {
      album_id: albumId,
      description: description ?? null,
      description_src: descSrc,
      lastfm_url: lfmResult.url ?? null,
      lastfm_listeners: lfmResult.listeners ?? null,
      lastfm_playcount: lfmResult.playcount ?? null,
      spotify_url: mbData.streamingLinks.spotify ?? null,
      apple_music_url: mbData.streamingLinks.appleMusic ?? null,
      deezer_url: mbData.streamingLinks.deezer ?? null,
      fetched_at: new Date().toISOString(),
      tags_checked_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('album_metadata').upsert(metaRow, { onConflict: 'album_id' });

    return { genres: validTags.length, hasDescription, mbTagsRaw: mbTagsResult.length, lfmTagsRaw: lfmResult.tags.length, errors };
  } catch (err) {
    console.error('[enrichAlbumMetadata] error:', err);
    return { genres: 0, hasDescription: false, mbTagsRaw: 0, lfmTagsRaw: 0, errors: [String(err).slice(0, 200)] };
  }
}
