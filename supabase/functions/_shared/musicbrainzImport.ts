// Miroir de apps/web/app/actions/musicbrainz.ts — uniquement les fonctions d'IMPORT
// (previewAlbumFromMusicBrainz, importAlbumFromMusicBrainz, importArtistFromMusicBrainz,
// importTrackFromMusicBrainz + leurs helpers). La recherche est déjà portée côté mobile
// dans apps/mobile/lib/musicbrainz.ts — ce fichier ne la duplique pas.
//
// Différences volontaires avec le web :
// - Pas de logAuthedProductEvent (analytics) — hors scope de ce portage.
// - Pas de `after()` (Next.js) — le déclenchement de l'enrichissement en tâche de fond se
//   fait via `EdgeRuntime.waitUntil` dans supabase/functions/import-musicbrainz/index.ts.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  arrayValue,
  isRecord,
  logInvalidExternalResponse,
  numberValue,
  recordValue,
  stringValue,
} from './externalValidation.ts';
import { canonicalAlbumKey } from './albumCanonical.ts';
import { canonicalTrackTitle } from './trackCanonical.ts';
import { isAcceptableReleaseGroup, pickBestRelease, releaseSelectionMode } from './musicbrainzReleasePolicy.ts';
import { uploadCoverToSupabase } from './storage.ts';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';

function normalizeReleaseDate(date?: string | null): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  if (!trimmed) return null;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

type MBArtistCredit = { artist: { id: string; name: string }; name?: string; joinphrase?: string };

interface MBRelease {
  id: string;
  title: string;
  'artist-credit': MBArtistCredit[];
  date?: string;
  'release-group'?: { id: string; 'primary-type'?: string };
}

interface MBReleaseGroupLookupDetail {
  id: string;
  'primary-type'?: string;
  releases?: Array<{ id: string; status?: string; trackCount: number }>;
}

interface MBReleaseDetail {
  id: string;
  title: string;
  date?: string;
  'artist-credit': MBArtistCredit[];
  'release-group'?: { id: string; 'primary-type'?: string };
  media: Array<{
    position: number;
    tracks: Array<{
      id: string;
      title: string;
      position: number;
      length?: number;
      'track_or_recording_length'?: number;
      recording?: { length?: number };
      'artist-credit': MBArtistCredit[];
    }>;
  }>;
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  timeoutMs = 8000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if ((response.status === 503 || response.status === 429) && attempt < maxRetries - 1) {
        const backoff = Math.max(1100, 100 * Math.pow(2, attempt));
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const backoff = 100 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function fetchCoverUrl(
  mbid: string,
  entityType: 'release-group' | 'release' = 'release-group',
  maxRetries = 2
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      // front-1200 (pas /front) : évite les scans pleine résolution qui dépassent la
      // limite de 5 Mo du bucket Supabase Storage "covers".
      const coverArchiveUrl = `https://coverartarchive.org/${entityType}/${encodeURIComponent(mbid)}/front-1200`;
      const coverResponse = await fetch(coverArchiveUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if ([307, 301, 302].includes(coverResponse.status)) {
        const location = coverResponse.headers.get('location');
        if (location) return location;
      } else if (coverResponse.ok) {
        return coverResponse.url;
      }
    } catch {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
        continue;
      }
    }
  }
  return null;
}

function parseArtistCredit(value: unknown): MBArtistCredit[] {
  return arrayValue(value).flatMap((item) => {
    const row = recordValue(item);
    const artist = recordValue(row?.artist);
    const id = stringValue(artist?.id);
    const artistName = stringValue(artist?.name);
    if (!id || !artistName) return [];
    const creditName = stringValue(row?.name);
    const joinphrase = stringValue(row?.joinphrase);
    return [{
      artist: { id, name: artistName },
      ...(creditName ? { name: creditName } : {}),
      ...(joinphrase ? { joinphrase } : {}),
    }];
  });
}

/** Artistes crédités au-delà du principal (index 0), chacun avec le joinphrase qui le précède. */
function featuredArtistsFromCredit(
  credits: MBArtistCredit[]
): Array<{ mbid: string; name: string; joinphrase: string | null }> {
  return credits.slice(1).map((credit, i) => ({
    mbid: credit.artist.id,
    name: credit.artist.name,
    joinphrase: credits[i].joinphrase ?? null,
  }));
}

