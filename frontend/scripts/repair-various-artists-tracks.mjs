/**
 * Migrates the 6 tracks with a diary entry stuck on a "Various Artists"
 * compilation (see investigate-various-artists.mjs) to their real
 * artist/album, found by investigate-various-artists-tracks.mjs:
 *
 *   - "Sarà perché ti amo"  → Ricchi e Poveri, "Reunion" (2021)
 *   - "You Know You Like It" → DJ Snake, "Encore" (2016)
 *   - "99 Luftballons"      → Nena, "99 Luftballons" (Single, 1983)
 *   - "If I Ruled the World" → Nas, "It Was Written" — ALREADY in our DB,
 *     just needs the diary entry remapped to its existing track, no import.
 *   - "Superstition"        → Stevie Wonder, "Talking Book" (1972)
 *
 * "Il en faut peu pour être heureux" is deliberately NOT included: it's
 * already correctly in the real film soundtrack release-group (same mbid
 * already stored) — "Various Artists" is the legitimate MB attribution for
 * a multi-voice-actor film soundtrack, not a wrong match. Left untouched.
 *
 * For each of the other 5: imports the artist/album/tracks if not already
 * present (skipped for Nas, already in DB), finds the matching track by
 * normalized title, moves the diary entry (track_id + album_id + artist_id)
 * to it, then deletes the now-empty-of-diary-entries old compilation album
 * (the other unrelated tracks on it go with it — same as the 7 already
 * cleaned up in repair-various-artists-empty.mjs).
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-various-artists-tracks.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-various-artists-tracks.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { pickBestRelease } from '../lib/musicbrainzReleasePolicy.mjs';
import { normalize } from '../lib/textNormalize.mjs';
import { canonicalAlbumKey } from '../lib/albumCanonical.mjs';
import { canonicalTrackTitle } from '../lib/trackCanonical.mjs';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300;

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function mbFetch(url, attempt = 0) {
  const MAX = 3;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX) {
        await delay(DELAY_MS * 2 * (attempt + 1));
        return mbFetch(url, attempt + 1);
      }
      throw new Error(`MB ${res.status} after ${MAX} retries`);
    }
    return res;
  } catch (err) {
    if (attempt < MAX) {
      await delay(DELAY_MS * 2);
      return mbFetch(url, attempt + 1);
    }
    throw err;
  }
}

const CASES = [
  {
    label: 'Sarà perché ti amo',
    oldTrackId: '22b7a115-1d70-4f02-91b6-1bee4529c694',
    oldAlbumId: '6d411acf-2b84-4035-b5f9-49f42b0fbd5d', // Favolosi Anni 80
    targetReleaseGroupId: 'a1c34990-62bb-4da9-8b1a-4ca62f8df3ee', // Reunion - Ricchi e Poveri
    mode: 'most',
  },
  // "You Know You Like It" — la précédente investigation n'avait cherché que
  // sur "Encore" (DJ Snake), où seul un "(DJ Premier remix)" matchait. Une
  // recherche directe par titre de recording trouve le vrai single studio
  // "DJ Snake, AlunaGeorge" (a134c516), pas un remix.
  {
    label: 'You Know You Like It',
    oldTrackId: 'b072bab0-e857-45a7-9911-5912cb3d7b6f',
    oldAlbumId: '09e57449-c49f-44c9-a02f-952cbc7357da', // Ministry of Sound: Summer Anthems 2016
    targetReleaseGroupId: 'a134c516-968a-40e2-a91e-06af346b226d', // You Know You Like It (Single) - DJ Snake, AlunaGeorge
    mode: 'fewest',
  },
  {
    label: '99 Luftballons',
    oldTrackId: '2a4b7027-0fab-4a64-bfb2-e5ba6185bc6f',
    oldAlbumId: 'ea6e3487-6045-44d8-839b-0dd0f32e634b', // Pop-Up 80's
    targetReleaseGroupId: '5f046368-b7c8-3f4b-9c85-ef2cc5b11af7', // 99 Luftballons (Single) - Nena
    mode: 'fewest',
  },
  {
    label: 'If I Ruled the World',
    oldTrackId: '2ab483d9-50bc-4f13-accc-4e0c7fcd8cfb',
    oldAlbumId: '001f9db8-fef6-445f-8926-d61bcccff539', // Radioactive Chartbusters, Volume 2: 1996
    existingTrackId: 'b77e35a5-e898-4cc1-8a9b-b4c8183b39c0', // already in DB on "It Was Written"
    existingAlbumId: 'ed0d6e86-5a0e-4b28-8043-e12eb0d6b83b',
  },
  {
    label: 'Superstition',
    oldTrackId: 'a2ee1eb2-0dee-4731-9874-f4080901da70',
    oldAlbumId: '3a7eb9d0-16b1-4bf9-8347-d93a5fb97fcf', // Motown Chartbusters, Volume 8
    targetReleaseGroupId: '58c6d809-bfa7-3b25-acf3-a99d53402b08', // Talking Book - Stevie Wonder
    mode: 'most',
  },
];

function normalizeDate(date) {
  if (!date) return null;
  const t = date.trim();
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

/** Resolves what album/artist/tracks WOULD be imported for a release-group
 *  (read-only — fetches from MB, and checks if already in DB, but never writes). */
