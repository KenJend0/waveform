/**
 * Repoints albums.mbid for the 109 STORED_RELEASE_NOT_GROUP cases found by
 * audit-artist-mbid-integrity.mjs — right album/artist, but the stored mbid
 * is a RELEASE id instead of the release-group id (see
 * scripts/audit-report.json's storedReleaseNotGroup array, which already
 * resolved the correct release-group for each one and confirmed it belongs
 * to the same artist).
 *
 * Tracks are NOT touched — same situation as "rema"/"BULLY (Deluxe)" earlier
 * this session: the content is already correct, only the album-level
 * identifier is at the wrong granularity. As an extra safety check (same
 * rigor as before), each candidate release-group's releases are fetched and
 * the album is only repointed if our current track count matches one of
 * them — otherwise it's flagged for manual review instead of touched blindly.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-stored-release-not-group.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-stored-release-not-group.mjs --apply    (writes for real)
 *   node --env-file=.env.local scripts/repair-stored-release-not-group.mjs --file=scripts/audit-prolific-report.json
 *     (process a different report's storedReleaseNotGroup array — e.g. the one from audit-prolific-artists.mjs)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

async function getReleaseTrackCounts(rgId) {
  const res = await mbFetch(`${MUSICBRAINZ_API}/release-group/${encodeURIComponent(rgId)}?inc=releases+media&fmt=json`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.releases || []).map((r) => (r.media || []).reduce((sum, m) => sum + (m['track-count'] || 0), 0));
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const reportFile = fileArg ? fileArg.slice('--file='.length) : 'scripts/audit-report.json';
  const report = JSON.parse(readFileSync(reportFile, 'utf-8'));
  const cases = report.storedReleaseNotGroup;
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${cases.length} albums to repoint\n`);

  let ok = 0, mismatched = 0, errors = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[${i + 1}/${cases.length}] "${c.title}" — ${c.artistName} … `);

    const { count: trackCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', c.albumId);

    let releaseTrackCounts;
    try {
      releaseTrackCounts = await getReleaseTrackCounts(c.realReleaseGroupId);
    } catch (err) {
      console.log(`✗ MB lookup failed: ${err.message}`);
      errors++;
      await delay(DELAY_MS);
      continue;
    }

    if (releaseTrackCounts === null) {
      console.log('✗ could not fetch candidate release-group');
      errors++;
      await delay(DELAY_MS);
      continue;
    }

    if (!releaseTrackCounts.includes(trackCount)) {
      console.log(`⚠ MISMATCH — DB has ${trackCount} tracks, candidate releases have [${releaseTrackCounts.join(', ')}] — needs manual review, skipping`);
      mismatched++;
      await delay(DELAY_MS);
      continue;
    }

    console.log(`✓ ${trackCount} tracks matches — ${c.storedMbid} → ${c.realReleaseGroupId}`);
    ok++;

    if (APPLY) {
      const { error: updateErr } = await supabase.from('albums').update({ mbid: c.realReleaseGroupId }).eq('id', c.albumId);
      if (updateErr) {
        console.log(`    ✗ update failed: ${updateErr.message}`);
        continue;
      }
      await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', c.albumId);
      const { error: extErr } = await supabase.from('external_ids').insert({
        entity_type: 'album', entity_id: c.albumId, source: 'musicbrainz', value: c.realReleaseGroupId,
      });
      if (extErr) console.log(`    ⚠ external_ids update failed (non-fatal): ${extErr.message}`);
    }

    await delay(DELAY_MS);
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`Matched & ${APPLY ? 'repointed' : 'would repoint'} : ${ok}`);
  console.log(`Mismatched (skipped)              : ${mismatched}`);
  console.log(`Errors                             : ${errors}`);
  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
