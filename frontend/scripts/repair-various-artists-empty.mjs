/**
 * Deletes the 7 "Various Artists" compilation albums that have ZERO diary
 * entries anywhere (album-level or on any of their tracks) — confirmed by
 * investigate-various-artists.mjs. These were imported by the track-search
 * bug fixed in musicbrainz.ts's searchMusicBrainzRecordings (a recording's
 * release list can include dozens of "Various Artists" compilations before
 * the real single/album; the old code only checked primary-type, not
 * secondary-type Compilation).
 *
 * Does NOT touch the other 6 "Various Artists" albums that have exactly one
 * track with a diary entry — those need the correct artist/track found and
 * the diary entry moved, not a deletion. Handled separately.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/repair-various-artists-empty.mjs            (dry-run, default)
 *   node --env-file=.env.local scripts/repair-various-artists-empty.mjs --apply    (writes for real)
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMPTY_ALBUM_IDS = [
  'f429b093-556b-4abb-9f03-d669cfcd0c1b', // The Bodyguard (Original Soundtrack Album)
  'c3d147fd-3497-4c59-a120-abccb1beb9f6', // Party
  '9c3c1b6a-06c7-4a5e-aa19-23544970052c', // Absolute R&B
  '535e1df7-000b-40f6-b199-058dfbb87fa5', // Hits Hits Hits Été 2025
  'dcc4915c-a621-4337-95c6-aca8b92ca71b', // A Minecraft Movie (Original Motion Picture Soundtrack)
  '1f43b85e-c7e2-4e6b-94f8-1122820e4aef', // Hitalia: The Italian Hit Connection Volume 1
  'f7c11112-78cd-4612-98b5-dcf01fb91c40', // Gold & Platinum, Volume 2
];

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — ${EMPTY_ALBUM_IDS.length} empty compilation albums\n`);

  for (const albumId of EMPTY_ALBUM_IDS) {
    const { data: album } = await supabase.from('albums').select('id, title').eq('id', albumId).maybeSingle();
    if (!album) {
      console.log(`⊘ ${albumId} — already gone`);
      continue;
    }
    // Re-verify zero diary entries right before deleting, in case anything changed since investigate-various-artists.mjs ran.
    const { data: tracks } = await supabase.from('tracks').select('id').eq('album_id', albumId);
    const trackIds = (tracks ?? []).map((t) => t.id);
    const [{ count: albumDiary }, { count: trackDiary }] = await Promise.all([
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
      trackIds.length > 0
        ? supabase.from('track_diary_entries').select('id', { count: 'exact', head: true }).in('track_id', trackIds)
        : Promise.resolve({ count: 0 }),
    ]);
    if (albumDiary || trackDiary) {
      console.log(`✗ "${album.title}" now has diary entries (album: ${albumDiary}, tracks: ${trackDiary}) — skipping, re-investigate`);
      continue;
    }

    console.log(`→ would delete "${album.title}" (${albumId}) — ${trackIds.length} tracks, 0 diary entries`);
    if (APPLY) {
      await supabase.from('external_ids').delete().eq('entity_type', 'album').eq('entity_id', albumId);
      if (trackIds.length > 0) {
        await supabase.from('external_ids').delete().in('entity_id', trackIds);
      }
      const { error } = await supabase.from('albums').delete().eq('id', albumId);
      if (error) console.log(`  ✗ delete failed: ${error.message}`);
      else console.log('  ✓ deleted (tracks cascade)');
    }
  }

  console.log(`\nDone.${APPLY ? '' : ' Re-run with --apply to write changes.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