async function resolveAlbumToImport(rgId, mode) {
  const { data: existing } = await supabase.from('albums').select('id, artist_id, title').eq('mbid', rgId).maybeSingle();
  if (existing) {
    const { data: tracks } = await supabase.from('tracks').select('id, title').eq('album_id', existing.id);
    return { alreadyExists: true, albumId: existing.id, artistId: existing.artist_id, albumTitle: existing.title, tracks };
  }

  const rgRes = await mbFetch(`${MUSICBRAINZ_API}/release-group/${encodeURIComponent(rgId)}?inc=releases+media+artist-credits&fmt=json`);
  if (!rgRes.ok) throw new Error(`release-group lookup failed: HTTP ${rgRes.status}`);
  const rgData = await rgRes.json();

  const releases = (rgData.releases || []).map((r) => ({
    id: r.id,
    status: r.status,
    trackCount: (r.media || []).reduce((sum, m) => sum + (m['track-count'] || 0), 0),
  }));
  const bestRelease = pickBestRelease(releases, mode);
  if (!bestRelease) throw new Error('no usable release in this release-group');

  await delay(DELAY_MS);
  const relRes = await mbFetch(`${MUSICBRAINZ_API}/release/${encodeURIComponent(bestRelease.id)}?inc=artist-credits+recordings+release-groups&fmt=json`);
  if (!relRes.ok) throw new Error(`release lookup failed: HTTP ${relRes.status}`);
  const relData = await relRes.json();

  const credit = relData['artist-credit']?.[0]?.artist;
  if (!credit?.id || !credit?.name) throw new Error('no usable artist-credit');

  const trackRows = (relData.media || []).flatMap((m) =>
    (m.tracks || []).map((t) => ({
      title: t.title,
      track_no: t.position,
      disc_no: m.position ?? 1,
      duration_ms: t.length ?? t['track_or_recording_length'] ?? null,
      mbid: t.id,
    }))
  );
  if (trackRows.length === 0) throw new Error('chosen release has no tracks');

  return {
    alreadyExists: false,
    rgId,
    albumTitle: relData.title,
    releaseDate: relData.date,
    primaryType: rgData['primary-type'] || 'Album',
    artistMbid: credit.id,
    artistName: credit.name,
    tracks: trackRows,
  };
}

/** Writes the artist/album/tracks resolved by resolveAlbumToImport(). Only called under --apply. */
async function writeAlbumImport(resolved) {
  let artistId;
  const { data: existingArtist } = await supabase.from('artists').select('id').eq('mbid', resolved.artistMbid).maybeSingle();
  if (existingArtist) {
    artistId = existingArtist.id;
  } else {
    artistId = randomUUID();
    const { error } = await supabase.from('artists').insert({ id: artistId, name: resolved.artistName, mbid: resolved.artistMbid });
    if (error) throw new Error(`artist insert failed: ${error.message}`);
  }

  const albumId = randomUUID();
  const { error: albumErr } = await supabase.from('albums').insert({
    id: albumId,
    title: resolved.albumTitle,
    artist_id: artistId,
    mbid: resolved.rgId,
    release_date: normalizeDate(resolved.releaseDate),
    type: resolved.primaryType,
    canonical_key: canonicalAlbumKey(resolved.albumTitle, resolved.artistName),
  });
  if (albumErr) throw new Error(`album insert failed: ${albumErr.message}`);

  const trackRows = resolved.tracks.map((t) => ({
    id: randomUUID(),
    album_id: albumId,
    artist_id: artistId,
    ...t,
    canonical_title: canonicalTrackTitle(t.title),
  }));
  const { error: tracksErr } = await supabase.from('tracks').insert(trackRows);
  if (tracksErr) {
    await supabase.from('albums').delete().eq('id', albumId);
    throw new Error(`tracks insert failed: ${tracksErr.message}`);
  }

  const extRows = [
    { entity_type: 'album', entity_id: albumId, source: 'musicbrainz', value: resolved.rgId },
    ...trackRows.map((t) => ({ entity_type: 'track', entity_id: t.id, source: 'musicbrainz', value: t.mbid })),
  ];
  await supabase.from('external_ids').delete().in('value', extRows.map((r) => r.value));
  await supabase.from('external_ids').insert(extRows);

  return { albumId, artistId, tracks: trackRows };
}

