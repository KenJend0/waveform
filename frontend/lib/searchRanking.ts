import type { SearchResultUI } from "@/app/actions/search";

const TRIBUTE_KEYWORDS = ["tribute", "karaoke", "backing track", "made famous", "originally performed"];

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripArticle(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}

export function computeRank(item: SearchResultUI, query: string): number {
  const t = stripArticle(normalize(item.title));
  const q = stripArticle(normalize(query));
  const artistStr = normalize(item.subtitle || "");
  let rank = 0;

  if (TRIBUTE_KEYWORDS.some((k) => t.includes(k) || artistStr.includes(k))) rank -= 150;

  const versionSuffix = /[\(\[]\s*(?:live|remix|acoustic|session|demo|version)\s*[\)\]]/i;
  if (versionSuffix.test(item.title) && !versionSuffix.test(query)) rank -= 120;

  if (artistStr && q.includes(artistStr)) rank += 80;
  else if (artistStr && artistStr.includes(q)) rank += 20;

  let textScore = 0;
  if (t === q) { textScore = 300; rank += Math.min((item.score ?? 0) * 0.8, 20); }
  else if (t.startsWith(q)) { textScore = 150; rank += Math.min((item.score ?? 0) * 0.8, 40); }
  else if (t.includes(q) || q.includes(t)) { textScore = 50; rank += (item.score ?? 0) * 0.8; }
  else { rank += (item.score ?? 0) * 0.8; }
  rank += textScore;

  if (item.source === "internal") rank += 120;

  const effectiveReleaseCount = item.releaseCount ?? (item.source === "internal" ? 50 : 0);
  if (effectiveReleaseCount > 0) rank += Math.min(Math.log2(effectiveReleaseCount + 1) * 12, 80);

  return rank;
}

export function mergeAndRank(
  internal: SearchResultUI[],
  external: SearchResultUI[],
  query: string,
  limit: number
): SearchResultUI[] {
  const internalIds = new Set(internal.map((r) => r.id));

  const internalAlbumKeys = new Set(
    internal
      .filter((r) => r.kind === "album")
      .map((r) => `${r.title.toLowerCase()}|||${(r.subtitle || "").toLowerCase()}`)
  );
  const internalArtistNames = new Set(
    internal
      .filter((r) => r.kind === "artist")
      .map((r) => r.title.toLowerCase().trim())
  );
  const internalTrackKeys = new Set(
    internal
      .filter((r) => r.kind === "track")
      .map((r) => {
        const artist = (r.subtitle || "").split(" · ")[0].toLowerCase().trim();
        return `${r.title.toLowerCase().trim()}|||${artist}`;
      })
  );

  const dedupedExternal = external.filter((ext) => {
    if (internalIds.has(ext.id)) return false;
    if (ext.kind === "album") {
      const key = `${ext.title.toLowerCase()}|||${(ext.subtitle || "").toLowerCase()}`;
      if (internalAlbumKeys.has(key)) return false;
    }
    if (ext.kind === "artist") {
      if (internalArtistNames.has(ext.title.toLowerCase().trim())) return false;
    }
    if (ext.kind === "track") {
      const artist = (ext.subtitle || "").split(" · ")[0].toLowerCase().trim();
      const key = `${ext.title.toLowerCase().trim()}|||${artist}`;
      if (internalTrackKeys.has(key)) return false;
    }
    return true;
  });

  return [...internal, ...dedupedExternal]
    .sort((a, b) => computeRank(b, query) - computeRank(a, query))
    .slice(0, limit);
}
