/**
 * Resolves the one duplicate left by repair-various-artists-tracks.mjs:
 * the same user had already manually re-reviewed "If I Ruled the World" on
 * its correct track (10/10, detailed comment about Lauryn Hill, 2026-05-22
 * 17:24) shortly after their first review landed on the wrong "Various
 * Artists" compilation track (9/10, "Classique !", 2026-05-22 17:17) — the
 * UNIQUE(user_id, track_id, listened_at) constraint blocked the automatic
 * remap because the corrected entry already existed.
 *
 * Deletes the older, superseded entry on the compilation track. Does NOT
 * touch the newer entry on the correct track. Then deletes the now fully
 * diary-free "Radioactive Chartbusters, Volume 2: 1996" compilation album
 * (same cleanup repair-various-artists-tracks.mjs would have done).
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-duplicate-diary-entry.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-duplicate-diary-entry.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SUPERSEDED_ENTRY_ID = 'e15e03dd-db84-4dea-a9c2-b05f714744ba';
const OLD_ALBUM_ID = '001f9db8-fef6-445f-8926-d61bcccff539'; // Radioactive Chartbusters, Volume 2: 1996

async function main() {
  console.log(APPLY ? 'APPLY — writing changes' : 'DRY-RUN — no writes, --apply to write for real');

  const { data: entry } = await supabase.from('track_diary_entries').select('*').eq('id', SUPERSEDED_ENTRY_ID).maybeSingle();
  if (!entry) {
    console.log('Superseded entry already gone — nothing to do here.');
  } else {
    console.log(`→ would delete superseded diary entry ${SUPERSEDED_ENTRY_ID} (rating ${entry.rating}, "${entry.review_body}")`);
    if (APPLY) {
      const { error } = await supabase.from('track_diary_entries').delete().eq('id', SUPERSEDED_ENTRY_ID);
      if (error) {
        console.log(`  ✗ delete failed: ${error.message}`);
        return;
      }
      console.log('  ✓ deleted');
    }
  }

  const { data: album } = await supabase.from('albums').select('id, title').eq('id', OLD_ALBUM_ID).maybeSingle();
  if (!album) {
    console.log('Old compilation album already gone.');
    return;
  }
  const { data: tracks } = await supabase.from('tracks').select('id').eq('album_id', OLD_ALBUM_ID);
  const trackIds = (tracks ?? []).map((t) => t.id);
  const { count: remainingDiary } = trackIds.length > 0
    ? await supabase.from('track_diary_entries').select('id', { count: 'exact', head: true }).in('track_id', trackIds)
    : { count: 0 };

  if (remainingDiary) {
    console.log(`✗ "${album.title}" still has ${remainingDiary} diary entrie(s) on other tracks — not deleting`);
    return;
  }

  console.log(`→ would delete old compilation album "${album.title}" (${OLD_ALBUM_ID}) — 0 remaining diary entries`);
  if (APPLY) {
    await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', OLD_ALBUM_ID);
    if (trackIds.length > 0) {
      await supabase.from('external_ids').delete().in('entity_id', trackIds);
    }
    const { error } = await supabase.from('albums').delete().eq('id', OLD_ALBUM_ID);
    if (error) console.log(`  ✗ delete failed: ${error.message}`);
    else console.log('  ✓ deleted (tracks cascade)');
  }

  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
