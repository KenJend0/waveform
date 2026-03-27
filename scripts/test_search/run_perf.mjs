#!/usr/bin/env node
/**
 * Search performance test — mesure l'impact du cache Supabase.
 *
 * Stratégie :
 *   1. Passe FROIDE  — requêtes jamais vues, MB appelé en direct  → temps de référence
 *   2. Passe CHAUDE  — mêmes requêtes, résultats en cache          → doit être ~5ms
 *
 * La passe froide respecte le rate limit MB (2200ms entre requêtes).
 * La passe chaude n'attend que 50ms (cache hit = pas d'appel MB).
 *
 * Usage:
 *   BENCH_COOKIE="<sb-...-auth-token>" node scripts/test_search/run_perf.mjs
 *
 * Env vars:
 *   BENCH_URL    — base URL du serveur Next.js  (défaut: http://localhost:3000)
 *   BENCH_COOKIE — cookie d'authentification Supabase (obligatoire)
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BENCH_URL || "http://localhost:3000";
const SESSION_COOKIE = process.env.BENCH_COOKIE || "";

if (!SESSION_COOKIE) {
  console.error(
    "\n✗  BENCH_COOKIE obligatoire pour ce test.\n" +
    "   → Ouvre l'app dans ton navigateur, copie le cookie 'sb-...-auth-token' depuis DevTools,\n" +
    '   → puis lance : BENCH_COOKIE="<valeur>" node scripts/test_search/run_perf.mjs\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Jeu de requêtes représentatif — couvre les cas typiques sans spammer MB
// ---------------------------------------------------------------------------
const TEST_QUERIES = [
  // Artiste seul
  { q: "radiohead",          kind: "all" },
  { q: "daft punk",          kind: "all" },
  { q: "kendrick lamar",     kind: "all" },
  { q: "the weeknd",         kind: "all" },

  // Album + artiste (requête complète)
  { q: "thriller michael jackson",        kind: "albums" },
  { q: "ok computer radiohead",           kind: "albums" },
  { q: "random access memories daft punk",kind: "albums" },
  { q: "abbey road beatles",              kind: "albums" },

  // Album seul (plus ambigu)
  { q: "nevermind",          kind: "albums" },
  { q: "dark side of the moon", kind: "albums" },
  { q: "in rainbows",        kind: "albums" },
  { q: "after hours",        kind: "albums" },

  // Court / difficile
  { q: "am arctic monkeys",  kind: "albums" },
  { q: "anti rihanna",       kind: "albums" },

  // International
  { q: "stromae racine carree", kind: "albums" },
  { q: "bad bunny yhlqmdlg",    kind: "albums" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pct(v) { return `${(v * 100).toFixed(0)}%`; }
function ms(v)  { return `${Math.round(v)}ms`; }

function stats(arr) {
  if (!arr.length) return { avg: 0, p50: 0, p95: 0, min: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { avg, p50, p95, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function runQuery(q, kind) {
  const url = `${BASE_URL}/api/search/bench?q=${encodeURIComponent(q)}&kind=${kind}`;
  const t0 = Date.now();
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { Cookie: SESSION_COOKIE },
  });
  const elapsed = Date.now() - t0;
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${body.slice(0, 120)}`);
  }
  const data = await resp.json();
  return {
    roundtrip_ms: elapsed,
    server_ms: data.timing_ms ?? elapsed,
    mb_count: (data.mb_albums_raw || []).length + (data.mb_artists_raw || []).length,
    internal_count: (data.internal_raw || []).length,
    merged_count: (data.merged || []).length,
    mb_error: data.mb_error ?? null,
  };
}

/** Diagnostic: run one query and dump the full bench response */
async function diagnose() {
  const { q, kind } = TEST_QUERIES[0]; // "radiohead" (all)
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  DIAGNOSTIC — requête test : "${q}" (${kind})`);
  console.log(`${"─".repeat(60)}`);
  try {
    const url = `${BASE_URL}/api/search/bench?q=${encodeURIComponent(q)}&kind=${kind}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Cookie: SESSION_COOKIE },
    });
    if (!resp.ok) {
      console.log(`  ✗ HTTP ${resp.status}`);
      return false;
    }
    const data = await resp.json();
    const mbAlbums = data.mb_albums_raw || [];
    const mbArtists = data.mb_artists_raw || [];
    const internal = data.internal_raw || [];
    const merged = data.merged || [];
    console.log(`  internal     : ${internal.length} résultats`);
    console.log(`  mb_albums    : ${mbAlbums.length} résultats`);
    console.log(`  mb_artists   : ${mbArtists.length} résultats`);
    console.log(`  merged       : ${merged.length} résultats`);
    console.log(`  timing_ms    : ${data.timing_ms}ms`);
    if (mbAlbums.length === 0 && mbArtists.length === 0) {
      console.log(`\n  ⚠  MB renvoie 0 résultats — causes possibles :`);
      console.log(`     1. Cookie expiré (not_authenticated) → vérifier Next.js console`);
      console.log(`     2. MB rate-limit (429) après la passe précédente → attendre 30s`);
      console.log(`     3. MB API down → vérifier https://musicbrainz.org`);
      console.log(`\n  → Tip : cherche "[bench] searchMusicBrainzAlbums failed" dans la console Next.js\n`);
      return false;
    }
    console.log(`  ✓ MB répond correctement\n`);
    return true;
  } catch (err) {
    console.log(`  ✗ Erreur : ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runPass(label, queries, delayMs) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  PASSE ${label.toUpperCase()} (délai entre requêtes : ${delayMs}ms)`);
  console.log(`${"─".repeat(60)}`);

  const results = [];
  for (let i = 0; i < queries.length; i++) {
    const { q, kind } = queries[i];
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${queries.length}] "${q}" (${kind}) ... `);
    try {
      const r = await runQuery(q, kind);
      results.push({ q, kind, ...r, error: null });
      console.log(`roundtrip=${ms(r.roundtrip_ms)}  server=${ms(r.server_ms)}  internal=${r.internal_count}  mb=${r.mb_count}  merged=${r.merged_count}`);
    } catch (err) {
      results.push({ q, kind, roundtrip_ms: 9999, server_ms: 9999, mb_count: 0, merged_count: 0, error: err.message });
      console.log(`ERREUR — ${err.message}`);
    }
    if (i < queries.length - 1) await sleep(delayMs);
  }
  return results;
}

async function main() {
  console.log(`\nURL : ${BASE_URL}`);
  console.log(`Requêtes : ${TEST_QUERIES.length}`);

  // Diagnostic préliminaire — vérifie que MB répond avant de lancer 32+ requêtes
  const mbOk = await diagnose();
  if (!mbOk) {
    console.log("  Test annulé — corriger le problème MB avant de relancer.\n");
    process.exit(1);
  }

  // Passe 1 : froide (respecte MB rate limit)
  const cold = await runPass("froide", TEST_QUERIES, 2200);

  // Petite pause entre les deux passes
  console.log("\n  ... pause 3s avant la passe chaude ...");
  await sleep(3000);

  // Passe 2 : chaude (cache hits → pas d'appel MB → pas besoin d'attendre)
  const warm = await runPass("chaude", TEST_QUERIES, 150);

  // ---------------------------------------------------------------------------
  // Rapport
  // ---------------------------------------------------------------------------
  const coldOk   = cold.filter((r) => !r.error);
  const warmOk   = warm.filter((r) => !r.error);
  const errors   = [...cold, ...warm].filter((r) => r.error);

  const coldStats = stats(coldOk.map((r) => r.roundtrip_ms));
  const warmStats = stats(warmOk.map((r) => r.roundtrip_ms));
  const speedup   = coldStats.avg > 0 ? (coldStats.avg / Math.max(warmStats.avg, 1)) : 0;

  // Par requête — comparaison froide vs chaude
  console.log(`\n${"═".repeat(70)}`);
  console.log("  COMPARAISON PAR REQUÊTE  (roundtrip ms)");
  console.log(`${"═".repeat(70)}`);
  console.log(`  ${"Requête".padEnd(36)} ${"Froide".padStart(7)} ${"Chaude".padStart(7)}  Gain`);
  console.log(`  ${"─".repeat(62)}`);
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const c = cold[i];
    const w = warm[i];
    if (c.error || w.error) {
      console.log(`  ${c.q.slice(0, 34).padEnd(36)} ${"ERR".padStart(7)} ${"ERR".padStart(7)}`);
      continue;
    }
    const gainPct = c.roundtrip_ms > 0
      ? Math.round((1 - w.roundtrip_ms / c.roundtrip_ms) * 100)
      : 0;
    const gainStr = gainPct > 0 ? `-${gainPct}%` : gainPct < 0 ? `+${Math.abs(gainPct)}%` : "=";
    console.log(`  ${c.q.slice(0, 34).padEnd(36)} ${ms(c.roundtrip_ms).padStart(7)} ${ms(w.roundtrip_ms).padStart(7)}  ${gainStr}`);
  }

  // Métriques globales
  console.log(`\n${"═".repeat(70)}`);
  console.log("  MÉTRIQUES GLOBALES");
  console.log(`${"═".repeat(70)}`);

  function printStats(label, s) {
    console.log(
      `  ${label.padEnd(10)} avg=${ms(s.avg).padStart(6)}  p50=${ms(s.p50).padStart(6)}  p95=${ms(s.p95).padStart(6)}  min=${ms(s.min).padStart(6)}  max=${ms(s.max).padStart(6)}`
    );
  }

  printStats("Froide", coldStats);
  printStats("Chaude", warmStats);
  if (speedup >= 1.1) {
    console.log(`\n  Accélération passe chaude : ×${speedup.toFixed(1)}  (${ms(coldStats.avg)} → ${ms(warmStats.avg)})`);
  } else {
    console.log(`\n  Passe froide ≈ chaude (${ms(coldStats.avg)} → ${ms(warmStats.avg)})`);
    console.log(`  ⓘ  Depuis localhost, le RTT Supabase (~250ms) ≈ RTT MB API (~200ms).`);
    console.log(`     En production (Vercel → Supabase même région), le cache lit en ~15ms`);
    console.log(`     vs ~300ms pour MB → accélération ×10-20 attendue sur la passe chaude.`);
  }

  if (errors.length > 0) {
    console.log(`\n  ${errors.length} erreur(s) :`);
    errors.forEach((r) => console.log(`    "${r.q}" — ${r.error}`));
  }

  console.log(`${"═".repeat(70)}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
