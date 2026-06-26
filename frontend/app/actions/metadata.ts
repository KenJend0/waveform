'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin, createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import { findGenreBySlug } from '@/lib/genre-families';
import {
  arrayValue,
  isRecord,
  logInvalidExternalResponse,
  numberValue,
  recordValue,
  stringOrNumberValue,
  stringValue,
} from '@/lib/externalValidation';

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';
const FETCH_TIMEOUT_MS = 10_000;
const ENRICHMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// ── Streaming search helpers ──────────────────────────────────────────────────

/** Cherche un album sur Apple Music via l'iTunes Search API (gratuit, sans auth). */
async function searchAppleMusic(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${q}&entity=album&limit=10`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const results = parseAppleMusicAlbums(raw);
    // Cherche le meilleur match : artiste + titre similaires
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = results.find(
      (r) =>
        r.collectionType === 'Album' &&
        r.collectionName.toLowerCase().includes(titleLow.slice(0, 6)) &&
        r.artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())
    ) ?? results.find((r) => r.collectionType === 'Album');
    return match?.collectionViewUrl ?? null;
  } catch { return null; }
}

/** Cherche un album sur Deezer via leur API publique (gratuit, sans auth). */
async function searchDeezer(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${q}&limit=5`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const results = parseDeezerAlbums(raw);
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = results.find(
      (r) =>
        r.title.toLowerCase().includes(titleLow.slice(0, 6)) &&
        r.artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase())
    ) ?? results[0];
    return match?.link ?? null;
  } catch { return null; }
}

/** Obtient un token Spotify via Client Credentials (nécessite SPOTIFY_CLIENT_ID + SECRET). */
let _spotifyToken: { token: string; expiresAt: number } | null = null;
async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (_spotifyToken && _spotifyToken.expiresAt > Date.now() + 60_000) return _spotifyToken.token;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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

