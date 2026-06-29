/**
 * One-time backfill of tracks.canonical_title for rows imported before the
 * cross-container track duplicate check existed (see
 * supabase_migration_track_canonical_title.sql).
 *
 * Without this, importTrackFromMusicBrainz's duplicate check only ever
 * matches NEW imports against each other — pre-existing tracks (including
 * the same song already duplicated across Album/EP/Single before this fix)
 * stay invisible to it.
 *
 * Updates run with bounded concurrency (CONCURRENCY requests in flight at
 * once) instead of one-at-a-time — at ~18k rows, sequential updates take
 * close to an hour; concurrent updates bring it down to under a minute.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/backfill-canonical-track-titles.mjs
 *   node --env-file=.env.local scripts/backfill-canonical-track-titles.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-canonical-track-titles.mjs --recompute  (also overwrites rows that already have a canonical_title)
 */

import { createClient } from '@supabase/supabase-js';
import { canonicalTrackTitle } from '../lib/trackCanonical.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const RECOMPUTE = process.argv.includes('--recompute');
const BATCH_SIZE = 1000;
const CONCURRENCY = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  let from = 0;
  let updated = 0;
  let total = 0;

  while (true) {
    // Same pagination caveat as backfill-canonical-keys.mjs: in default mode the
    // UPDATE below shrinks the matching set (canonical_title IS NULL), so always
    // re-query from 0 in that case rather than advancing the offset.
    const shrinkingFilter = !DRY_RUN && !RECOMPUTE;
    const rangeStart = shrinkingFilter ? 0 : from;
    let query = supabase.from('tracks').select('id, title');
    if (!RECOMPUTE) query = query.is('canonical_title', null);
    const { data: tracks, error } = await query.range(rangeStart, rangeStart + BATCH_SIZE - 1);

    if (error) {
      console.error('[backfill] fetch error:', error.message);
      process.exit(1);
    }
    if (!tracks || tracks.length === 0) break;

    total += tracks.length;

    if (DRY_RUN) {
      for (const track of tracks) {
        console.log(`[dry-run] ${track.title} → ${canonicalTrackTitle(track.title)}`);
      }
    } else {
      const outcomes = await mapWithConcurrency(tracks, CONCURRENCY, async (track) => {
        const { error: updateError } = await supabase
          .from('tracks')
          .update({ canonical_title: canonicalTrackTitle(track.title) })
          .eq('id', track.id);
        if (updateError) {
          console.error(`[backfill] update failed for ${track.id}:`, updateError.message);
          return false;
        }
        return true;
      });
      updated += outcomes.filter(Boolean).length;
      console.log(`[backfill] processed ${total} so far (${updated} updated)`);
    }

    from += BATCH_SIZE;
  }

  console.log(`\n[backfill] ${total} tracks scanned, ${updated} updated.`);
}

main();
