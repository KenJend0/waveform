#!/usr/bin/env node
/**
 * Search bench — lit test_data.csv, appelle /api/search/bench, calcule les métriques.
 *
 * Usage:
 *   node scripts/test_search/run_bench.mjs
 *
 * Env vars:
 *   BENCH_URL   — base URL du serveur Next.js  (défaut: http://localhost:3000)
 *   BENCH_DELAY — délai en ms entre requêtes    (défaut: 2200, respecte MB rate limit)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BENCH_URL || "http://localhost:3000";
const DELAY_MS = parseInt(process.env.BENCH_DELAY || "2200");
const SESSION_COOKIE = process.env.BENCH_COOKIE || "";

if (!SESSION_COOKIE) {
  console.warn(
    "\n⚠  BENCH_COOKIE non défini — les appels MusicBrainz vont échouer (not_authenticated).\n" +
    "   → Ouvre l'app dans ton navigateur, copie le cookie 'sb-...-auth-token' depuis DevTools,\n" +
    '   → puis lance : BENCH_COOKIE="<valeur>" node scripts/test_search/run_bench.mjs\n'
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** kind à utiliser pour l'API en fonction du type de requête CSV */
function getKind(type) {
  if (type === "artist") return "artists";
  if (type === "ambiguous") return "all";
  return "albums"; // album, album+artist, track_like, typo, punctuation, short
}

/**
 * Vérifie que eArtist apparaît comme mot(s) complet(s) dans a (ou vice versa).
 * Empêche "queen" de matcher "queensryche" (pas de word-boundary après "queen").
 */
function artistWordMatch(a, eArtist) {
  if (!eArtist) return true;
  if (!a) return true;  // subtitle vide = pas d'info artiste → accepte
  if (a === eArtist) return true;
  return (
    a.startsWith(eArtist + " ") ||
    a.endsWith(" " + eArtist) ||
    a.includes(" " + eArtist + " ") ||
    eArtist.startsWith(a + " ") ||
    eArtist.endsWith(" " + a) ||
    eArtist.includes(" " + a + " ")
  );
}

/**
 * Trouve le rang (1-based) du résultat attendu dans la liste merged.
 * - Pour les artistes (kind=artists) : EXACT seulement — évite "Kanye West & Hatsune Miku"
 *   de compter comme "Kanye West".
 * - Pour les albums : title contains bidirectionnel + artist word-boundary.
 *   Empêche "queen" de matcher "queensryche".
 */
function findRank(merged, expectedTitle, expectedArtist, kind) {
  const eTitle = normalize(expectedTitle);
  const eArtist = normalize(expectedArtist || "");
  for (let i = 0; i < merged.length; i++) {
    const t = normalize(merged[i].title);
    const a = normalize(merged[i].subtitle || "");
    let titleMatch;
    if (kind === "artists") {
      titleMatch = t === eTitle;  // exact only — no starts-with after symbol stripping
    } else {
      titleMatch = t.includes(eTitle) || eTitle.includes(t);
    }
    const artistMatch = artistWordMatch(a, eArtist);
    if (titleMatch && artistMatch) return i + 1;
  }
  return 999;
}

/**
 * Rang si on triait uniquement par score MB brut (sans ranking custom).
 * Permet de comparer si le custom ranking aide ou nuit.
 */
function findRankMBOnly(mbAlbumsRaw, expectedTitle, expectedArtist) {
  if (!mbAlbumsRaw || mbAlbumsRaw.length === 0) return 999;
  const sorted = [...mbAlbumsRaw].sort((a, b) => (b.score || 0) - (a.score || 0));
  const eTitle = normalize(expectedTitle);
  const eArtist = normalize(expectedArtist || "");
  for (let i = 0; i < sorted.length; i++) {
    const t = normalize(sorted[i].title);
    const a = normalize(sorted[i].artistName || "");
    const titleMatch = t.includes(eTitle) || eTitle.includes(t);
    const artistMatch = !eArtist || a.includes(eArtist) || eArtist.includes(a);
    if (titleMatch && artistMatch) return i + 1;
  }
  return 999;
}

// ---------------------------------------------------------------------------
// CSV parser RFC 4180 (gère les champs entre guillemets avec virgules internes)
// ---------------------------------------------------------------------------
function parseCSVLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++; // skip comma after field
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      } else {
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
  }
  return fields;
}

