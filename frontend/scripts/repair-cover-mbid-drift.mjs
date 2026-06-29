/**
 * Fixes cover_url/mbid drift: lib/storage.ts's uploadCoverToSupabase() names
 * the Storage object after the album's mbid AT UPLOAD TIME (`${mbid}.jpg`).
 * Every script this session that repointed albums.mbid (repair-mbid-not-found.mjs,
 * repair-stored-release-not-group.mjs, both runs) only updated the mbid column,
 * not cover_url — so the cover still displays fine (the old file is still
 * there, the URL still resolves), but the filename embedded in cover_url no
 * longer matches the current mbid. Harmless today, but a future script that
 * derives the expected Storage path from albums.mbid (cleanup on delete,
 * cover refresh, etc.) would miss the real file.
 *
 * Scans ALL albums with a Storage-hosted cover_url (not just the ones
 * touched today, in case this drift existed before this session too),
 * detects a mismatch between the cover_url's filename and the current mbid,
 * and re-uploads the same image under the correct filename. Does NOT delete
 * the old file (low-risk leftover, not worth the extra risk of deleting the
 * wrong thing).
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-cover-mbid-drift.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-cover-mbid-drift.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const BUCKET = 'covers';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PAGE_SIZE = 1000;

async function fetchAllAlbums() {
  const all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('albums')
      .select('id, title, mbid, cover_url')
      .not('mbid', 'is', null)
      .not('cover_url', 'is', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetch albums failed: ${error.message}`);
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

function extractFilename(coverUrl) {
  const match = coverUrl.match(/\/covers\/([^/?]+)\.jpg/);
  return match ? match[1] : null;
}

async function main() {
  console.log(APPLY ? 'APPLY — writing changes' : 'DRY-RUN — no writes, --apply to write for real');

  const albums = await fetchAllAlbums();
  const supabaseHosted = albums.filter((a) => a.cover_url.includes('/storage/v1/object/public/covers/'));
  console.log(`${supabaseHosted.length} album(s) with a Supabase-hosted cover (of ${albums.length} with mbid+cover)\n`);

  let drifted = 0, fixed = 0, errors = 0;

  for (const album of supabaseHosted) {
    const currentFilename = extractFilename(album.cover_url);
    if (!currentFilename || currentFilename === album.mbid) continue;

    drifted++;
    console.log(`"${album.title}" (${album.id}) — cover filename "${currentFilename}" ≠ current mbid "${album.mbid}"`);
    console.log(`  → would re-upload as ${album.mbid}.jpg and update cover_url`);

    if (!APPLY) continue;

    try {
      const downloadRes = await fetch(album.cover_url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
      if (!downloadRes.ok) {
        console.log(`    ✗ could not download existing cover: HTTP ${downloadRes.status}`);
        errors++;
        continue;
      }
      const contentType = downloadRes.headers.get('content-type') ?? 'image/jpeg';
      const buffer = await downloadRes.arrayBuffer();
      const newFilename = `${album.mbid}.jpg`;

      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(newFilename, buffer, { contentType, upsert: true });
      if (uploadErr) {
        console.log(`    ✗ upload failed: ${uploadErr.message}`);
        errors++;
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(newFilename);
      const { error: updateErr } = await supabase.from('albums').update({ cover_url: publicUrlData.publicUrl }).eq('id', album.id);
      if (updateErr) {
        console.log(`    ✗ albums.cover_url update failed: ${updateErr.message}`);
        errors++;
        continue;
      }
      console.log('    ✓ re-uploaded and cover_url updated');
      fixed++;
    } catch (err) {
      console.log(`    ✗ exception: ${err.message}`);
      errors++;
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`Drifted covers found : ${drifted}`);
  if (APPLY) {
    console.log(`Fixed                : ${fixed}`);
    console.log(`Errors               : ${errors}`);
  }
  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