/** Cherche un album sur Spotify (nécessite SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET). */
async function searchSpotify(artist: string, title: string): Promise<string | null> {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    const q = encodeURIComponent(`album:${title} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const items = parseSpotifyAlbums(raw);
    const titleLow = title.toLowerCase();
    const artistLow = artist.toLowerCase();
    const match = items.find(
      (r) =>
        r.name.toLowerCase().includes(titleLow.slice(0, 6)) &&
        r.artistNames.some((artistName) => artistName.toLowerCase().includes(artistLow.split(' ')[0].toLowerCase()))
    ) ?? items[0];
    return match?.spotifyUrl ?? null;
  } catch { return null; }
}

/**
 * Recherche les liens streaming manquants via les APIs natives des plateformes.
 * Utilisé en fallback quand MusicBrainz url-rels ne retourne rien.
 */
async function searchStreamingLinks(
  artist: string,
  title: string,
  existing: StreamingLinks
): Promise<StreamingLinks> {
  const [spotify, appleMusic, deezer] = await Promise.all([
    existing.spotify ? Promise.resolve(existing.spotify) : searchSpotify(artist, title),
    existing.appleMusic ? Promise.resolve(existing.appleMusic) : searchAppleMusic(artist, title),
    existing.deezer ? Promise.resolve(existing.deezer) : searchDeezer(artist, title),
  ]);
  return { spotify, appleMusic, deezer };
}

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
  // Artistes souvent taguéz sur albums d'autres (featured, similaires)
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
  // Années spécifiques (2025, 1966) et décennies (70s, 80s)
  if (/^\d{4}s?$/.test(name) || /^\d{2}s$/.test(name)) return false;
  // Phrases de 5 mots ou plus — clairement pas un genre musical
  if (name.split(/\s+/).length >= 5) return false;
  return true;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type StreamingLinks = { spotify: string | null; appleMusic: string | null; deezer: string | null };

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

type MBDataResult = {
  tags: Array<{ name: string; count: number }>;
  rgMbid: string | null;
  wikipediaUrl: string | null;
  annotation: string | null;
  streamingLinks: StreamingLinks;
};

interface WikidataSitelinksResponse {
  entities?: Record<string, {
    sitelinks?: Record<string, { site: string; title: string }>;
  }>;
}

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

/**
 * Récupère genres, tags, URL Wikipedia et annotation depuis MusicBrainz.
 * Lookup en 2 étapes : release → release-group MBID (ou direct si release-group MBID).
 */
async function fetchMBData(releaseMbid: string): Promise<MBDataResult> {
  const noLinks: StreamingLinks = { spotify: null, appleMusic: null, deezer: null };
  const empty: MBDataResult = { tags: [], rgMbid: null, wikipediaUrl: null, annotation: null, streamingLinks: noLinks };
  try {
    // Étape 1 : résoudre le release-group MBID + streaming links sur la release.
    // Si le MBID est déjà un release-group (import via browse), /release/ renvoie 404.
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
      rgMbid = releaseMbid; // c'est déjà un release-group MBID
    } else {
      return empty;
    }
    if (!rgMbid) return empty;

    // Respect MB rate limit entre les deux appels
    await new Promise((r) => setTimeout(r, 1100));

    // Étape 2 : release-group avec genres, tags, url-rels, annotation
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

    // URL relations du release-group : Wikipedia + streaming links (fallback si pas trouvé sur la release)
    const relations = data.relations;
    let wikipediaUrl = relations.find((r) => r.type === 'wikipedia')?.url?.resource ?? null;

    // Si pas de lien Wikipedia direct, essaie via Wikidata (même pattern que les artistes)
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
              // Préfère la langue anglaise, sinon prend la première disponible
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

    // Streaming links : release-group url-rels en fallback si la release n'en avait pas
    const rgLinks = extractStreamingLinks(relations);
    let mergedLinks: StreamingLinks = {
      spotify: streamingLinks.spotify ?? rgLinks.spotify,
      appleMusic: streamingLinks.appleMusic ?? rgLinks.appleMusic,
      deezer: streamingLinks.deezer ?? rgLinks.deezer,
    };

    // Si on n'a toujours pas de liens streaming, on browse les releases du release-group.
    // Les liens Spotify/Apple Music/Deezer sont attachés aux releases numériques individuelles,
    // pas au release-group lui-même.
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
            // Arrête dès qu'on a les 3
            if (mergedLinks.spotify && mergedLinks.appleMusic && mergedLinks.deezer) break;
          }
        }
      } catch { /* best-effort */ }
    }

    // Annotation MB (texte libre, parfois une description)
    const annotation = data.annotation;

    return { tags: combined.slice(0, 12), rgMbid, wikipediaUrl, annotation, streamingLinks: mergedLinks };
  } catch {
    return empty;
  }
}

/**
 * Récupère tags + description depuis Last.fm.
 * Essaie d'abord avec le release-group MBID (plus fiable), puis artist+title en fallback.
 * Nécessite LASTFM_API_KEY — retourne vide si absente (graceful degradation).
 */
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
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return empty;

  const base = `${LASTFM_API}/?method=album.getinfo&api_key=${encodeURIComponent(apiKey)}&format=json`;

  // Essaie avec le MBID MB (release-group) en priorité, puis artist+title
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
      const json = parseLastfmAlbumInfo(raw);
      if (!json) continue;
      if (json.album && (Array.isArray(json.album.tags?.tag) || typeof json.album.tags?.tag === 'object')) {
        data = json;
        break;
      }
      // album trouvé mais tags vides — garde en fallback si rien de mieux
      if (json.album && !data) data = json;
    } catch { continue; }
  }

  if (!data?.album) return empty;

    // Last.fm retourne les tags triés par poids (sans score numérique)
    // On inverse le rang pour avoir un poids relatif (1er tag = poids 10)
    const rawTags: Array<{ name: string }> = data.album.tags?.tag ?? [];
    const tags = rawTags.map((t, i) => ({
      name: t.name.toLowerCase().trim(),
      count: Math.max(1, 10 - i),
    }));

    // Nettoyage description : suppression du lien "Read more on Last.fm" et HTML
    // wiki.summary est parfois vide ("") même quand wiki.content existe → fallback
    let description: string | null = null;
    const rawDesc: string | undefined =
      data.album.wiki?.summary || data.album.wiki?.content;
    if (rawDesc) {
      description =
        rawDesc
          .replace(/<a\s[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim() || null;
      if (description && description.length < 30) description = null;
    }

  const listeners = data.album.listeners ? parseInt(data.album.listeners, 10) : null;
  const playcount = data.album.playcount ? parseInt(data.album.playcount, 10) : null;

  return { tags, description, url: data.album.url ?? null, listeners, playcount };
}

/**
 * Récupère et sauvegarde uniquement les liens de streaming d'un album depuis MusicBrainz.
 * N'efface pas les genres/description existants — upsert partiel sur les colonnes URL seulement.
 */
export async function fetchAlbumStreamingLinks(
  albumId: string,
  mbid: string,
  artistName?: string,
  title?: string
): Promise<{ spotify: string | null; appleMusic: string | null; deezer: string | null }> {
  let links: StreamingLinks = { spotify: null, appleMusic: null, deezer: null };

  // Essaie MB uniquement si on a un mbid valide
  if (mbid) {
    const mbData = await fetchMBData(mbid);
    links = mbData.streamingLinks;
  }

  // Fallback/complément : cherche via APIs streaming si liens manquants
  if (artistName && title && (!links.spotify || !links.appleMusic || !links.deezer)) {
    links = await searchStreamingLinks(artistName, title, links);
  }

  // Sauvegarde uniquement si au moins un lien trouvé
  if (links.spotify || links.appleMusic || links.deezer) {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from('album_metadata').upsert(
      {
        album_id: albumId,
        spotify_url: links.spotify,
        apple_music_url: links.appleMusic,
        deezer_url: links.deezer,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'album_id' }
    );
    if (error) {
      console.error('[fetchAlbumStreamingLinks] upsert error:', error.message);
    } else {
      revalidatePath('/admin');
    }
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
 * Enrichit les métadonnées d'un album importé (genres + description).
 * Sources : Last.fm (primaire) + MusicBrainz (secondaire).
 * Idempotent : skip si enrichi il y a moins de 30 jours (sauf force=true).
 * Toutes les erreurs sont silencieuses — ne bloque jamais l'import.
 */
export async function enrichAlbumMetadata(
  albumId: string,
  releaseMbid: string,
  title: string,
  artistName: string,
  force = false
): Promise<EnrichResult> {
  const errors: string[] = [];
  try {
    const supabase = createSupabaseAdmin();

    // Skip si enrichi récemment (sauf force)
    if (!force) {
      const { data: existing } = await supabase
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

    if (!process.env.LASTFM_API_KEY) errors.push('LASTFM_API_KEY manquante');

    // Étape 1 : MB (genres + tags + URLs)
    const mbData = await fetchMBData(releaseMbid);
    const mbTagsResult = mbData.tags;

    // Étape 2 : Last.fm avec rgMbid en priorité (plus fiable que artist+title)
    const lfmResult = await fetchLastFmData(artistName, title, mbData.rgMbid).catch(() => ({
      tags: [], description: null, url: null, listeners: null, playcount: null,
    }));

    // Étape 3 : bio Wikipedia si LFM n'en a pas (même pattern que les artistes)
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

    // Fallback final : annotation MB
    if (!description && mbData.annotation) description = mbData.annotation;

    // Merge : Last.fm en primaire (meilleure classification), MB en secondaire
    const tagMap = new Map<string, { count: number; source: 'lastfm' | 'musicbrainz' }>();
    for (const tag of lfmResult.tags) {
      if (isValidTag(tag.name)) tagMap.set(tag.name, { count: tag.count, source: 'lastfm' });
    }
    for (const tag of mbTagsResult) {
      if (isValidTag(tag.name) && !tagMap.has(tag.name)) {
        tagMap.set(tag.name, { count: tag.count, source: 'musicbrainz' });
      }
    }

    // Batch upsert genres + album_genres (3 DB calls total instead of N*2)
    const rawTags = [...tagMap.entries()]
      .map(([name, { count, source }]) => ({ name, slug: toSlug(name), count, source }))
      .filter((t) => t.slug);

    // Two tag names can produce the same slug (e.g. "hip-hop" vs "hip hop") — deduplicate
    // to avoid PostgreSQL error 21000 ("ON CONFLICT DO UPDATE command cannot affect row a second time")
    const slugMap = new Map<string, typeof rawTags[number]>();
    for (const tag of rawTags) {
      const existing = slugMap.get(tag.slug);
      if (!existing || tag.count > existing.count) slugMap.set(tag.slug, tag);
    }
    const validTags = [...slugMap.values()];

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
          .filter((r): r is { album_id: string; genre_id: string; source: 'lastfm' | 'musicbrainz'; weight: number } => r.genre_id != null);

        if (albumGenreRows.length > 0) {
          await supabase
            .from('album_genres')
            .upsert(albumGenreRows, { onConflict: 'album_id,genre_id' });
        }
      }
    }

    const hasDescription = !!description;

    // Upsert album_metadata — fetched_at uniquement si on a trouvé quelque chose
    const descSrc = description
      ? (lfmResult.description ? 'lastfm' : mbData.wikipediaUrl ? 'wikipedia' : 'musicbrainz')
      : null;
    const metaRow: Record<string, unknown> = {
      album_id: albumId,
      description: description ?? null,
      description_src: descSrc,
      lastfm_url: lfmResult.url ?? null,
      lastfm_listeners: lfmResult.listeners ?? null,
      lastfm_playcount: lfmResult.playcount ?? null,
      spotify_url: mbData.streamingLinks.spotify ?? null,
      apple_music_url: mbData.streamingLinks.appleMusic ?? null,
      deezer_url: mbData.streamingLinks.deezer ?? null,
      fetched_at: new Date().toISOString(), // toujours positionné — signal de fin pour EnrichmentPoller
      tags_checked_at: new Date().toISOString(),
    };

    // tags_checked_at/tag_attempts ne sont pas encore dans les types générés
    // (migration récente, cf. supabase_migration_tag_retry.sql) — cast en any.
    await supabase
      .from('album_metadata')
      .upsert(metaRow as any, { onConflict: 'album_id' });

    return { genres: validTags.length, hasDescription, mbTagsRaw: mbTagsResult.length, lfmTagsRaw: lfmResult.tags.length, errors };
  } catch (err) {
    // Enrichissement best-effort — ne jamais bloquer l'import
    console.error('[enrichAlbumMetadata] error:', err);
    return { genres: 0, hasDescription: false, mbTagsRaw: 0, lfmTagsRaw: 0, errors: [String(err).slice(0, 200)] };
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

// Cache TTL pour les albums similaires (24h)
const SIMILAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCachedSimilarAlbums(albumId: string): Promise<SimilarAlbum[] | null> {
  try {
    const supabase = await createSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('similar_albums_cache')
      .select('similar_albums, computed_at')
      .eq('album_id', albumId)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.computed_at).getTime() > SIMILAR_CACHE_TTL_MS) return null;
    return data.similar_albums as SimilarAlbum[];
  } catch {
    return null;
  }
}

async function setCachedSimilarAlbums(albumId: string, albums: SimilarAlbum[]): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('similar_albums_cache').upsert({
      album_id: albumId,
      similar_albums: albums,
      computed_at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
}

/**
 * Retourne jusqu'à `limit` albums similaires à `albumId` basés sur le
 * chevauchement de genres pondérés (score = somme des produits de poids).
 * Résultat mis en cache 24h dans similar_albums_cache.
 * Retourne [] si l'album n'a pas de genres ou en cas d'erreur.
 */
export async function getSimilarAlbums(
  albumId: string,
  limit = 6
): Promise<SimilarAlbum[]> {
  try {
    // Cache hit → 1 seule requête SQL au lieu de 4
    const cached = await getCachedSimilarAlbums(albumId);
    if (cached !== null) return cached;

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

    // 2. Autres albums partageant ces genres (limité à 500 pour éviter scan complet sur genres populaires)
    const { data: candidates } = await supabase
      .from('album_genres')
      .select('album_id, genre_id, weight')
      .in('genre_id', genreIds)
      .neq('album_id', albumId)
      .limit(500);

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

    const result = rankedIds
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

    // Mise en cache fire-and-forget (n'attend pas, n'impacte pas le render)
    setCachedSimilarAlbums(albumId, result).catch(() => {});

    return result;
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

  // Rate limit : max 3 votes par user par album
  const { count: userVoteCount } = await supabase
    .from('album_genre_votes')
    .select('*', { count: 'exact', head: true })
    .eq('album_id', albumId)
    .eq('user_id', user.id);

  if ((userVoteCount ?? 0) >= 3) {
    throw new Error('Limite de 3 votes par album atteinte');
  }

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
