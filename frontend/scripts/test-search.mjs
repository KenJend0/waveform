/**
 * Test script for MusicBrainz search queries.
 *
 * Usage:
 *   node scripts/test-search.mjs
 *   node scripts/test-search.mjs "dark side of the moon"
 *
 * Tests the exact same logic as searchMusicBrainzAlbums() in musicbrainz.ts.
 * No Supabase auth required — hits MB API directly.
 */

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const MB_RATE_LIMIT_MS = 1100; // MB allows 1 req/sec

const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live', 'Compilation', 'Remix', 'Demo',
  'Mixtape/Street', 'Spokenword', 'Interview',
  'Audiobook', 'Audio drama', 'Field recording',
]);

// ---------------------------------------------------------------------------
// Helpers (mirrors SearchOverlay.tsx)
// ---------------------------------------------------------------------------

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArticle(s) {
  return s.replace(/^(the|a|an) /, '');
}

function computeRank(title, score, source, query, releaseCount = 0) {
  const t = stripArticle(normalize(title));
  const q = stripArticle(normalize(query));
  let rank = 0;
  if (score !== undefined) rank += score * 0.8;
  if (source === 'internal') rank += 40;
  if (releaseCount) rank += Math.log2(releaseCount + 1) * 15;
  if (t === q) rank += 500;
  else if (t.startsWith(q)) rank += 200;
  else if (t.includes(q) || q.includes(t)) rank += 30;
  return rank;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// MB search (mirrors musicbrainz.ts)
// ---------------------------------------------------------------------------

async function searchMBAlbums(query) {
  const preEscape = query.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, ' ').trim();
  const originalTerms = preEscape.split(/\s+/);
  const escaped = preEscape.replace(/'/g, '').trim();
  const terms = escaped.split(/\s+/);
  // Decontract only when user typed an apostrophe: "what's" → "what", "blues" unchanged.
  const decontracted = originalTerms.map((orig, i) =>
    orig.includes("'") ? orig.replace(/'\w*$/, '') : terms[i]
  ).join(' ');
  const phraseA = `releasegroup:"${escaped}"~2`;
  const phraseB = decontracted !== escaped ? ` OR releasegroup:"${decontracted}"~2` : '';
  const termsClause = `(${terms.map((t) => `(releasegroup:${t} OR artistname:${t})`).join(' AND ')})`;
  const luceneQuery = terms.length === 1
    ? `releasegroup:${terms[0]}`
    : `${phraseA}${phraseB} OR ${termsClause}`;

  const url = new URL(`${MUSICBRAINZ_API}/release-group`);
  url.searchParams.set('query', luceneQuery);
  url.searchParams.set('limit', '100');
  url.searchParams.set('fmt', 'json');

  console.log(`  → Lucene query : ${luceneQuery}`);
  console.log(`  → URL          : ${url.toString()}\n`);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    console.error(`  ✗ MB returned HTTP ${res.status}`);
    return { raw: [], filtered: [] };
  }

  const data = await res.json();
  const raw = data['release-groups'] || [];

  // Mirror server-side pre-sort: count DESC before filtering so the
  // "MB brut" display already reflects popularity order.
  // Note: MB search uses `count`, not `release-count` (which is the browse endpoint field).
  raw.sort((a, b) => ((b['count'] || b['release-count'] || 0) - (a['count'] || a['release-count'] || 0)));

  // Multi-word queries use a lower threshold: the OR phrase+terms combination dilutes
  // scores (e.g. Marvin Gaye's "What's Going On" gets score 39 in a combined query).
  const scoreThreshold = terms.length === 1 ? 60 : 30;
  const filtered = raw.filter((rg) => {
    if ((rg.score || 0) < scoreThreshold) return false;
    const primaryType = rg['primary-type'] || '';
    if (!['Album', 'EP'].includes(primaryType)) return false;
    const secondaryTypes = rg['secondary-types'] || [];
    return !secondaryTypes.some((t) => EXCLUDED_SECONDARY_TYPES.has(t));
  });

  return { raw, filtered };
}

// ---------------------------------------------------------------------------
// MB artist search (mirrors searchMusicBrainzArtists in musicbrainz.ts)
// ---------------------------------------------------------------------------

async function searchMBArtists(query) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const luceneParts = terms.map((t, i) => {
    const esc = t.replace(/[+\-&|!(){}\[\]^"~?:\\\/]/g, '\\$&');
    return i === terms.length - 1 ? `artist:${esc}*` : `artist:${esc}`;
  });
  const luceneQuery = luceneParts.join(' AND ');

  const url = `${MUSICBRAINZ_API}/artist?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=8`;
  console.log(`  → Lucene query (artistes) : ${luceneQuery}`);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    console.error(`  ✗ MB returned HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data['artists'] || [])
    .filter((a) => (a.score || 0) >= 60)
    .slice(0, 8)
    .map((a) => ({ id: a.id, name: a.name, score: a.score || 0 }));
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';

function printRaw(rgs, limit = 5) {
  rgs.slice(0, limit).forEach((rg, i) => {
    const artist = (rg['artist-credit'] || [])
      .map((a) => a.name || a.artist?.name).join(', ');
    const pt = rg['primary-type'] || '?';
    const st = (rg['secondary-types'] || []).join(', ') || '—';
    const score = rg.score || 0;
    const rc = rg['count'] || rg['release-count'] || 0;
    const scoreColor = score >= 80 ? GREEN : score >= 60 ? YELLOW : RED;
    const rcColor = rc >= 20 ? GREEN : rc >= 5 ? YELLOW : GRAY;
    console.log(
      `    ${GRAY}${i + 1}.${RESET} ${BOLD}${rg.title}${RESET} ${GRAY}— ${artist}${RESET}` +
      `  ${DIM}[${pt}${st !== '—' ? ' / ' + st : ''}]${RESET}` +
      `  score:${scoreColor}${score}${RESET}` +
      `  releases:${rcColor}${rc}${RESET}`
    );
  });
  if (rgs.length > limit) {
    console.log(`    ${GRAY}… et ${rgs.length - limit} autres${RESET}`);
  }
}

function printFiltered(rgs, query) {
  if (rgs.length === 0) {
    console.log(`    ${RED}Aucun résultat après filtrage.${RESET}`);
    return;
  }
  const ranked = [...rgs]
    .map((rg) => {
      const artist = (rg['artist-credit'] || [])
        .map((a) => a.name || a.artist?.name).join(', ');
      const rc = rg['count'] || rg['release-count'] || 0;
      return { rg, artist, rc, rank: computeRank(rg.title, rg.score, 'musicbrainz', query, rc) };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8);

  ranked.forEach(({ rg, artist, rc, rank }, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `  ${i + 1}.`;
    const rcColor = rc >= 20 ? GREEN : rc >= 5 ? YELLOW : GRAY;
    console.log(
      `    ${medal} ${BOLD}${rg.title}${RESET} ${GRAY}— ${artist}${RESET}` +
      `  ${GRAY}${rg['first-release-date'] || ''}${RESET}` +
      `  releases:${rcColor}${rc}${RESET}` +
      `  ${DIM}rank:${Math.round(rank)}${RESET}`
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DEFAULT_QUERIES = [
  'thriller',
  "what's going on",
  'jackson',
  'dark side of the moon',
  'nevermind',
];

const queries = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : DEFAULT_QUERIES;

console.log(`\n${BOLD}${CYAN}=== Waveform Search Test ===${RESET}\n`);
console.log(`${DIM}Teste les mêmes filtres/ranking que searchMusicBrainzAlbums() + searchMusicBrainzArtists() + computeRank()${RESET}\n`);

for (let i = 0; i < queries.length; i++) {
  const query = queries[i];
  console.log(`${BOLD}${CYAN}▶ "${query}"${RESET}`);

  // Albums
  const { raw, filtered } = await searchMBAlbums(query);

  console.log(`  ${DIM}MB brut — ${raw.length} résultats (avant filtrage) :${RESET}`);
  printRaw(raw, 5);

  const excluded = raw.filter((rg) => {
    if ((rg.score || 0) < 60) return true;
    const pt = rg['primary-type'] || '';
    if (!['Album', 'EP'].includes(pt)) return true;
    const st = rg['secondary-types'] || [];
    return st.some((t) => EXCLUDED_SECONDARY_TYPES.has(t));
  });
  if (excluded.length > 0) {
    console.log(`  ${YELLOW}⚠ ${excluded.length} exclus (score<60 ou type/secondary type)${RESET}`);
  }

  console.log(`\n  ${GREEN}✓ Albums — après filtrage + ranking (top 8) :${RESET}`);
  printFiltered(filtered, query);

  // Artists (separate MB call)
  await sleep(MB_RATE_LIMIT_MS);
  const artists = await searchMBArtists(query);
  if (artists.length > 0) {
    console.log(`\n  ${CYAN}✓ Artistes — top ${artists.length} :${RESET}`);
    artists.forEach(({ name, score }, j) => {
      const medal = j === 0 ? '🥇' : j === 1 ? '🥈' : j === 2 ? '🥉' : `  ${j + 1}.`;
      const scoreColor = score >= 80 ? GREEN : score >= 60 ? YELLOW : RED;
      console.log(`    ${medal} ${BOLD}${name}${RESET}  score:${scoreColor}${score}${RESET}`);
    });
  }
  console.log();

  // Rate limit before next query
  if (i < queries.length - 1) await sleep(MB_RATE_LIMIT_MS);
}

console.log(`${BOLD}${CYAN}=== Fin des tests ===${RESET}\n`);
