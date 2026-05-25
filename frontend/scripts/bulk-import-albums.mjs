/**
 * Bulk import albums into Waveform from MusicBrainz
 *
 * For each (title, artist) pair in the ALBUMS list:
 *   1. Skips if album already imported (dedup by mbid or title+artist)
 *   2. Searches MusicBrainz release-group endpoint to find the best match
 *   3. Fetches full release details (tracks, cover art)
 *   4. Inserts artist, album, tracks, and external_ids into Supabase
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/bulk-import-albums.mjs
 *
 * Options:
 *   --dry-run    Search and print matches without inserting into DB
 *   --skip N     Skip the first N albums (resume after interruption)
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const COVER_ART_API = 'https://coverartarchive.org';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const DELAY_MS = 1300; // 1.3s between MB requests to respect 1 req/sec rate limit

const DRY_RUN = process.argv.includes('--dry-run');
const skipArg = process.argv.find((a) => a.startsWith('--skip='));
const SKIP_COUNT = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Album list ──────────────────────────────────────────────────────────────

const ALBUMS = [
  // French rap
  ['Bitume Caviar, Vol. 01', 'Prince Waly'],
  ['Moussa', 'Prince Waly'],
  ['ERRR', 'La Fève'],
  ['Akimbo', 'Ziak'],
  ['LMF', 'Freeze Corleone'],
  ['KH-22', 'Ashe 22'],
  ['Mélancholia', 'Green Montana'],
  ['Météo', 'Jäde'],
  ['Trinity', 'Laylow'],
  ['Ipséité', 'Damso'],
  ['JVLIVS II', 'SCH'],
  ['ROUGE', 'Kaaris'],
  ['Taciturne', 'Dinos'],
  ['NQNT 2', 'Vald'],
  ['Mauvais Ordre', 'Lomepal'],
  // International rap/pop
  ['Astroworld', 'Travis Scott'],
  ['After Hours', 'The Weeknd'],
  ['SOS', 'SZA'],
  ['UTOPIA', 'Travis Scott'],
  ['Take Care', 'Drake'],
  ['Nothing Was the Same', 'Drake'],
  ['Starboy', 'The Weeknd'],
  ['Future Nostalgia', 'Dua Lipa'],
  ['1989', 'Taylor Swift'],
  ['Un Verano Sin Ti', 'Bad Bunny'],
  ['DAMN.', 'Kendrick Lamar'],
  ['Blonde', 'Frank Ocean'],
  ['Scorpion', 'Drake'],
  ['Midnights', 'Taylor Swift'],
  ['Heroes & Villains', 'Metro Boomin'],
  // Electronic / ambient
  ['Untrue', 'Burial'],
  ['Clube da Esquina', 'Milton Nascimento'],
  ['El Mal Querer', 'Rosalía'],
  ['African Giant', 'Burna Boy'],
  ['YHLQMDLG', 'Bad Bunny'],
  ['Rave & Roses', 'Rema'],
  ['Rumours', 'Fleetwood Mac'],
  ['Blue Lines', 'Massive Attack'],
  ['Souvlaki', 'Slowdive'],
  ['Lonerism', 'Tame Impala'],
  ['Dragon New Warm Mountain I Believe In You', 'Big Thief'],
  ['Renaissance', 'Beyoncé'],
  ['MM..FOOD', 'MF DOOM'],
  ['Heligoland', 'Massive Attack'],
  ['Por Cesárea', 'Dillom'],
  ['WASTELAND', 'Brent Faiyaz'],
  ['Gemini Rights', 'Steve Lacy'],
  ['Ctrl', 'SZA'],
  ['Isolation', 'Kali Uchis'],
  ['Freudian', 'Daniel Caesar'],
  ['HEAVN', 'Jamila Woods'],
  ['Take Me Apart', 'Kelela'],
  ['Lahai', 'Sampha'],
  ['Over It', 'Summer Walker'],
  ['A Seat at the Table', 'Solange'],
  ['SweetSexySavage', 'Kehlani'],
  ['Trip', 'Jhené Aiko'],
  ['Saturn', 'Nao'],
  // Soundtracks
  ['La La Land', 'Justin Hurwitz'],
  ['Babylon', 'Justin Hurwitz'],
  ['Interstellar', 'Hans Zimmer'],
  ['Inception', 'Hans Zimmer'],
  ['Dune', 'Hans Zimmer'],
  ['Oppenheimer', 'Ludwig Göransson'],
  ['The Social Network', 'Trent Reznor & Atticus Ross'],
  ['Blade Runner 2049', 'Hans Zimmer'],
  ['Whiplash', 'Justin Hurwitz'],
  ['Tenet', 'Ludwig Göransson'],
  ['The Batman', 'Michael Giacchino'],
  ['How to Train Your Dragon', 'John Powell'],
  ['The Grand Budapest Hotel', 'Alexandre Desplat'],
  ['Spirited Away', 'Joe Hisaishi'],
  ['Arrival', 'Jóhann Jóhannsson'],
  // UK rap / grime
  ['Psychodrama', 'Dave'],
  ['Konnichiwa', 'Skepta'],
  ["We're All Alone in This Together", 'Dave'],
  ['23', 'Central Cee'],
  ['Split Decision', 'Central Cee'],
  ['Made in the Manor', 'Kano'],
  ['Gang Signs & Prayer', 'Stormzy'],
  ['Heavy Is the Head', 'Stormzy'],
  ['Boy in da Corner', 'Dizzee Rascal'],
  ['Not Waving, but Drowning', 'Loyle Carner'],
  ['Natural Brown Prom Queen', 'Sudan Archives'],
  ['Rise Above Hate', 'Unknown T'],
  ['Alpha Place', 'Knucks'],
  ['Home Alone 2', 'D Block Europe'],
  ['Ignorance Is Bliss', 'Skepta'],
  // Indie / rock / alternative
  ['AM', 'Arctic Monkeys'],
  ['Favourite Worst Nightmare', 'Arctic Monkeys'],
  ['Currents', 'Tame Impala'],
  ['Is This It', 'The Strokes'],
  ['The New Abnormal', 'The Strokes'],
  ['Melodrama', 'Lorde'],
  ['Punisher', 'Phoebe Bridgers'],
  ['A Moon Shaped Pool', 'Radiohead'],
  ['Wolfgang Amadeus Phoenix', 'Phoenix'],
  ['Tranquility Base Hotel & Casino', 'Arctic Monkeys'],
  ['The Suburbs', 'Arcade Fire'],
  ['In Rainbows', 'Radiohead'],
  ['An Awesome Wave', 'alt-J'],
  ['I Love You.', 'The Neighbourhood'],
  ['Divide', 'Ed Sheeran'],
  ['Fine Line', 'Harry Styles'],
  ['SOUR', 'Olivia Rodrigo'],
  ['Planet Her', 'Doja Cat'],
  ['The Fame Monster', 'Lady Gaga'],
  ['21', 'Adele'],
  ['Teenage Dream', 'Katy Perry'],
  ['Montero', 'Lil Nas X'],
  ['Purpose', 'Justin Bieber'],
  ['When We All Fall Asleep, Where Do We Go?', 'Billie Eilish'],
  // Latin
  ['Motomami', 'Rosalía'],
  ['DATA', 'Tainy'],
  ['SATURNO', 'Rauw Alejandro'],
  ['OASIS', 'J Balvin'],
  ['Mañana Será Bonito', 'KAROL G'],
  ['VICE VERSA', 'Rauw Alejandro'],
  ['Colores', 'J Balvin'],
  ['Fórmula, Vol. 3', 'Romeo Santos'],
  ['Afrodisíaco', 'Rauw Alejandro'],
  ['Vibras', 'J Balvin'],
  ['KG0516', 'KAROL G'],
  ['Feliz Cumpleaños Ferxxo Te Pirateamos el Álbum', 'Feid'],
  ['x100PRE', 'Bad Bunny'],
  // Pop divas
  ['Born This Way', 'Lady Gaga'],
  ['Emotion', 'Carly Rae Jepsen'],
  ['Dangerous Woman', 'Ariana Grande'],
  ['30', 'Adele'],
  ['emails i can\'t send', 'Sabrina Carpenter'],
  ['BRAT', 'Charli XCX'],
  ['Pure Heroine', 'Lorde'],
  ['Certified Lover Boy', 'Drake'],
  ['The Life of Pablo', 'Kanye West'],
  ['Mr. Morale & The Big Steppers', 'Kendrick Lamar'],
  ['Views', 'Drake'],
  ['For All the Dogs', 'Drake'],
  // Electronic / dance
  ['Discovery', 'Daft Punk'],
  ['Random Access Memories', 'Daft Punk'],
  ['Immunity', 'Jon Hopkins'],
  ['Syro', 'Aphex Twin'],
  ['Cross', 'Justice'],
  ['In Colour', 'Jamie xx'],
  ['Settle', 'Disclosure'],
  ['Nurture', 'Porter Robinson'],
  ['Singularity', 'Jon Hopkins'],
  ['Crush', 'Floating Points'],
  ['Before Today', "Ariel Pink's Haunted Graffiti"],
  ['Alive 2007', 'Daft Punk'],
  ['LP5', 'Autechre'],
  // Jazz
  ['Kind of Blue', 'Miles Davis'],
  ['A Love Supreme', 'John Coltrane'],
  ['Blue Train', 'John Coltrane'],
  ['Mingus Ah Um', 'Charles Mingus'],
  ['Time Out', 'The Dave Brubeck Quartet'],
  ['Getz/Gilberto', 'Stan Getz'],
  ['Ella and Louis', 'Ella Fitzgerald'],
  ['The Shape of Jazz to Come', 'Ornette Coleman'],
  ['Head Hunters', 'Herbie Hancock'],
  ['Bitches Brew', 'Miles Davis'],
  ['The Black Saint and the Sinner Lady', 'Charles Mingus'],
  ['Maiden Voyage', 'Herbie Hancock'],
  ['Speak No Evil', 'Wayne Shorter'],
  ['The Köln Concert', 'Keith Jarrett'],
  ['Sketches of Spain', 'Miles Davis'],
  // Afrobeats
  ['Made in Lagos', 'Wizkid'],
  ['Twice As Tall', 'Burna Boy'],
  ['Boy Alone', 'Omah Lay'],
  ['Mr. Money with the Vibe', 'Asake'],
  ['I Told Them...', 'Burna Boy'],
  ['Work of Art', 'Asake'],
  ['Timeless', 'Davido'],
  ['Ghetto Love', 'Wizkid'],
  ['Lungu Boy', 'Asake'],
  ['HEIS', 'Rema'],
  ['GEMINI', 'Rema'],
  ['Playboy', 'Fireboy DML'],
  ['L.I.F.E', 'Burna Boy'],
  // French rap (continued)
  ['Feu', 'Nekfeu'],
  ['Racine Carrée', 'Stromae'],
  ['Civilisation', 'Orelsan'],
  ['A7', 'SCH'],
  ["L'école du micro d'argent", 'IAM'],
  ['Pyramide', 'Werenoi'],
  ['Deux frères', 'PNL'],
  ['QALF Infinity', 'Damso'],
  ['Ceinture noire', 'Maître Gims'],
  // More soundtracks
  ['The Dark Knight', 'Hans Zimmer'],
  ['Black Panther', 'Ludwig Göransson'],
  ['Up', 'Michael Giacchino'],
  ['Spider-Man: Across the Spider-Verse', 'Daniel Pemberton'],
  ['Gone Girl', 'Trent Reznor & Atticus Ross'],
  ['The Last of the Mohicans', 'Trevor Jones'],
  // Rock classics
  ['Nevermind', 'Nirvana'],
  ['Back in Black', 'AC/DC'],
  ['The Dark Side of the Moon', 'Pink Floyd'],
  ['Led Zeppelin IV', 'Led Zeppelin'],
  ['American Idiot', 'Green Day'],
  ['The Black Parade', 'My Chemical Romance'],
  ['OK Computer', 'Radiohead'],
  ['Toxicity', 'System of a Down'],
  ['Californication', 'Red Hot Chili Peppers'],
  ['Demon Days', 'Gorillaz'],
  ['Absolution', 'Muse'],
  // R&B / soul
  ['Heaux Tales', 'Jazmine Sullivan'],
  ['The Age of Pleasure', 'Janelle Monáe'],
  ['The Miseducation of Lauryn Hill', 'Lauryn Hill'],
  ['Good to Know', 'JoJo'],
  ['Aaliyah', 'Aaliyah'],
  ['Honey', 'Robyn'],
  ['The Diary of Alicia Keys', 'Alicia Keys'],
  ['Thriller', 'Michael Jackson'],
  ['Off the Wall', 'Michael Jackson'],
  ['Songs in the Key of Life', 'Stevie Wonder'],
  ["What's Going On", 'Marvin Gaye'],
  ['I Am', 'Earth, Wind & Fire'],
  ['Bad Girls', 'Donna Summer'],
  ['Diana', 'Diana Ross'],
  ['Lady Soul', 'Aretha Franklin'],
  ['Private Dancer', 'Tina Turner'],
  ['Mothership Connection', 'Parliament'],
  ["Let's Stay Together", 'Al Green'],
  ['The Emancipation of Mimi', 'Mariah Carey'],
  ['Confessions', 'Usher'],
  ['Voodoo', "D'Angelo"],
  ['Back to Black', 'Amy Winehouse'],
  // Metalcore / heavy
  ['Sempiternal', 'Bring Me The Horizon'],
  ['Holy Hell', 'Architects'],
  ['The Death of Me', 'Polaris'],
  ['The Way It Ends', 'Currents'],
  ['Alien', 'Northlane'],
  ['Atonement', 'Killswitch Engage'],
  ['All Our Gods Have Abandoned Us', 'Architects'],
  ['I Let It In and It Took Everything', 'Loathe'],
  ['You Are We', 'While She Sleeps'],
  ['The Poison', 'Bullet for My Valentine'],
  ['There Is a Hell Believe Me I\'ve Seen It', 'Bring Me The Horizon'],
  ['The Mortal Coil', 'Polaris'],
  ['Death Is Little More', 'Boundaries'],
  ['Perception', 'Breakdown of Sanity'],
  ['Lost Forever // Lost Together', 'Architects'],
  // Lo-fi / hip-hop / instrumental
  ['Modal Soul', 'Nujabes'],
  ['Metaphorical Music', 'Nujabes'],
  ['Madvillainy', 'Madvillain'],
  ['Donuts', 'J Dilla'],
  ['Since I Left You', 'The Avalanches'],
  ['The Low End Theory', 'A Tribe Called Quest'],
  ['Petestrumentals', 'Pete Rock'],
  ['Solitude', 'Jinsang'],
  ['Idealism', 'Rainy Evening'],
  ['A Son of the Sun', 'Uyama Hiroto'],
  ['Shades of Blue', 'Madlib'],
  ['Endtroducing.....', 'DJ Shadow'],
  ['Entroducing', 'RJD2'],
  ['Late Night Delight', 'Luxury Elite'],
  ['Luv(sic) Hexalogy', 'Nujabes'],
];

// ─── Utilities ───────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeDate(date) {
  if (!date) return null;
  const t = date.trim();
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

async function mbFetch(url, attempt = 0) {
  const MAX = 3;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
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

/** Search MB release-group endpoint and return the best match MBID */
async function searchReleaseGroup(title, artist) {
  // Escape Lucene special chars except quotes
  const esc = (s) => s.replace(/[+\-&|!(){}\[\]^~*?:\\\/]/g, ' ').trim();
  const query = `releasegroup:"${esc(title)}" AND artist:"${esc(artist)}"`;
  const url = `${MUSICBRAINZ_API}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const res = await mbFetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  const groups = data['release-groups'] || [];
  if (groups.length === 0) {
    // Fallback: just title query
    const fallbackQuery = `releasegroup:"${esc(title)}"`;
    const fbUrl = `${MUSICBRAINZ_API}/release-group?query=${encodeURIComponent(fallbackQuery)}&fmt=json&limit=5`;
    await delay(DELAY_MS);
    const fbRes = await mbFetch(fbUrl);
    if (!fbRes.ok) return null;
    const fbData = await fbRes.json();
    const fbGroups = fbData['release-groups'] || [];
    return fbGroups[0] || null;
  }
  return groups[0];
}

/** Get the first release ID from a release group */
async function getFirstReleaseId(rgMbid) {
  const url = `${MUSICBRAINZ_API}/release-group/${encodeURIComponent(rgMbid)}?inc=releases&fmt=json`;
  const res = await mbFetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  // Sort releases by date to get the earliest
  const releases = data.releases || [];
  releases.sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1);
  return releases[0]?.id || null;
}

/** Fetch full release details including tracks */
async function getReleaseDetails(releaseId) {
  const url = `${MUSICBRAINZ_API}/release/${encodeURIComponent(releaseId)}?inc=artist-credits+recordings+release-groups&fmt=json`;
  const res = await mbFetch(url);
  if (!res.ok) return null;
  return res.json();
}

/** Resolve cover art URL (follows the 307 redirect manually) */
async function getCoverUrl(rgMbid) {
  const url = `${COVER_ART_API}/release-group/${encodeURIComponent(rgMbid)}/front`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 307 || res.status === 301 || res.status === 302) {
      return res.headers.get('location') || null;
    }
    if (res.ok) return res.url;
    return null;
  } catch {
    return null;
  }
}

// ─── Main import logic ───────────────────────────────────────────────────────

async function importAlbum(title, artist) {
  // 1. Search MB for the release group
  const rg = await searchReleaseGroup(title, artist);
  if (!rg) {
    return { status: 'not_found', reason: 'No MB result' };
  }

  const rgMbid = rg.id;
  const rgTitle = rg.title;
  const rgArtist = rg['artist-credit']?.[0]?.artist?.name || artist;
  const rgArtistMbid = rg['artist-credit']?.[0]?.artist?.id;
  const rgDate = rg['first-release-date'] || null;

  if (DRY_RUN) {
    return { status: 'dry_run', rgMbid, rgTitle, rgArtist, rgDate };
  }

  // 2. Check if album already in DB
  const { data: existing } = await supabase
    .from('albums')
    .select('id')
    .eq('mbid', rgMbid)
    .maybeSingle();

  if (existing) {
    return { status: 'skipped', reason: 'Already imported', albumId: existing.id };
  }

  // 3. Get first release ID for track details
  await delay(DELAY_MS);
  const releaseId = await getFirstReleaseId(rgMbid);
  if (!releaseId) {
    return { status: 'error', reason: 'No release in release group' };
  }

  // 4. Fetch full release (tracks)
  await delay(DELAY_MS);
  const releaseData = await getReleaseDetails(releaseId);
  if (!releaseData) {
    return { status: 'error', reason: 'Could not fetch release details' };
  }

  // 5. Fetch cover art
  await delay(DELAY_MS);
  const coverUrl = await getCoverUrl(rgMbid);

  // 6. Get or create artist in Supabase
  let artistId;
  const { data: existingArtist } = await supabase
    .from('artists')
    .select('id')
    .eq('mbid', rgArtistMbid)
    .maybeSingle();

  if (existingArtist) {
    artistId = existingArtist.id;
  } else {
    artistId = randomUUID();
    const { error: artistErr } = await supabase.from('artists').insert({
      id: artistId,
      name: rgArtist,
      mbid: rgArtistMbid,
    });
    if (artistErr) {
      return { status: 'error', reason: `Artist insert failed: ${artistErr.message}` };
    }
  }

  // 7. Insert album
  const albumId = randomUUID();
  const { error: albumErr } = await supabase.from('albums').insert({
    id: albumId,
    title: rgTitle,
    artist_id: artistId,
    mbid: rgMbid,
    release_date: normalizeDate(rgDate),
    cover_url: coverUrl || null,
  });

  if (albumErr) {
    return { status: 'error', reason: `Album insert failed: ${albumErr.message}` };
  }

  // 8. Insert tracks
  const tracks = (releaseData.media || []).flatMap((m) =>
    (m.tracks || []).map((t) => ({
      id: randomUUID(),
      album_id: albumId,
      artist_id: artistId,
      title: t.title,
      track_no: t.position,
      disc_no: m.position ?? 1,
      duration_ms: t.length ?? t['track_or_recording_length'] ?? null,
      mbid: t.id,
    }))
  );

  if (tracks.length > 0) {
    const { error: tracksErr } = await supabase.from('tracks').insert(tracks);
    if (tracksErr) {
      // Rollback album
      await supabase.from('albums').delete().eq('id', albumId);
      return { status: 'error', reason: `Tracks insert failed: ${tracksErr.message}` };
    }
  }

  // 9. Insert external_ids (album + tracks)
  const extRows = [
    { entity_type: 'album', entity_id: albumId, source: 'musicbrainz', value: rgMbid },
    ...tracks.map((t) => ({
      entity_type: 'track',
      entity_id: t.id,
      source: 'musicbrainz',
      value: t.mbid,
    })),
  ];

  const { error: extErr } = await supabase.from('external_ids').insert(extRows);
  if (extErr) {
    console.warn(`  ⚠️  external_ids insert failed (non-fatal): ${extErr.message}`);
  }

  return { status: 'imported', albumId, rgTitle, rgArtist, trackCount: tracks.length, coverUrl };
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing env vars. Run with: node --env-file=.env.local scripts/bulk-import-albums.mjs');
    process.exit(1);
  }

  const albums = ALBUMS.slice(SKIP_COUNT);
  console.log(`🎵 Bulk import — ${albums.length} albums to process${DRY_RUN ? ' [DRY RUN]' : ''}${SKIP_COUNT ? ` (skipping first ${SKIP_COUNT})` : ''}\n`);

  let imported = 0, skipped = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < albums.length; i++) {
    const [title, artist] = albums[i];
    const n = SKIP_COUNT + i + 1;
    process.stdout.write(`[${n}/${ALBUMS.length}] "${title}" — ${artist} … `);

    try {
      const result = await importAlbum(title, artist);

      if (result.status === 'imported') {
        console.log(`✅ imported (${result.trackCount} tracks)${result.coverUrl ? ' 🖼' : ''}`);
        imported++;
      } else if (result.status === 'skipped') {
        console.log(`⏭  already in DB`);
        skipped++;
      } else if (result.status === 'dry_run') {
        console.log(`🔍 → "${result.rgTitle}" by ${result.rgArtist} [${result.rgMbid}] ${result.rgDate || ''}`);
        skipped++;
      } else {
        console.log(`❌ ${result.reason}`);
        failed++;
        errors.push({ title, artist, reason: result.reason });
      }
    } catch (err) {
      console.log(`💥 ${err.message}`);
      failed++;
      errors.push({ title, artist, reason: err.message });
    }

    // Respect MB rate limit (except after last item)
    if (i < albums.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`✅ Imported : ${imported}`);
  console.log(`⏭  Skipped  : ${skipped}`);
  console.log(`❌ Failed   : ${failed}`);

  if (errors.length > 0) {
    console.log('\n📋 Failed albums (for manual review):');
    for (const e of errors) {
      console.log(`  • "${e.title}" — ${e.artist} → ${e.reason}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