function parseMbReleaseGroupLookup(raw: unknown): MBReleaseGroupLookupDetail | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('musicbrainz.releaseGroupLookup', 'root is not an object');
    return null;
  }
  const id = stringValue(raw.id);
  if (!id) return null;
  return {
    id,
    'primary-type': stringValue(raw['primary-type']) ?? undefined,
    releases: arrayValue(raw.releases).flatMap((item) => {
      const row = recordValue(item);
      const releaseId = stringValue(row?.id);
      if (!releaseId) return [];
      const trackCount = arrayValue(row?.media).reduce((sum: number, m) => {
        const medium = recordValue(m);
        return sum + (numberValue(medium?.['track-count']) ?? 0);
      }, 0);
      return [{ id: releaseId, status: stringValue(row?.status) ?? undefined, trackCount }];
    }),
  };
}

function parseMbReleaseDetail(raw: unknown): MBReleaseDetail | null {
  if (!isRecord(raw)) {
    logInvalidExternalResponse('musicbrainz.releaseDetail', 'root is not an object');
    return null;
  }
  const id = stringValue(raw.id);
  const title = stringValue(raw.title);
  if (!id || !title) return null;
  const releaseGroup = recordValue(raw['release-group']);
  return {
    id,
    title,
    date: stringValue(raw.date) ?? undefined,
    'artist-credit': parseArtistCredit(raw['artist-credit']),
    'release-group': releaseGroup ? {
      id: stringValue(releaseGroup.id) ?? '',
      'primary-type': stringValue(releaseGroup['primary-type']) ?? undefined,
    } : undefined,
    media: arrayValue(raw.media).map((medium, mediumIndex) => {
      const row = recordValue(medium);
      return {
        position: numberValue(row?.position) ?? mediumIndex + 1,
        tracks: arrayValue(row?.tracks).flatMap((track, trackIndex) => {
          const t = recordValue(track);
          const trackId = stringValue(t?.id);
          const trackTitle = stringValue(t?.title);
          if (!trackId || !trackTitle) return [];
          const recording = recordValue(t?.recording);
          const trackArtistCredit = arrayValue(t?.['artist-credit']).length > 0
            ? parseArtistCredit(t?.['artist-credit'])
            : parseArtistCredit(recording?.['artist-credit']);
          return [{
            id: trackId,
            title: trackTitle,
            position: numberValue(t?.position) ?? trackIndex + 1,
            length: numberValue(t?.length) ?? undefined,
            'track_or_recording_length': numberValue(t?.track_or_recording_length) ?? undefined,
            recording: recording ? { length: numberValue(recording.length) ?? undefined } : undefined,
            'artist-credit': trackArtistCredit,
          }];
        }),
      };
    }),
  };
}

/** Preview (lecture seule, pas d'écriture DB) d'un album MusicBrainz par MBID de release
 *  OU de release-group (résolu automatiquement — même logique que le web). */
