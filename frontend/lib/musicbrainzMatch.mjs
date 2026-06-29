/**
 * Logique de matching artiste/titre pour les imports externes (Last.fm/RYM) — partagée
 * entre l'app Next.js (frontend/lib/externalImport.ts, polling côté client) et le script
 * cron autonome (frontend/scripts/process-external-imports.mjs, qui ne peut pas importer
 * les Server Actions Next.js car elles dépendent de cookies()/getAuthUser()).
 *
 * Module pur (aucune dépendance Next.js/Supabase) — fichier .mjs plutôt que .ts pour être
 * importable tel quel par le script cron exécuté via `node` sans étape de build, tout en
 * restant importable depuis le code TypeScript de l'app (allowJs activé dans tsconfig).
 *
 * La mécanique HTTP (fetch MusicBrainz, retry, cache) reste à la charge de chaque
 * appelant — ce module ne fait que construire les requêtes et choisir le meilleur candidat.
 */

export function normalizeForMatch(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Comparaison plus tolérante que normalizeForMatch : ignore aussi la ponctuation
 * ("Hotel + Casino" vs "Hotel & Casino", apostrophes, deux-points...).
 */
export function looseNormalize(s) {
  // \p{L}/\p{N} (Unicode letter/number), not [a-z0-9] — the ASCII-only range
  // strips every character of a non-Latin title (Japanese, Arabic, Cyrillic...),
  // collapsing it to empty and making isArtistMatch/pickCandidate falsely
  // match any two non-Latin titles by the same artist as identical.
  return normalizeForMatch(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Compare deux noms d'artiste en tolérant des variantes mineures (ordre, article).
 * La containment seule est trop permissive : "Kanye West Tribute Band" contient
 * "Kanye West" en sous-chaîne sans être le même artiste — on exige donc que les
 * deux chaînes restent de longueur comparable (au moins 65% l'une de l'autre).
 * Utilisé pour le candidat "fuzzy" (score MB élevé mais titre pas exactement identique).
 */
export function isArtistMatch(a, b) {
  const na = looseNormalize(a);
  const nb = looseNormalize(b);
  if (na === nb) return true;
  if (!na || !nb) return false;
  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length >= nb.length ? nb : na;
  return longer.includes(shorter) && shorter.length / longer.length >= 0.65;
}

/**
 * Variante tolérante pour les cas où le titre matche déjà exactement : RYM/Last.fm
 * combinent souvent plusieurs artistes ("Freddie Gibbs & The Alchemist") alors que
 * MusicBrainz ne crédite parfois que l'artiste principal ("Freddie Gibbs") — le ratio
 * strict de isArtistMatch() rejette alors un match pourtant correct. Comme le titre
 * exact est déjà un signal fort, un simple recoupement de mots significatifs suffit.
 */
export function hasArtistTokenOverlap(a, b) {
  const ta = new Set(significantWordsOf(a).map((w) => w.toLowerCase()));
  const tb = new Set(significantWordsOf(b).map((w) => w.toLowerCase()));
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

export const NON_ORIGINAL_TITLE_PATTERN =
  /\b(tribute|karaoke|in the style of|originally performed|lullaby renditions|cover versions?)\b/i;

export function escapeLucene(str) {
  return str.replace(/["\\]/g, '\\$&');
}

export function wordsOf(s) {
  return s
    .replace(/[+\-&|!(){}\[\]^~*?:\\\/]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Stopwords courants probablement filtrés par l'analyseur d'index MusicBrainz — les exiger
// en clause AND obligatoire peut faire échouer toute la requête ("The College Dropout").
export const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'is', 'it']);

export function significantWordsOf(s) {
  const all = wordsOf(s);
  const filtered = all.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  return filtered.length > 0 ? filtered : all;
}

// Phrase exacte — la plus précise. Pour les artistes très prolifiques (mixtapes, bootlegs,
// hommages...) une requête par mots-clés peut être noyée par du bruit dans le top des
// résultats MB ; la phrase stricte évite ce problème quand le crédit correspond mot pour mot.
export function buildExactPhraseQuery(artist, album) {
  return `artist:"${escapeLucene(artist)}" AND releasegroup:"${escapeLucene(album)}"`;
}

// Clause par mots-clés (chaque mot requis dans releasegroup OU artistname) — tolère la
// ponctuation ("Either / Or" vs "Either/Or") contrairement à un match de phrase exacte.
export function buildCrossFieldQuery(artist, album) {
  const words = [...new Set([...significantWordsOf(artist), ...significantWordsOf(album)])];
  if (words.length === 0) return null;
  return words.map((w) => `(releasegroup:"${escapeLucene(w)}" OR artistname:"${escapeLucene(w)}")`).join(' AND ');
}

// Repli titre seul : utile quand le champ artiste contient des mentions ("Featuring X",
// "& Y") qui n'apparaissent pas dans le crédit MusicBrainz exact — pickCandidate() filtre
// ensuite les faux positifs sur les candidats retournés.
export function buildTitleOnlyQuery(album) {
  const words = significantWordsOf(album);
  if (words.length === 0) return null;
  return words.map((w) => `releasegroup:"${escapeLucene(w)}"`).join(' AND ');
}

// Sous-titres parenthétiques ("(Bande originale du film)", "(Deluxe Edition)") rarement
// présents tels quels dans le titre MusicBrainz.
export function stripParenthetical(album) {
  return album.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Sélectionne le meilleur candidat parmi des résultats MusicBrainz release-group, ou null. */
export function pickCandidate(results, item) {
  const exact = results.find(
    (r) => looseNormalize(r.title) === looseNormalize(item.album) && hasArtistTokenOverlap(r.artistName, item.artist)
  );
  if (exact) return exact;

  const fuzzy = results.find(
    (r) => r.score >= 90 && isArtistMatch(r.artistName, item.artist) && !NON_ORIGINAL_TITLE_PATTERN.test(r.title)
  );
  return fuzzy || null;
}

/**
 * Cascade de requêtes MusicBrainz, de la plus précise à la plus tolérante : phrase
 * exacte → mots-clés croisés artiste+titre → titre seul → titre sans sous-titre
 * parenthétique. `runQuery(queryString)` doit retourner un tableau de candidats
 * `{id, title, artistName, score}` (ou []) — la mécanique HTTP (fetch, retry, cache)
 * reste à la charge de l'appelant.
 */
export async function searchReleaseGroupCascade(runQuery, artist, album, { delayMs = 0 } = {}) {
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve());

  const exactPhrase = await runQuery(buildExactPhraseQuery(artist, album));
  if (exactPhrase.length > 0) return exactPhrase;

  await wait();
  const combined = await runQuery(buildCrossFieldQuery(artist, album));
  if (combined.length > 0) return combined;

  await wait();
  const titleOnly = await runQuery(buildTitleOnlyQuery(album));
  if (titleOnly.length > 0) return titleOnly;

  const withoutParens = stripParenthetical(album);
  if (withoutParens && withoutParens !== album) {
    await wait();
    return runQuery(buildTitleOnlyQuery(withoutParens));
  }
  return [];
}
