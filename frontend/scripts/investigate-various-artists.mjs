/**
 * READ-ONLY investigation of the 13 compilation albums imported under the
 * "Various Artists" artist row — found while looking into why some titles
 * ended up attributed to "Various Artists" instead of the real artist: the
 * track-search import path (importTrackFromMusicBrainz/searchMusicBrainzRecordings)
 * picked the first release whose release-group primary-type was "Album",
 * without excluding Compilation secondary-type — a popular song appears on
 * dozens of "Various Artists" compilations on MusicBrainz, so a hit single
 * search could land on e.g. "Hits Été 2025" instead of the real single/album.
 * That code path is now fixed (see musicbrainz.ts's searchMusicBrainzRecordings),
 * but these 13 already-imported compilation albums are still in the DB.
 *
 * For each: lists every track + whether it has any diary entries, so we know
 * exactly what (if anything) is at stake before touching them. Makes NO writes.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/investigate-various-artists.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const { data: va } = await supabase.from('artists').select('id').ilike('name', 'Various Artists').maybeSingle();
  if (!va) {
    console.log('No "Various Artists" artist row found.');
    return;
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('id, title, mbid')
    .eq('artist_id', va.id);

  console.log(`${albums.length} compilation album(s) under "Various Artists"\n`);

  let totalDiaryOnTracks = 0;
  let totalDiaryOnAlbum = 0;

  for (const album of albums) {
    const [{ count: albumDiaryCount }, { data: albumTracks }] = await Promise.all([
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('album_id', album.id),
      supabase.from('tracks').select('id, title, track_no').eq('album_id', album.id).order('track_no'),
    ]);

    console.log(`=== "${album.title}" (${album.id}) — ${albumTracks.length} track(s), ${albumDiaryCount ?? 0} album-level diary entries ===`);
    totalDiaryOnAlbum += albumDiaryCount ?? 0;

    const trackIds = albumTracks.map((t) => t.id);
    if (trackIds.length === 0) continue;

    const { data: trackDiaryRows } = await supabase
      .from('track_diary_entries')
      .select('id, track_id')
      .in('track_id', trackIds);

    const diaryByTrack = new Map();
    for (const row of trackDiaryRows ?? []) {
      diaryByTrack.set(row.track_id, (diaryByTrack.get(row.track_id) ?? 0) + 1);
    }

    const trackedTracks = albumTracks.filter((t) => diaryByTrack.has(t.id));
    totalDiaryOnTracks += trackedTracks.length;

    if (trackedTracks.length > 0) {
      console.log(`  ⚠ ${trackedTracks.length} track(s) WITH diary entries:`);
      for (const t of trackedTracks) {
        console.log(`    - "${t.title}" (${t.id}) — ${diaryByTrack.get(t.id)} entrie(s)`);
      }
    } else {
      console.log('  (no track-level diary entries)');
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`Total albums           : ${albums.length}`);
  console.log(`Album-level diary entries : ${totalDiaryOnAlbum}`);
  console.log(`Tracks with diary entries : ${totalDiaryOnTracks}`);
  console.log('\nNo writes were made.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
