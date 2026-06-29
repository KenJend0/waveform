/**
 * READ-ONLY audit of the 25 artists audit-artist-mbid-integrity.mjs skipped
 * because they have too many release-groups on MusicBrainz to browse
 * exhaustively (Beatles, Mozart, Dylan, Beethoven...) — see
 * scripts/audit-report.json's skippedArtists array.
 *
 * Different method: instead of browsing the artist's entire catalog, this
 * does a single direct release-group lookup per album using the mbid we
 * already have stored — cheap (1 request/album instead of hundreds of
 * pages), and works regardless of how prolific the artist is. Classifies
 * each album the same way the main audit does:
 *   - OK                      : mbid resolves as a release-group of this artist, type matches
 *   - TYPE_MISMATCH           : resolves fine, but albums.type disagrees
 *   - STORED_RELEASE_NOT_GROUP: mbid is a release (not release-group) of this artist
 *   - MBID_NOT_FOUND_ANYWHERE : doesn't resolve as either, for this artist
 *
 * Makes NO writes — same review-before-repair discipline as the rest of
 * this session's audit/repair scripts.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/audit-prolific-artists.mjs
 *   node --env-file=.env.local scripts/audit-prolific-artists.mjs --out=audit-prolific-report.json
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync } from 'fs';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300;

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT_FILE = outArg ? outArg.slice('--out='.length) : null;

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

function expectedType(rg) {
  const isLive = (rg['secondary-types'] || []).includes('Live');
  return isLive ? 'Live' : (rg['primary-type'] || null);
}

async function lookupReleaseGroup(rgId) {
  const res = await mbFetch(`${MUSICBRAINZ_API}/release-group/${encodeURIComponent(rgId)}?fmt=json&inc=artist-credits`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`release-group lookup HTTP ${res.status}`);
  return res.json();
}

async function lookupAsRelease(mbid) {
  const res = await mbFetch(`${MUSICBRAINZ_API}/release/${encodeURIComponent(mbid)}?fmt=json&inc=artist-credits+release-groups`);
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`release lookup HTTP ${res.status}`);
  const data = await res.json();
  return {
    found: true,
    artistMbid: data['artist-credit']?.[0]?.artist?.id,
    releaseGroupId: data['release-group']?.id,
    releaseGroupTitle: data['release-group']?.title,
  };
}

async function main() {
  const report = JSON.parse(readFileSync('scripts/audit-report.json', 'utf-8'));
  const skipped = report.skippedArtists.filter((s) => s.artistName !== 'Various Artists');
  console.log(`${skipped.length} prolific artist(s) to audit via direct lookup\n`);

  const results = { ok: [], typeMismatch: [], storedReleaseNotGroup: [], mbidNotFoundAnywhere: [] };

  for (let i = 0; i < skipped.length; i++) {
    const s = skipped[i];
    const { data: artist } = await supabase.from('artists').select('id, name, mbid').eq('id', s.artistId).maybeSingle();
    if (!artist) {
      console.log(`[${i + 1}/${skipped.length}] ${s.artistName} — artist row gone, skipping`);
      continue;
    }
    const { data: albums } = await supabase.from('albums').select('id, title, mbid, type').eq('artist_id', artist.id);
    console.log(`[${i + 1}/${skipped.length}] ${artist.name} (${albums.length} album(s))`);

    for (const album of albums) {
      let rg;
      try {
        rg = await lookupReleaseGroup(album.mbid);
      } catch (err) {
        console.log(`    ✗ "${album.title}" — lookup error: ${err.message}`);
        await delay(DELAY_MS);
        continue;
      }

      if (rg) {
        const creditArtistMbid = rg['artist-credit']?.[0]?.artist?.id;
        if (creditArtistMbid !== artist.mbid) {
          console.log(`    ⚠ "${album.title}" — release-group exists but belongs to a different artist`);
          results.mbidNotFoundAnywhere.push({ albumId: album.id, title: album.title, artistName: artist.name, artistId: artist.id, storedMbid: album.mbid, resolvedToDifferentArtist: true });
        } else {
          const expected = expectedType(rg);
          if (expected && album.type !== expected) {
            console.log(`    ⚠ "${album.title}" — type "${album.type}" should be "${expected}"`);
            results.typeMismatch.push({ albumId: album.id, title: album.title, artistName: artist.name, artistId: artist.id, mbid: album.mbid, storedType: album.type, expectedType: expected, realTitle: rg.title });
          } else {
            console.log(`    ✓ "${album.title}"`);
            results.ok.push({ albumId: album.id, title: album.title });
          }
        }
        await delay(DELAY_MS);
        continue;
      }

      // Not a release-group — try as a release.
      await delay(DELAY_MS);
      let resolved;
      try {
        resolved = await lookupAsRelease(album.mbid);
      } catch (err) {
        console.log(`    ✗ "${album.title}" — release lookup error: ${err.message}`);
        await delay(DELAY_MS);
        continue;
      }

      if (resolved.found && resolved.artistMbid === artist.mbid) {
        console.log(`    ⚠ "${album.title}" — mbid is a release, not release-group (→ ${resolved.releaseGroupId})`);
        results.storedReleaseNotGroup.push({
          albumId: album.id, title: album.title, artistName: artist.name, artistId: artist.id,
          storedMbid: album.mbid, storedType: album.type,
          realReleaseGroupId: resolved.releaseGroupId, realReleaseGroupTitle: resolved.releaseGroupTitle,
        });
      } else {
        console.log(`    ⚠ "${album.title}" — mbid doesn't resolve for this artist at all`);
        results.mbidNotFoundAnywhere.push({
          albumId: album.id, title: album.title, artistName: artist.name, artistId: artist.id,
          storedMbid: album.mbid, storedType: album.type,
          resolvedToDifferentArtist: resolved.found && resolved.artistMbid !== artist.mbid,
        });
      }
      await delay(DELAY_MS);
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`OK                       : ${results.ok.length}`);
  console.log(`TYPE_MISMATCH            : ${results.typeMismatch.length}`);
  console.log(`STORED_RELEASE_NOT_GROUP : ${results.storedReleaseNotGroup.length}`);
  console.log(`MBID_NOT_FOUND_ANYWHERE  : ${results.mbidNotFoundAnywhere.length}`);

  if (OUT_FILE) {
    writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nFull report written to ${OUT_FILE}`);
  }
  console.log('\nNo writes were made.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
