/**
 * READ-ONLY investigation of the 3 MBID_NOT_FOUND_ANYWHERE cases found by
 * audit-artist-mbid-integrity.mjs — the true "Luidji" category: albums.mbid
 * doesn't resolve as a release-group OR a release belonging to the artist at
 * all. Same approach as refix-suspicious-albums.mjs used for Luidji last
 * session: show existing activity, find the correct release-group via a
 * type-filtered search, but make NO change. Decide case by case afterwards.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/investigate-mbid-not-found.mjs
 */

import { createClient } from '@supabase/supabase-js';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300;

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

const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live', 'Compilation', 'Remix', 'Demo', 'Spokenword', 'Interview', 'Audiobook', 'Audio drama', 'Field recording',
]);

// The 3 flagged albums (album id, stored mbid) — from audit-report.json's mbidNotFoundAnywhere.
const TARGET_ALBUM_IDS = [
  '0ddaf3a1-4aca-41a2-a67c-744f50cec078', // "rema" — Rema
  '4653a2f9-bf68-4c73-91c1-cf0d4508b8d3', // "GenY⁵" — geny⁸⁹
  'b1d56fa5-08b1-427a-962e-61d788c200b9', // "BULLY (Deluxe)" — Ye
];

async function getActivitySummary(albumId) {
  const [diary, saved, favorited, listItems, curatorPicks] = await Promise.all([
    supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
    supabase.from('saved_albums').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
    supabase.from('user_favorite_albums').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
    supabase.from('list_items').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
    supabase.from('curator_picks').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
  ]);
  return {
    diaryEntries: diary.count ?? 0,
    saved: saved.count ?? 0,
    favorited: favorited.count ?? 0,
    listItems: listItems.count ?? 0,
    curatorPicks: curatorPicks.count ?? 0,
  };
}

async function tryResolveAsRelease(mbid) {
  const res = await mbFetch(`${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?fmt=json&inc=artist-credits+release-groups`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`release lookup HTTP ${res.status}`);
  const data = await res.json();
  return {
    title: data.title,
    artistName: data['artist-credit']?.[0]?.artist?.name,
    artistMbid: data['artist-credit']?.[0]?.artist?.id,
    releaseGroupId: data['release-group']?.id,
    releaseGroupTitle: data['release-group']?.title,
  };
}

async function searchCandidates(title, artist) {
  const esc = (s) => s.replace(/[+\-&|!(){}\[\]^~*?:\\\/]/g, ' ').trim();
  const query = `releasegroup:"${esc(title)}" AND artist:"${esc(artist)}"`;
  const url = `${MUSICBRAINZ_API}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
  const res = await mbFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const groups = data['release-groups'] || [];
  return groups
    .map((g) => ({
      id: g.id,
      title: g.title,
      artistName: g['artist-credit']?.[0]?.artist?.name,
      score: g.score,
      primaryType: g['primary-type'],
      secondaryTypes: g['secondary-types'] || [],
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

async function main() {
  const { data: albums, error } = await supabase
    .from('albums')
    .select('id, title, mbid, type, artist_id, artists(name, mbid)')
    .in('id', TARGET_ALBUM_IDS);
  if (error) throw error;

  for (const album of albums) {
    console.log(`\n=== "${album.title}" — ${album.artists?.name} (album ${album.id}) ===`);
    console.log(`  stored mbid: ${album.mbid}  |  stored type: ${album.type}  |  artist mbid: ${album.artists?.mbid}`);

    const activity = await getActivitySummary(album.id);
    console.log(`  activity: ${activity.diaryEntries} diary, ${activity.saved} saved, ${activity.favorited} favorited, ${activity.listItems} list items, ${activity.curatorPicks} curator picks`);

    await delay(DELAY_MS);
    let asRelease = null;
    try {
      asRelease = await tryResolveAsRelease(album.mbid);
    } catch (err) {
      console.log(`  ✗ release lookup failed: ${err.message}`);
    }
    if (asRelease) {
      console.log(`  ⚠ stored mbid IS a valid release: "${asRelease.title}" by ${asRelease.artistName} (artist mbid ${asRelease.artistMbid}) → release-group ${asRelease.releaseGroupId} ("${asRelease.releaseGroupTitle}")`);
      console.log(`    same artist as ours? ${asRelease.artistMbid === album.artists?.mbid}`);
    } else {
      console.log('  stored mbid does not exist on MusicBrainz as a release-group OR a release at all.');
    }

    await delay(DELAY_MS);
    const candidates = await searchCandidates(album.title, album.artists?.name || '');
    if (candidates.length === 0) {
      console.log('  ✗ no MB release-group candidates found for this title+artist at all');
    } else {
      console.log('  candidates from MB search (title+artist):');
      for (const c of candidates.slice(0, 5)) {
        const flags = [];
        if (c.primaryType && c.primaryType !== 'Album' && c.primaryType !== 'EP') flags.push(`type=${c.primaryType}`);
        if (c.secondaryTypes.some((t) => EXCLUDED_SECONDARY_TYPES.has(t))) flags.push(`secondary=${c.secondaryTypes.join(',')}`);
        console.log(`    - "${c.title}" by ${c.artistName} (${c.id}) score=${c.score}${flags.length ? ' [' + flags.join(' ') + ']' : ''}`);
      }
    }
    await delay(DELAY_MS);
  }

  console.log('\nDone. No writes were made — decide case by case from this output.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
