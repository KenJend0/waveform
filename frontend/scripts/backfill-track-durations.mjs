/**
 * Backfill track durations from MusicBrainz
 *
 * Finds tracks without duration_ms, fetches each album's release from
 * MusicBrainz and updates duration_ms + disc_no.
 *
 * Matching strategy (in order):
 *   1. By track MBID (exact)
 *   2. By position: disc_no + track_no (fallback for tracks imported without mbid)
 *
 * Usage:
 *   # All albums with missing durations:
 *   node --env-file=.env.local scripts/backfill-track-durations.mjs
 *
 *   # Specific album IDs only:
 *   node --env-file=.env.local scripts/backfill-track-durations.mjs \
 *     4c3d611e-3556-420c-8f83-99bb3f85d446 \
 *     8612db27-26e9-49e7-a925-ff7597c08a1c \
 *     60cedf61-c772-4c9b-aaf1-1eead20c86a0
 *
 * Respects MusicBrainz's 1 req/sec rate limit automatically.
 */

import { createClient } from '@supabase/supabase-js';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1200; // slightly above 1s to stay safely under MB rate limit

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse optional album IDs from CLI args
const targetAlbumIds = process.argv.slice(2).filter((a) => !a.startsWith('-'));

async function fetchMB(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 503 || res.status === 429) {
      if (attempt < 3) {
        console.log(`    ⏳ Rate limited, waiting ${(attempt + 2) * 2}s…`);
        await delay((attempt + 2) * 2000);
        return fetchMB(url, attempt + 1);
      }
    }

    return res;
  } catch (err) {
    if (attempt < 2) {
      await delay(2000);
      return fetchMB(url, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  console.log('🎵 Waveform — Track duration backfill\n');

  if (targetAlbumIds.length > 0) {
    console.log(`Targeting ${targetAlbumIds.length} specific album(s).\n`);
  }

  // ── 1. Find tracks without duration ──────────────────────────────────────
  // When targeting specific albums, include ALL their tracks (with or without
  // duration) so we also fix disc_no and mbid. For global runs, only missing.
  let tracksQuery = supabase
    .from('tracks')
    .select('id, mbid, album_id, track_no, disc_no');

  if (targetAlbumIds.length > 0) {
    tracksQuery = tracksQuery.in('album_id', targetAlbumIds);
  } else {
    tracksQuery = tracksQuery.is('duration_ms', null);
  }

  const { data: tracks, error: tracksError } = await tracksQuery;

  if (tracksError) {
    console.error('❌ Could not fetch tracks:', tracksError.message);
    process.exit(1);
  }

  if (!tracks || tracks.length === 0) {
    console.log('✅ Nothing to update.');
    return;
  }

  console.log(`Found ${tracks.length} track(s) to process.\n`);

  // ── 2. Group by album ─────────────────────────────────────────────────────
  const albumGroups = new Map();
  for (const track of tracks) {
    if (!albumGroups.has(track.album_id)) albumGroups.set(track.album_id, []);
    albumGroups.get(track.album_id).push(track);
  }

  // ── 3. Fetch album mbids ──────────────────────────────────────────────────
  const { data: albums } = await supabase
    .from('albums')
    .select('id, mbid, title')
    .in('id', [...albumGroups.keys()])
    .not('mbid', 'is', null);

  const albumById = new Map((albums || []).map((a) => [a.id, a]));

  // ── 4. Process each album ─────────────────────────────────────────────────
  let totalUpdated = 0;
  let totalSkipped = 0;
  let i = 0;

  for (const [albumId, albumTracks] of albumGroups) {
    i++;
    const album = albumById.get(albumId);

    if (!album?.mbid) {
      console.log(`[${i}/${albumGroups.size}] ⏭️  No mbid — skipping album ${albumId}`);
      totalSkipped += albumTracks.length;
      continue;
    }

    console.log(`[${i}/${albumGroups.size}] ${album.title}  (${album.mbid})`);

    await delay(DELAY_MS);

    try {
      const url = `${MUSICBRAINZ_API}/release/${album.mbid}?inc=recordings&fmt=json`;
      const res = await fetchMB(url);

      if (!res.ok) {
        console.log(`    ❌ MB returned ${res.status}`);
        totalSkipped += albumTracks.length;
        continue;
      }

      const data = await res.json();

      // Collect all tracks from all discs.
      // Duration priority: track.length → track_or_recording_length → recording.length
      // (with inc=recordings, MB puts duration in recording.length when track.length is absent)
      const mbTracks = (data.media || []).flatMap((m) =>
        (m.tracks || []).map((t) => ({
          mbid: t.id,
          discNo: m.position ?? 1,
          trackNo: t.position,
          duration:
            t.length ??
            t['track_or_recording_length'] ??
            t.recording?.length ??
            null,
        }))
      );

      // Two lookup indexes:
      //   1. by track MBID (preferred — exact match)
      //   2. by "discNo-trackNo" (fallback for tracks without mbid)
      const byMbid = new Map(mbTracks.map((t) => [t.mbid, t]));
      const byPosition = new Map(mbTracks.map((t) => [`${t.discNo}-${t.trackNo}`, t]));

      let albumUpdated = 0;

      for (const track of albumTracks) {
        // Try mbid first, then position
        const discNo = track.disc_no ?? 1;
        const found =
          (track.mbid && byMbid.get(track.mbid)) ||
          byPosition.get(`${discNo}-${track.track_no}`);

        if (!found) {
          console.log(
            `    ⚠️  No match for track_no=${track.track_no} disc=${discNo}` +
              (track.mbid ? ` mbid=${track.mbid}` : ' (no mbid)')
          );
          totalSkipped++;
          continue;
        }

        const patch = {};
        if (found.duration != null) patch.duration_ms = found.duration;
        if (found.discNo != null) patch.disc_no = found.discNo;
        // Also backfill mbid if the track didn't have one
        if (!track.mbid && found.mbid) patch.mbid = found.mbid;

        if (found.duration == null) {
          console.log(
            `    ⚠️  MB has no duration for track_no=${track.track_no}` +
              (track.mbid ? ` (${track.mbid})` : '')
          );
        }

        if (Object.keys(patch).length === 0) continue;

        const { error: updateError } = await supabase
          .from('tracks')
          .update(patch)
          .eq('id', track.id);

        if (updateError) {
          console.log(`    ❌ Update error: ${updateError.message}`);
        } else {
          if (found.duration != null) {
            albumUpdated++;
            totalUpdated++;
          }
        }
      }

      console.log(`    ✅ ${albumUpdated}/${albumTracks.length} tracks updated`);
    } catch (err) {
      console.error(`    ❌ Error: ${err.message}`);
      totalSkipped += albumTracks.length;
    }
  }

  console.log('\n────────────────────────────────');
  console.log(`✅ Done`);
  console.log(`   Tracks updated : ${totalUpdated}`);
  console.log(`   Tracks skipped : ${totalSkipped}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
