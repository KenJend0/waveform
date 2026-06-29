/**
 * Repairs the 3 MBID_NOT_FOUND_ANYWHERE cases found by
 * audit-artist-mbid-integrity.mjs (the true "Luidji" category — stored mbid
 * resolves to neither a release-group nor a release of the artist at all).
 * Investigated by hand (see investigate-mbid-not-found.mjs output):
 *
 *   - "rema" (Rema)            : tracks are already correct (Iron Man, Why,
 *                                Dumebi, Corny — his real EP). Only the album
 *                                mbid is stale/wrong. Fix: repoint mbid to the
 *                                real release-group, don't touch tracks.
 *   - "BULLY (Deluxe)" (Ye)    : tracks are already correct (real BULLY
 *                                tracklist with all featured artists). Same
 *                                fix: repoint mbid only.
 *   - "GenY⁵" (geny⁸⁹)         : the artist exists on MB but has ZERO
 *                                release-groups listed — there is no real
 *                                release-group to repoint to. The content is
 *                                legit (an obscure/underground album with a
 *                                user diary entry on it), just never indexed
 *                                on MusicBrainz. Fix: null the mbid instead
 *                                of a fix — stop claiming a link that doesn't
 *                                exist, keep the album/tracks/diary as-is.
 *
 * Dry-run by default — verifies the candidate release-group's tracklist
 * against what's already in our DB before printing what it WOULD do.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-mbid-not-found.mjs            (dry-run)
 *   node --env-file=.env.local scripts/repair-mbid-not-found.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300;

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function mbFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
  return res;
}

const REPOINT_CASES = [
  { albumId: '0ddaf3a1-4aca-41a2-a67c-744f50cec078', label: 'rema', newReleaseGroupId: '1c61c2ea-0b15-4281-87cf-3e198a71b200' },
  { albumId: 'b1d56fa5-08b1-427a-962e-61d788c200b9', label: 'BULLY (Deluxe)', newReleaseGroupId: '56327267-51fb-472c-919e-d6ca258ebab2' },
];

const NULL_MBID_CASE = { albumId: '4653a2f9-bf68-4c73-91c1-cf0d4508b8d3', label: 'GenY⁵' };

async function checkCandidateTracklist(rgId) {
  const res = await mbFetch(`${MUSICBRAINZ_API}/release-group/${rgId}?inc=releases+media&fmt=json`);
  if (!res.ok) return null;
  const data = await res.json();
  const releases = (data.releases || []).map((r) => ({
    id: r.id,
    status: r.status,
    trackCount: (r.media || []).reduce((sum, m) => sum + (m['track-count'] || 0), 0),
  }));
  return releases;
}

async function repointCase(c) {
  const { data: album } = await supabase.from('albums').select('id, title, mbid').eq('id', c.albumId).maybeSingle();
  if (!album) {
    console.log(`  ✗ album ${c.albumId} not found in DB`);
    return;
  }
  const { count: trackCount } = await supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('album_id', c.albumId);

  console.log(`\n=== "${album.title}" (${c.label}) ===`);
  console.log(`  current mbid: ${album.mbid} | ${trackCount} track(s) already in DB (left untouched)`);

  await delay(DELAY_MS);
  const releases = await checkCandidateTracklist(c.newReleaseGroupId);
  if (releases === null) {
    console.log(`  ✗ could not fetch candidate release-group ${c.newReleaseGroupId} — aborting this case`);
    return;
  }
  console.log(`  candidate release-group ${c.newReleaseGroupId} has ${releases.length} release(s): ${releases.map((r) => `${r.status || '?'}(${r.trackCount} tracks)`).join(', ')}`);

  const plausible = releases.some((r) => r.trackCount === trackCount) || releases.length === 0;
  console.log(`  track count ${plausible ? 'matches a release in this group ✓' : '⚠ does NOT match any release in this group — double check before applying'}`);

  console.log(`  → would set albums.mbid = ${c.newReleaseGroupId}`);

  if (!APPLY) return;

  const { error: updateErr } = await supabase.from('albums').update({ mbid: c.newReleaseGroupId }).eq('id', c.albumId);
  if (updateErr) {
    console.log(`  ✗ update failed: ${updateErr.message}`);
    return;
  }
  await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', c.albumId);
  const { error: extErr } = await supabase.from('external_ids').insert({
    entity_type: 'album', entity_id: c.albumId, source: 'musicbrainz', value: c.newReleaseGroupId,
  });
  if (extErr) console.log(`  ⚠ external_ids update failed (non-fatal): ${extErr.message}`);
  console.log('  ✓ repointed');
}

async function nullMbidCase(c) {
  const { data: album } = await supabase.from('albums').select('id, title, mbid').eq('id', c.albumId).maybeSingle();
  if (!album) {
    console.log(`  ✗ album ${c.albumId} not found in DB`);
    return;
  }
  console.log(`\n=== "${album.title}" (${c.label}) ===`);
  console.log(`  current mbid: ${album.mbid} — no corresponding release-group exists on MusicBrainz (artist has 0 listed)`);
  console.log('  → would set albums.mbid = NULL and remove its external_ids row (album/tracks/diary entries untouched)');

  if (!APPLY) return;

  const { error: updateErr } = await supabase.from('albums').update({ mbid: null }).eq('id', c.albumId);
  if (updateErr) {
    console.log(`  ✗ update failed: ${updateErr.message}`);
    return;
  }
  await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', c.albumId);
  console.log('  ✓ mbid cleared');
}

async function main() {
  console.log(APPLY ? 'APPLY — writing changes' : 'DRY-RUN — no writes, --apply to write for real');

  for (const c of REPOINT_CASES) {
    await repointCase(c);
    await delay(DELAY_MS);
  }
  await nullMbidCase(NULL_MBID_CASE);

  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
