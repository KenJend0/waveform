/**
 * READ-ONLY — for the 6 tracks with a diary entry stuck on a "Various
 * Artists" compilation (see investigate-various-artists.mjs), searches
 * MusicBrainz for the real song-by-its-real-artist match: a proper
 * single/album/EP release-group, not a compilation. Prints candidates only —
 * makes no writes, no decision. Used to pick the right mbid before writing
 * a migration script.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/investigate-various-artists-tracks.mjs
 */

import { isAcceptableReleaseGroup } from '../lib/musicbrainzReleasePolicy.mjs';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300;

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

// title, plus our best guess at the real artist (from general knowledge —
// to be confirmed/corrected by the search results themselves).
const TARGETS = [
  { trackId: '22b7a115-1d70-4f02-91b6-1bee4529c694', title: "Sarà perché ti amo", guessArtist: 'Ricchi e Poveri' },
  { trackId: 'b072bab0-e857-45a7-9911-5912cb3d7b6f', title: 'You Know You Like It', guessArtist: 'DJ Snake' },
  { trackId: '2a4b7027-0fab-4a64-bfb2-e5ba6185bc6f', title: '99 Luftballons', guessArtist: 'Nena' },
  { trackId: 'b4186613-7b38-4fab-8d3c-e6e59a06e9e3', title: 'Il en faut peu pour être heureux', guessArtist: '' },
  { trackId: '2ab483d9-50bc-4f13-accc-4e0c7fcd8cfb', title: 'If I Ruled the World', guessArtist: 'Nas' },
  { trackId: 'a2ee1eb2-0dee-4731-9874-f4080901da70', title: 'Superstition', guessArtist: 'Stevie Wonder' },
];

async function searchRecording(title) {
  const esc = (s) => s.replace(/["\\]/g, '\\$&');
  const query = `recording:"${esc(title)}"`;
  const url = `${MUSICBRAINZ_API}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=15&inc=releases`;
  const res = await mbFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.recordings || [];
}

async function main() {
  for (const t of TARGETS) {
    console.log(`\n=== "${t.title}" (guess: ${t.guessArtist || '?'}) — current track ${t.trackId} ===`);
    const recordings = await searchRecording(t.title);
    const exactTitle = recordings.filter((r) => r.title.toLowerCase() === t.title.toLowerCase());
    const pool = exactTitle.length > 0 ? exactTitle : recordings;

    for (const r of pool.slice(0, 8)) {
      const artistName = r['artist-credit']?.[0]?.artist?.name || '?';
      const releases = r.releases || [];
      const acceptable = releases.filter((rel) => rel['release-group'] && isAcceptableReleaseGroup(rel['release-group']));
      const best = acceptable[0] || releases[0];
      const flag = acceptable.length > 0 ? '' : ' [only compilations/lives available]';
      console.log(`  score=${r.score} artist="${artistName}" recordingMbid=${r.id}${flag}`);
      if (best) {
        console.log(`    → best release: "${best.title}" (${best.id}) rg="${best['release-group']?.title}" (${best['release-group']?.id}) type=${best['release-group']?.['primary-type']} secondary=${(best['release-group']?.['secondary-types']||[]).join(',')}`);
      }
    }
    await delay(DELAY_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