function findMatchingTrack(tracks, oldTitle) {
  const target = normalize(oldTitle);
  return tracks.find((t) => normalize(t.title) === target);
}

async function migrateOne(c) {
  console.log(`\n=== "${c.label}" ===`);

  let newTrackId, newAlbumId, newArtistId;

  if (c.existingTrackId) {
    newTrackId = c.existingTrackId;
    newAlbumId = c.existingAlbumId;
    const { data: track } = await supabase.from('tracks').select('artist_id').eq('id', newTrackId).maybeSingle();
    newArtistId = track?.artist_id;
    console.log(`  already in DB — track ${newTrackId} on album ${newAlbumId}`);
  } else {
    const { data: oldTrack } = await supabase.from('tracks').select('title').eq('id', c.oldTrackId).maybeSingle();
    if (!oldTrack) {
      console.log('  ✗ old track not found — already migrated?');
      return;
    }

    let resolved;
    try {
      resolved = await resolveAlbumToImport(c.targetReleaseGroupId, c.mode);
    } catch (err) {
      console.log(`  ✗ resolve failed: ${err.message}`);
      return;
    }

    const match = findMatchingTrack(resolved.tracks, oldTrack.title);
    if (!match) {
      console.log(`  ✗ no track titled "${oldTrack.title}" found on the new album (${resolved.tracks.length} tracks) — needs manual review`);
      return;
    }

    if (resolved.alreadyExists) {
      newTrackId = match.id;
      newAlbumId = resolved.albumId;
      newArtistId = resolved.artistId;
      console.log(`  already in DB — album "${resolved.albumTitle}" (${newAlbumId}), track "${match.title}" (${newTrackId})`);
    } else {
      console.log(`  → would import album "${resolved.albumTitle}" by ${resolved.artistName} (${resolved.tracks.length} tracks), track "${match.title}"`);
      if (APPLY) {
        const written = await writeAlbumImport(resolved);
        const writtenMatch = written.tracks.find((t) => normalize(t.title) === normalize(oldTrack.title));
        newTrackId = writtenMatch.id;
        newAlbumId = written.albumId;
        newArtistId = written.artistId;
        console.log(`    ✓ imported — album ${newAlbumId}, track ${newTrackId}`);
      }
    }
    await delay(DELAY_MS);
  }

  if (!APPLY) {
    if (newTrackId) {
      console.log(`  → would move diary entry: track ${c.oldTrackId} → ${newTrackId} (album ${newAlbumId}, artist ${newArtistId})`);
      console.log(`  → would delete old compilation album ${c.oldAlbumId}`);
    } else {
      console.log(`  → (after import) would move diary entry off ${c.oldTrackId} and delete old compilation album ${c.oldAlbumId}`);
    }
    return;
  }

  console.log(`  → moving diary entry: track ${c.oldTrackId} → ${newTrackId} (album ${newAlbumId}, artist ${newArtistId})`);

  const { error: updateErr } = await supabase
    .from('track_diary_entries')
    .update({ track_id: newTrackId, album_id: newAlbumId, artist_id: newArtistId })
    .eq('track_id', c.oldTrackId);
  if (updateErr) {
    console.log(`    ✗ diary entry remap failed: ${updateErr.message} — NOT deleting old album`);
    return;
  }
  console.log('    ✓ diary entry remapped');

  await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', c.oldAlbumId);
  const { data: oldTracks } = await supabase.from('tracks').select('id').eq('album_id', c.oldAlbumId);
  if (oldTracks?.length) {
    await supabase.from('external_ids').delete().in('entity_id', oldTracks.map((t) => t.id));
  }
  const { error: deleteErr } = await supabase.from('albums').delete().eq('id', c.oldAlbumId);
  if (deleteErr) console.log(`    ✗ old album delete failed: ${deleteErr.message}`);
  else console.log('    ✓ old compilation album deleted');
}

async function main() {
  console.log(APPLY ? 'APPLY — writing changes' : 'DRY-RUN — no writes, --apply to write for real');
  for (const c of CASES) {
    await migrateOne(c);
  }
  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
