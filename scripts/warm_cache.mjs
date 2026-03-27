#!/usr/bin/env node
/**
 * Cache warm-up — pré-remplit le cache Supabase (et mémoire) pour les requêtes les plus
 * fréquentes. À lancer après un déploiement ou via cron (ex: toutes les 12h).
 *
 * Usage:
 *   BENCH_COOKIE="<sb-...-auth-token>" node scripts/warm_cache.mjs
 *
 * Env vars:
 *   BENCH_URL    — base URL du serveur  (défaut: http://localhost:3000)
 *   BENCH_COOKIE — cookie d'auth Supabase (obligatoire)
 *   WARM_DELAY   — délai entre requêtes en ms (défaut: 2200, respecte MB rate limit)
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BENCH_URL || "http://localhost:3000";
const SESSION_COOKIE = process.env.BENCH_COOKIE || "";
const DELAY_MS = parseInt(process.env.WARM_DELAY || "2200");

if (!SESSION_COOKIE) {
  console.error(
    "\n✗  BENCH_COOKIE obligatoire.\n" +
    '   → BENCH_COOKIE="<valeur>" node scripts/warm_cache.mjs\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Requêtes à préchauffer — couvrent les artistes/albums les plus recherchés
// ---------------------------------------------------------------------------
const WARM_QUERIES = [
  // Artistes globaux très populaires
  { q: "taylor swift",    kind: "all" },
  { q: "beyonce",         kind: "all" },
  { q: "drake",           kind: "all" },
  { q: "kanye west",      kind: "all" },
  { q: "eminem",          kind: "all" },
  { q: "rihanna",         kind: "all" },
  { q: "adele",           kind: "all" },
  { q: "radiohead",       kind: "all" },
  { q: "daft punk",       kind: "all" },
  { q: "kendrick lamar",  kind: "all" },
  { q: "the weeknd",      kind: "all" },
  { q: "arctic monkeys",  kind: "all" },
  { q: "nirvana",         kind: "all" },
  { q: "metallica",       kind: "all" },
  { q: "pink floyd",      kind: "all" },
  { q: "the beatles",     kind: "all" },

  // Albums iconiques (album seul)
  { q: "thriller",                  kind: "albums" },
  { q: "ok computer",               kind: "albums" },
  { q: "dark side of the moon",     kind: "albums" },
  { q: "nevermind",                 kind: "albums" },
  { q: "abbey road",                kind: "albums" },
  { q: "random access memories",    kind: "albums" },
  { q: "in rainbows",               kind: "albums" },
  { q: "good kid maad city",        kind: "albums" },
  { q: "after hours",               kind: "albums" },
  { q: "anti",                      kind: "albums" },

  // Requêtes album+artiste (les plus précises)
  { q: "thriller michael jackson",        kind: "albums" },
  { q: "ok computer radiohead",           kind: "albums" },
  { q: "random access memories daft punk",kind: "albums" },
  { q: "abbey road beatles",              kind: "albums" },
  { q: "dark side of the moon pink floyd",kind: "albums" },
  { q: "nevermind nirvana",               kind: "albums" },

  // International
  { q: "bad bunny",       kind: "all" },
  { q: "rosalia",         kind: "all" },
  { q: "stromae",         kind: "all" },
  { q: "wizkid",          kind: "all" },
  { q: "burna boy",       kind: "all" },
];

// ---------------------------------------------------------------------------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function warmOne(q, kind) {
  const url = `${BASE_URL}/api/search/bench?q=${encodeURIComponent(q)}&kind=${kind}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { Cookie: SESSION_COOKIE },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return {
    mb: (data.mb_albums_raw || []).length + (data.mb_artists_raw || []).length,
    timing: data.timing_ms,
  };
}

async function main() {
  console.log(`\nWarm-up cache — ${WARM_QUERIES.length} requêtes`);
  console.log(`URL : ${BASE_URL}  |  Délai : ${DELAY_MS}ms\n`);

  let ok = 0;
  let errors = 0;

  for (let i = 0; i < WARM_QUERIES.length; i++) {
    const { q, kind } = WARM_QUERIES[i];
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${WARM_QUERIES.length}] "${q}" ... `);
    try {
      const r = await warmOne(q, kind);
      console.log(`✓  mb=${r.mb}  ${r.timing}ms`);
      ok++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
      errors++;
    }
    if (i < WARM_QUERIES.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n  ✓ ${ok} requêtes mises en cache`);
  if (errors > 0) console.log(`  ✗ ${errors} erreurs`);
  console.log(`  → Prochaine exécution recommandée : dans 12h\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