function parseCSV(content) {
  const lines = content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  return lines
    .slice(1)
    .map((line) => {
      const parts = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => (row[h] = (parts[i] || "").trim()));
      return row;
    })
    .filter((r) => r.query && !r.query.startsWith("#"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const csvPath = path.join(__dirname, "test_data.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`Fichier CSV introuvable : ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf-8"));
  console.log(`\n${rows.length} requêtes chargées depuis ${csvPath}`);
  console.log(`URL : ${BASE_URL}  |  Délai entre requêtes : ${DELAY_MS}ms\n`);

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const { query, expected_title, expected_artist, type, eval_mode = "core" } = rows[i];
    const kind = getKind(type);

    process.stdout.write(`[${String(i + 1).padStart(2)}/${rows.length}] "${query}" (${type}) ... `);

    let data;
    try {
      const url = `${BASE_URL}/api/search/bench?q=${encodeURIComponent(query)}&kind=${kind}`;
      const headers = SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {};
      const resp = await fetch(url, { signal: AbortSignal.timeout(30000), headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 120)}`);
      }
      data = await resp.json();
    } catch (err) {
      console.log(`ERREUR — ${err.message}`);
      results.push({
        query, type, eval_mode, expected_title, expected_artist,
        rank: 999, rank_mb_only: "",
        top1_title: "", top1_artist: "", top1_source: "", top1_final_score: "",
        found_title: "", found_mb_score: "", found_release_count: "", found_final_score: "",
        internal_count: "", mb_album_count: "", timing_ms: "",
        error: err.message,
      });
      if (i < rows.length - 1) await sleep(DELAY_MS);
      continue;
    }

    const merged = data.merged || [];
    const rank = findRank(merged, expected_title, expected_artist, kind);
    const rankMBOnly = kind !== "artists"
      ? findRankMBOnly(data.mb_albums_raw, expected_title, expected_artist)
      : "";

    const top1 = merged[0] || null;
    const found = rank < 999 ? merged[rank - 1] : null;

    const rankLabel = rank === 999 ? "NOT FOUND" : String(rank);
    const mbLabel = rankMBOnly === "" ? "-" : rankMBOnly === 999 ? "NOT FOUND" : String(rankMBOnly);
    console.log(`rank=${rankLabel}  mb_only=${mbLabel}  top1="${top1?.title || "—"}"`);

    results.push({
      query, type, eval_mode, expected_title, expected_artist,
      rank,
      rank_mb_only: rankMBOnly,
      top1_title: top1?.title || "",
      top1_artist: top1?.subtitle || "",
      top1_source: top1?.source || "",
      top1_final_score: top1?.final_score ?? "",
      found_title: found?.title || "",
      found_mb_score: found?.mb_score ?? "",
      found_release_count: found?.release_count ?? "",
      found_final_score: found?.final_score ?? "",
      internal_count: (data.internal_raw || []).length,
      mb_album_count: (data.mb_albums_raw || []).length,
      timing_ms: data.timing_ms || "",
      error: "",
    });

    if (i < rows.length - 1) await sleep(DELAY_MS);
  }

  // ---------------------------------------------------------------------------
  // Écrire results.csv
  // ---------------------------------------------------------------------------
  const resultsPath = path.join(__dirname, "results.csv");
  const headers = [
    "query", "type", "eval_mode", "expected_title", "expected_artist",
    "rank", "rank_mb_only",
    "top1_title", "top1_artist", "top1_source", "top1_final_score",
    "found_title", "found_mb_score", "found_release_count", "found_final_score",
    "internal_count", "mb_album_count", "timing_ms", "error",
  ];
  const csvLines = [
    headers.join(","),
    ...results.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? "");
        return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",")
    ),
  ];
  fs.writeFileSync(resultsPath, csvLines.join("\n"), "utf-8");
  console.log(`\nRésultats écrits dans ${resultsPath}`);

  // ---------------------------------------------------------------------------
  // Métriques
  // ---------------------------------------------------------------------------
  const valid = results.filter((r) => !r.error);
  const n = valid.length;
  if (n === 0) { console.log("\nAucun résultat valide."); return; }

  function calcMetrics(rows) {
    const nn = rows.length;
    if (nn === 0) return null;
    return {
      n: nn,
      p1: rows.filter((r) => r.rank === 1).length / nn,
      p3: rows.filter((r) => r.rank <= 3).length / nn,
      r10: rows.filter((r) => r.rank <= 10).length / nn,
      mrr: rows.reduce((s, r) => s + (r.rank < 999 ? 1 / r.rank : 0), 0) / nn,
    };
  }

  const all = calcMetrics(valid);
  const core = calcMetrics(valid.filter((r) => r.eval_mode === "core"));
  const ambiguous = calcMetrics(valid.filter((r) => r.eval_mode === "ambiguous"));
  const outOfScope = calcMetrics(valid.filter((r) => r.eval_mode === "out_of_scope"));

  function printMetrics(label, m) {
    if (!m) return;
    console.log(`  ${label.padEnd(18)} n=${String(m.n).padStart(2)}  P@1=${pct(m.p1)}  P@3=${pct(m.p3)}  R@10=${pct(m.r10)}  MRR=${m.mrr.toFixed(3)}`);
  }

  console.log("\n" + "═".repeat(70));
  console.log("  MÉTRIQUES PAR eval_mode");
  console.log("═".repeat(70));
  printMetrics("ALL", all);
  console.log("  " + "─".repeat(66));
  printMetrics("core (produit)", core);
  printMetrics("ambiguous", ambiguous);
  printMetrics("out_of_scope", outOfScope);

  // Par type
  const byType = {};
  for (const r of valid) {
    if (!byType[r.type]) byType[r.type] = { n: 0, p1: 0, r10: 0, mrr: 0 };
    byType[r.type].n++;
    if (r.rank === 1) byType[r.type].p1++;
    if (r.rank <= 10) byType[r.type].r10++;
    byType[r.type].mrr += r.rank < 999 ? 1 / r.rank : 0;
  }

  console.log("\n" + "─".repeat(70));
  console.log("  BREAKDOWN PAR TYPE");
  console.log("─".repeat(70));
  for (const [type, s] of Object.entries(byType)) {
    console.log(
      `  ${type.padEnd(16)} n=${s.n}  P@1=${pct(s.p1/s.n)}  R@10=${pct(s.r10/s.n)}  MRR=${(s.mrr/s.n).toFixed(2)}`
    );
  }

  // Echecs critiques
  const notFound = valid.filter((r) => r.rank === 999);
  console.log("\n" + "─".repeat(60));
  console.log(`  ÉCHECS CRITIQUES (introuvable dans top 15) — ${notFound.length} cas`);
  console.log("─".repeat(60));
  if (notFound.length === 0) {
    console.log("  Aucun !");
  } else {
    notFound.forEach((r) =>
      console.log(`  [${r.type}] "${r.query}" → attendu: "${r.expected_title}"${r.expected_artist ? " / " + r.expected_artist : ""}`)
    );
  }

  // Rang > 1
  const badRank = valid.filter((r) => r.rank > 1 && r.rank < 999);
  console.log("\n" + "─".repeat(60));
  console.log(`  RANG > 1 — ${badRank.length} cas (worst first)`);
  console.log("─".repeat(60));
  if (badRank.length === 0) {
    console.log("  Aucun !");
  } else {
    badRank
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 15)
      .forEach((r) =>
        console.log(`  rank=${r.rank} [${r.type}] "${r.query}" | top1: "${r.top1_title}" | attendu: "${r.expected_title}"`)
      );
  }

  // Custom ranking vs MB brut
  const albumRows = valid.filter((r) => r.rank_mb_only !== "" && r.rank_mb_only !== 999 && r.rank !== 999);
  const customWins = albumRows.filter((r) => r.rank < r.rank_mb_only).length;
  const mbWins = albumRows.filter((r) => Number(r.rank_mb_only) < r.rank).length;
  const ties = albumRows.filter((r) => r.rank === Number(r.rank_mb_only)).length;
  console.log("\n" + "─".repeat(60));
  console.log("  CUSTOM RANKING vs MB SCORE SEUL (albums, hors NOT FOUND)");
  console.log("─".repeat(60));
  console.log(`  Custom meilleur : ${customWins}  |  MB seul meilleur : ${mbWins}  |  Égalité : ${ties}`);
  if (mbWins > 0) {
    console.log("\n  Cas où MB seul est meilleur :");
    albumRows
      .filter((r) => Number(r.rank_mb_only) < r.rank)
      .forEach((r) =>
        console.log(`    [${r.type}] "${r.query}" → custom rank=${r.rank}, mb_only rank=${r.rank_mb_only}`)
      );
  }
  console.log("═".repeat(60) + "\n");
}

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

main().catch((err) => { console.error(err); process.exit(1); });
