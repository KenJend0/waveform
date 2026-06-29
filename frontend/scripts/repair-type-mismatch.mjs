/**
 * Fixes albums.type for the 37 TYPE_MISMATCH cases found by
 * audit-artist-mbid-integrity.mjs (scripts/audit-report.json's typeMismatch
 * array) — mbid is already confirmed to be a real release-group of the
 * artist, only the `type` column disagrees with its actual primary-type
 * (or "Live" when secondary-types includes Live). No MusicBrainz calls
 * needed — the correct value was already resolved by the audit.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-type-mismatch.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-type-mismatch.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const report = JSON.parse(readFileSync('scripts/audit-report.json', 'utf-8'));
  const cases = report.typeMismatch;
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${cases.length} albums to fix\n`);

  let updated = 0;
  for (const c of cases) {
    console.log(`"${c.title}" — ${c.artistName} : "${c.storedType}" → "${c.expectedType}"`);
    if (!APPLY) continue;

    const { error } = await supabase.from('albums').update({ type: c.expectedType }).eq('id', c.albumId);
    if (error) {
      console.log(`  ✗ update failed: ${error.message}`);
      continue;
    }
    updated++;
  }

  console.log(`\nDone.${APPLY ? ` ${updated}/${cases.length} updated.` : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