export async function previewAlbumFromMusicBrainz(mbid: string) {
  try {
    let releaseResponse = await fetch(
      `${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+release-groups&fmt=json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    let rgPrimaryType: string | null = null;

    if (releaseResponse.status === 404) {
      const rgResponse = await fetch(
        `${MUSICBRAINZ_API}/release-group/${encodeURIComponent(mbid)}?inc=releases+media&fmt=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (!rgResponse.ok) return { success: false, error: 'Album not found' };
      const rawRg: unknown = await rgResponse.json();
      const rgData = parseMbReleaseGroupLookup(rawRg);
      if (!rgData) return { success: false, error: 'Invalid release group response' };
      rgPrimaryType = rgData['primary-type'] || null;
      const releases = rgData.releases ?? [];
      if (releases.length === 0) return { success: false, error: 'No releases found for this release group' };
      const officialRelease = pickBestRelease(releases, releaseSelectionMode(rgPrimaryType)) ?? releases[0];
      releaseResponse = await fetch(
        `${MUSICBRAINZ_API}/release/${encodeURIComponent(officialRelease.id)}?inc=artist-credits+recordings+release-groups&fmt=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
    }

    if (!releaseResponse.ok) return { success: false, error: 'Album not found' };

    const rawRelease: unknown = await releaseResponse.json();
    const data = parseMbReleaseDetail(rawRelease);
    if (!data) return { success: false, error: 'Invalid album response' };

    const artistCredit = data['artist-credit']?.[0];
    const artist = artistCredit?.artist || { id: '', name: 'Unknown' };

    const tracks = (data.media || []).flatMap((m) =>
      (m.tracks || []).map((t) => ({ ...t, _discNo: m.position }))
    );

    const releaseGroupId = data['release-group']?.id;
    if (!releaseGroupId) {
      logInvalidExternalResponse('musicbrainz.releaseDetail', `release ${data.id} has no release-group`);
      return { success: false, error: 'Album has no release-group on MusicBrainz' };
    }
    const primaryType: string | null = rgPrimaryType || data['release-group']?.['primary-type'] || null;

    const coverUrl = await fetchCoverUrl(releaseGroupId, 'release-group', 2).catch(() => null);

    return {
      success: true,
      preview: {
        mbid: data.id,
        releaseGroupMbid: releaseGroupId,
        primaryType,
        title: data.title,
        artist: artist.name,
        artistMbid: artist.id,
        date: data.date || null,
        coverUrl,
        featuredArtists: featuredArtistsFromCredit(data['artist-credit'] || []),
        tracks: tracks.map((t) => ({
          mbid: t.id,
          title: t.title,
          position: t.position,
          discNo: t._discNo ?? 1,
          duration: t.length ?? t['track_or_recording_length'] ?? t.recording?.length ?? null,
          featuredArtists: featuredArtistsFromCredit(t['artist-credit'] || []),
        })),
      },
    };
  } catch {
    return { success: false, error: 'An error occurred' };
  }
}

/** Get-or-create un artiste par MBID, partagé entre l'artiste principal et chaque featured. */
async function getOrCreateArtistByMbid(
  supabase: SupabaseClient,
  mbid: string,
  name: string
): Promise<{ artistId: string | null; created: boolean; error: string | null }> {
  const { data: existingArtist } = await supabase
    .from('artists')
    .select('id')
    .eq('mbid', mbid)
    .maybeSingle();

  if (existingArtist) return { artistId: existingArtist.id, created: false, error: null };

  const newArtistId = crypto.randomUUID();
  const { error } = await supabase.from('artists').insert({ id: newArtistId, name, mbid });
  if (error) return { artistId: null, created: false, error: error.message };
  return { artistId: newArtistId, created: true, error: null };
}

async function resolveFeaturedArtists(
  supabase: SupabaseClient,
  credits: Array<{ mbid: string; name: string }>
): Promise<Map<string, string>> {
  const uniqueByMbid = new Map(credits.map((c) => [c.mbid, c.name]));
  const resolved = new Map<string, string>();
  for (const [mbid, name] of uniqueByMbid) {
    const result = await getOrCreateArtistByMbid(supabase, mbid, name);
    if (!result.artistId) {
      console.error('[resolveFeaturedArtists] failed to resolve artist', mbid, result.error);
      continue;
    }
    resolved.set(mbid, result.artistId);
  }
  return resolved;
}

async function buildExistingAlbumResponse(supabase: SupabaseClient, albumId: string, isSingle: boolean) {
  if (isSingle) {
    const { data: firstTrack } = await supabase
      .from('tracks')
      .select('id')
      .eq('album_id', albumId)
      .order('track_no', { ascending: true })
      .limit(1)
      .maybeSingle();
    const trackId = firstTrack?.id ?? null;
    return {
      success: true,
      albumId,
      redirectUrl: trackId ? `/tracks/${trackId}` : `/albums/${albumId}`,
      imported: false,
    };
  }
  return { success: true, albumId, redirectUrl: `/albums/${albumId}`, imported: false };
}

/**
 * Import album depuis MusicBrainz. Idempotent : si déjà importé, retourne l'existant.
 * Crée : artiste (si besoin), album, pistes, featured artists (best-effort).
 */
export async function importAlbumFromMusicBrainz(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient,
  mbid: string
) {
  try {
    const previewResult = await previewAlbumFromMusicBrainz(mbid);
    if (!previewResult.success) return previewResult;
    const preview = previewResult.preview!;

    const isSingle = preview.tracks.length === 1 || preview.primaryType === 'Single';
    const canonicalMbid = preview.releaseGroupMbid || mbid;

    const { data: existingAlbum, error: existingAlbumError } = await supabase
      .from('albums')
      .select('id')
      .eq('mbid', canonicalMbid)
      .limit(1)
      .maybeSingle();

    if (existingAlbumError) return { success: false, error: existingAlbumError.message };
    if (existingAlbum) return buildExistingAlbumResponse(supabase, existingAlbum.id, isSingle);

    const mainArtistResult = await getOrCreateArtistByMbid(supabase, preview.artistMbid, preview.artist);
    if (!mainArtistResult.artistId) {
      return { success: false, error: mainArtistResult.error ?? 'unknown error' };
    }
    const artistId = mainArtistResult.artistId;
    const createdArtist = mainArtistResult.created;

    // Dédup par titre canonique — attrape les rééditions/remasters/deluxe que MB modélise
    // comme un release-group *différent* mais qui sont le même album sous-jacent.
    const canonicalKey = canonicalAlbumKey(preview.title, preview.artist);
    const { data: canonicalMatch, error: canonicalError } = await supabase
      .from('albums')
      .select('id')
      .eq('artist_id', artistId)
      .eq('canonical_key', canonicalKey)
      .limit(1)
      .maybeSingle();

    if (!canonicalError && canonicalMatch) {
      return buildExistingAlbumResponse(supabase, canonicalMatch.id, isSingle);
    }

    let finalCoverUrl: string | null = preview.coverUrl || null;
    if (preview.coverUrl && canonicalMbid) {
      const storedUrl = await uploadCoverToSupabase(preview.coverUrl, canonicalMbid, supabaseAdmin);
      if (storedUrl) finalCoverUrl = storedUrl;
    }

    const newAlbumId = crypto.randomUUID();
    let { error: albumError } = await supabase.from('albums').insert({
      id: newAlbumId,
      title: preview.title,
      artist_id: artistId,
      mbid: canonicalMbid,
      release_date: normalizeReleaseDate(preview.date),
      cover_url: finalCoverUrl,
      type: preview.primaryType ?? 'Album',
      canonical_key: canonicalKey,
    });

    // canonical_key pas encore migrée — retry sans elle plutôt que d'échouer l'import.
    if (albumError?.message?.includes('canonical_key')) {
      ({ error: albumError } = await supabase.from('albums').insert({
        id: newAlbumId,
        title: preview.title,
        artist_id: artistId,
        mbid: canonicalMbid,
        release_date: normalizeReleaseDate(preview.date),
        cover_url: finalCoverUrl,
        type: preview.primaryType ?? 'Album',
      }));
    }

    if (albumError) {
      if (createdArtist) await supabase.from('artists').delete().eq('id', artistId);
      return { success: false, error: albumError.message };
    }

    const trackRows = preview.tracks.map((track) => ({
      id: crypto.randomUUID(),
      album_id: newAlbumId,
      artist_id: artistId,
      title: track.title,
      track_no: track.position,
      disc_no: track.discNo ?? null,
      duration_ms: track.duration,
      mbid: track.mbid,
      canonical_title: canonicalTrackTitle(track.title),
    }));

    const rollbackImport = async () => {
      if (trackRows.length > 0) await supabase.from('tracks').delete().eq('album_id', newAlbumId);
      await supabase.from('albums').delete().eq('id', newAlbumId);
      if (createdArtist) {
        const { count } = await supabase
          .from('albums')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artistId);
        if (!count || count === 0) await supabase.from('artists').delete().eq('id', artistId);
      }
    };

    if (trackRows.length > 0) {
      let { error: tracksError } = await supabase.from('tracks').insert(trackRows);
      if (tracksError?.message?.includes('canonical_title')) {
        ({ error: tracksError } = await supabase
          .from('tracks')
          .insert(trackRows.map(({ canonical_title, ...rest }) => rest)));
      }
      if (tracksError) {
        await rollbackImport();
        return { success: false, error: tracksError.message };
      }
    }

    // Featured artists (album + pistes) — additif, best-effort.
    const allFeaturedCredits = [
      ...preview.featuredArtists,
      ...preview.tracks.flatMap((t) => t.featuredArtists),
    ];
    if (allFeaturedCredits.length > 0) {
      const resolvedArtists = await resolveFeaturedArtists(supabase, allFeaturedCredits);

      const albumFeaturedRows = preview.featuredArtists.flatMap((f, i) => {
        const featuredArtistId = resolvedArtists.get(f.mbid);
        return featuredArtistId
          ? [{ album_id: newAlbumId, artist_id: featuredArtistId, position: i, joinphrase: f.joinphrase }]
          : [];
      });

      const trackFeaturedRows = preview.tracks.flatMap((track, trackIndex) =>
        track.featuredArtists.flatMap((f, i) => {
          const featuredArtistId = resolvedArtists.get(f.mbid);
          const trackId = trackRows[trackIndex]?.id;
          return featuredArtistId && trackId
            ? [{ track_id: trackId, artist_id: featuredArtistId, position: i, joinphrase: f.joinphrase }]
            : [];
        })
      );

      if (albumFeaturedRows.length > 0) {
        const { error } = await supabaseAdmin.from('album_featured_artists').insert(albumFeaturedRows);
        if (error) console.error('[importAlbumFromMusicBrainz] album_featured_artists error:', error);
      }
      if (trackFeaturedRows.length > 0) {
        const { error } = await supabaseAdmin.from('track_featured_artists').insert(trackFeaturedRows);
        if (error) console.error('[importAlbumFromMusicBrainz] track_featured_artists error:', error);
      }
    }

    const firstTrackId = isSingle ? (trackRows[0]?.id ?? null) : null;
    return {
      success: true,
      albumId: newAlbumId,
      redirectUrl: firstTrackId ? `/tracks/${firstTrackId}` : `/albums/${newAlbumId}`,
      imported: true,
      title: preview.title,
      artist: preview.artist,
      mbid: canonicalMbid,
    };
  } catch (err) {
    console.error('[importAlbumFromMusicBrainz] catch:', err);
    return { success: false, error: String(err) };
  }
}

export async function importArtistFromMusicBrainz(
  supabase: SupabaseClient,
  mbid: string,
  name: string
): Promise<{ success: boolean; artistId?: string; error?: string }> {
  const result = await getOrCreateArtistByMbid(supabase, mbid, name);
  if (!result.artistId) return { success: false, error: result.error ?? 'Import failed' };
  return { success: true, artistId: result.artistId };
}

/**
 * Import un titre depuis MusicBrainz (importe l'album parent si nécessaire).
 * @param recordingMbid MBID du recording MusicBrainz
 * @param releaseId MBID de la release (album) parente
 * @param trackTitle fallback : recherche par titre dans l'album si le MBID ne matche pas
 */
export async function importTrackFromMusicBrainz(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient,
  recordingMbid: string,
  releaseId: string,
  trackTitle?: string
): Promise<{ success: boolean; trackId?: string; albumId?: string; artistId?: string; title?: string; error?: string }> {
  try {
    const findByTitle = async (albumId: string, title: string) => {
      const { data } = await supabase
        .from('tracks')
        .select('id, title, album_id, artist_id')
        .eq('album_id', albumId)
        .ilike('title', title)
        .maybeSingle();
      return data;
    };

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

    // Dédup cross-container : le même morceau peut exister sur plusieurs release-groups
    // (album/EP/single) — chacun stocke son propre mbid de position de piste.
    if (trackTitle) {
      const previewForDedup = await previewAlbumFromMusicBrainz(releaseId);
      if (previewForDedup.success && previewForDedup.preview?.artistMbid) {
        const { data: existingArtist } = await supabase
          .from('artists')
          .select('id')
          .eq('mbid', previewForDedup.preview.artistMbid)
          .maybeSingle();

        if (existingArtist) {
          const canonicalTitle = canonicalTrackTitle(trackTitle);
          const { data: crossAlbumMatches } = await supabase
            .from('tracks')
            .select('id, title, album_id, artist_id, albums(type)')
            .eq('artist_id', existingArtist.id)
            .eq('canonical_title', canonicalTitle);

          if (crossAlbumMatches && crossAlbumMatches.length > 0) {
            const typeRank = (t?: string | null) => (t === 'Album' ? 3 : t === 'EP' ? 2 : t === 'Single' ? 1 : 0);
            const best = [...crossAlbumMatches].sort(
              (a, b) => typeRank((b as any).albums?.type) - typeRank((a as any).albums?.type)
            )[0];
            return {
              success: true,
              trackId: best.id,
              albumId: best.album_id,
              artistId: best.artist_id,
              title: best.title,
            };
          }
        }
      }
    }

    const importResult = await importAlbumFromMusicBrainz(supabase, supabaseAdmin, releaseId);
    if (!importResult.success || !('albumId' in importResult) || !importResult.albumId) {
      return { success: false, error: ('error' in importResult ? importResult.error : undefined) || "Échec de l'import de l'album parent" };
    }

    const albumId = importResult.albumId;

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

    return { success: false, error: "Titre introuvable après import de l'album" };
  } catch (err) {
    console.error('[importTrackFromMusicBrainz] error:', err);
    return { success: false, error: 'Une erreur est survenue' };
  }
}
