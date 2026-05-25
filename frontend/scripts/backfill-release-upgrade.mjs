/**
 * Backfill: fix albums imported with an incomplete release
 *
 * For each album with a MusicBrainz release MBID:
 *   1. Fetch the release from MB to get its release-group ID + current track count
 *   2. Browse all releases in that release-group
 *   3. If a sibling release has more tracks → upgrade the album:
 *      - Update albums.mbid to the better release
 *      - Delete existing tracks
 *      - Insert all tracks from the new release (title, position, duration, mbid)
 *
 * Usage:
 *   # Dry run (no writes, just logs what would change):
 *   node --env-file=.env.local scripts/backfill-release-upgrade.mjs --dry-run
 *
 *   # Apply to all albums:
 *   node --env-file=.env.local scripts/backfill-release-upgrade.mjs
 *
 *   # Specific album IDs only:
 *   node --env-file=.env.local scripts/backfill-release-upgrade.mjs \
 *     4c3d611e-3556-420c-8f83-99bb3f85d446 \
 *     8612db27-26e9-49e7-a925-ff7597c08a1c
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

const dryRun = process.argv.includes('--dry-run');
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
  console.log('🎵 Waveform — Release upgrade backfill\n');
  if (dryRun) console.log('🔍 DRY RUN — no writes will be made\n');
  if (targetAlbumIds.length > 0) {
    console.log(`Targeting ${targetAlbumIds.length} specific album(s).\n`);
  }

  // ── 1. Fetch albums with a MusicBrainz release MBID ───────────────────────
  let albumsQuery = supabase
    .from('albums')
    .select('id, mbid, title, artist_id')
    .not('mbid', 'is', null);

  if (targetAlbumIds.length > 0) {
    albumsQuery = albumsQuery.in('id', targetAlbumIds);
  }

  const { data: albums, error: albumsError } = await albumsQuery;

  if (albumsError) {
    console.error('❌ Could not fetch albums:', albumsError.message);
    process.exit(1);
  }

  if (!albums || albums.length === 0) {
    console.log('✅ No albums to process.');
    return;
  }

  console.log(`Found ${albums.length} album(s) to check.\n`);

  let upgraded = 0;
  let alreadyBest = 0;
  let skipped = 0;

  // ── 2. Process each album ─────────────────────────────────────────────────
  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    console.log(`[${i + 1}/${albums.length}] ${album.title}  (${album.mbid})`);

    await delay(DELAY_MS);

    try {
      // ── 2a. Get current release info to find release-group ID ──────────────
      const releaseRes = await fetchMB(
        `${MUSICBRAINZ_API}/release/${album.mbid}?inc=release-groups&fmt=json`
      );

      if (!releaseRes.ok) {
        console.log(`    ❌ MB returned ${releaseRes.status} — skipping`);
        skipped++;
        continue;
      }

      const releaseData = await releaseRes.json();
      const rgId = releaseData['release-group']?.id;
      const currentTrackCount = releaseData['track-count'] ?? 0;

      if (!rgId) {
        console.log(`    ⏭️  No release-group ID — skipping`);
        skipped++;
        continue;
      }

      await delay(DELAY_MS);

      // ── 2b. Browse all releases in the release-group ───────────────────────
      const browseRes = await fetchMB(
        `${MUSICBRAINZ_API}/release?release-group=${rgId}&limit=100&fmt=json`
      );

      if (!browseRes.ok) {
        console.log(`    ❌ Browse returned ${browseRes.status} — skipping`);
        skipped++;
        continue;
      }

      const browseData = await browseRes.json();
      const siblings = browseData.releases || [];

      // Find the release with the most tracks (most complete version)
      let bestRelease = null;
      let bestCount = currentTrackCount;

      for (const r of siblings) {
        const count = r['track-count'] ?? 0;
        if (count > bestCount) {
          bestCount = count;
          bestRelease = r;
        }
      }

      if (!bestRelease) {
        console.log(`    ✅ Already the best release (${currentTrackCount} tracks)`);
        alreadyBest++;
        continue;
      }

      console.log(
        `    ⬆️  Better release found: ${bestRelease.id}` +
          `  (${bestCount} tracks vs current ${currentTrackCount})`
      );

      if (dryRun) {
        console.log(`    🔍 Would update mbid → ${bestRelease.id}`);
        upgraded++; // count as "would upgrade" in dry-run
        continue;
      }

      await delay(DELAY_MS);

      // ── 2c. Fetch full track list from the best release ────────────────────
      const tracksRes = await fetchMB(
        `${MUSICBRAINZ_API}/release/${bestRelease.id}?inc=recordings&fmt=json`
      );

      if (!tracksRes.ok) {
        console.log(`    ❌ Track fetch returned ${tracksRes.status} — skipping`);
        skipped++;
        continue;
      }

      const tracksData = await tracksRes.json();
      const newTracks = (tracksData.media || []).flatMap((m) =>
        (m.tracks || []).map((t) => ({
          album_id: album.id,
          artist_id: album.artist_id,
          title: t.title,
          track_no: t.position,
          disc_no: m.position ?? 1,
          duration_ms:
            t.length ??
            t['track_or_recording_length'] ??
            t.recording?.length ??
            null,
          mbid: t.id,
        }))
      );

      if (newTracks.length === 0) {
        console.log(`    ⚠️  New release has no tracks in MB response — skipping`);
        skipped++;
        continue;
      }

      // ── 2d. Update album mbid ──────────────────────────────────────────────
      const { error: albumErr } = await supabase
        .from('albums')
        .update({ mbid: bestRelease.id })
        .eq('id', album.id);

      if (albumErr) {
        console.log(`    ❌ Album update error: ${albumErr.message}`);
        skipped++;
        continue;
      }

      // ── 2e. Delete old tracks ──────────────────────────────────────────────
      const { error: deleteErr } = await supabase
        .from('tracks')
        .delete()
        .eq('album_id', album.id);

      if (deleteErr) {
        console.log(`    ❌ Delete tracks error: ${deleteErr.message}`);
        // Rollback album mbid update
        await supabase
          .from('albums')
          .update({ mbid: album.mbid })
          .eq('id', album.id);
        skipped++;
        continue;
      }

      // ── 2f. Insert new tracks ──────────────────────────────────────────────
      const { error: insertErr } = await supabase
        .from('tracks')
        .insert(newTracks);

      if (insertErr) {
        console.log(`    ❌ Insert tracks error: ${insertErr.message}`);
        skipped++;
        continue;
      }

      console.log(`    ✅ Upgraded: ${newTracks.length} tracks inserted`);
      upgraded++;
    } catch (err) {
      console.error(`    ❌ Error: ${err.message}`);
      skipped++;
    }
  }

  console.log('\n────────────────────────────────');
  console.log(dryRun ? '🔍 Dry run complete' : '✅ Done');
  console.log(`   ${dryRun ? 'Would upgrade' : 'Upgraded'} : ${upgraded}`);
  console.log(`   Already best     : ${alreadyBest}`);
  console.log(`   Skipped          : ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
