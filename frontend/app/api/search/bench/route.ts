import { NextRequest, NextResponse } from "next/server";
import { searchInternal } from "@/app/actions/search";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists } from "@/app/actions/musicbrainz";
import type { SearchResultUI } from "@/app/actions/search";
import { applyRateLimit } from "@/lib/serverRateLimit";

// ---------------------------------------------------------------------------
// Ranking logic — kept in sync with SearchOverlay.tsx (computeRank / mergeAndRank)
// ---------------------------------------------------------------------------

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArticle(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}

type ScoreBreakdown = {
  mb: number;
  internal_bonus: number;
  popularity: number;
  text: number;
  total: number;
};

const TRIBUTE_KEYWORDS = ["tribute", "karaoke", "backing track", "made famous", "originally performed"];

const VERSION_SUFFIX = /[\(\[]\s*(?:live|remix|acoustic|session|demo|version)\s*[\)\]]/i;

function computeRankDebug(item: SearchResultUI, query: string): ScoreBreakdown {
  const t = stripArticle(normalize(item.title));
  const q = stripArticle(normalize(query));
  const artistStr = normalize(item.subtitle || "");

  const tribute_penalty = TRIBUTE_KEYWORDS.some((k) => t.includes(k) || artistStr.includes(k)) ? -150 : 0;
  const version_penalty = VERSION_SUFFIX.test(item.title) && !VERSION_SUFFIX.test(query) ? -120 : 0;

  let mb = 0;
  let text = 0;
  if (t === q) { text = 300; mb = Math.min((item.score ?? 0) * 0.8, 20); }
  else if (t.startsWith(q)) { text = 150; mb = Math.min((item.score ?? 0) * 0.8, 40); }
  else if (t.includes(q) || q.includes(t)) { text = 50; mb = (item.score ?? 0) * 0.8; }
  else { mb = (item.score ?? 0) * 0.8; }

  const artist_bonus = artistStr && q.includes(artistStr) ? 80 : (artistStr && artistStr.includes(q) ? 20 : 0);
  const internal_bonus = item.source === "internal" ? 120 : 0;
  const effectiveReleaseCount = item.releaseCount ?? (item.source === "internal" ? 50 : 0);
  const popularity = effectiveReleaseCount > 0 ? Math.min(Math.log2(effectiveReleaseCount + 1) * 12, 80) : 0;

  return { mb, internal_bonus, popularity, text, total: mb + internal_bonus + popularity + text + tribute_penalty + version_penalty + artist_bonus };
}

// ---------------------------------------------------------------------------
// GET /api/search/bench?q=...&kind=albums|artists|all
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const kind = (searchParams.get("kind") || "albums") as "albums" | "artists" | "all";

  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const t0 = Date.now();

  const [internalSettled, mbAlbumsSettled, mbArtistsSettled] = await Promise.allSettled([
    searchInternal(q, kind === "artists" ? "artists" : kind === "albums" ? "albums" : "all"),
    kind !== "artists" ? searchMusicBrainzAlbums(q, 20) : Promise.resolve({ success: true, results: [] }),
    kind !== "albums" ? searchMusicBrainzArtists(q, 5) : Promise.resolve({ success: true, results: [] }),
  ]);

  const timingMs = Date.now() - t0;

  const internal: SearchResultUI[] =
    internalSettled.status === "fulfilled" ? (internalSettled.value as SearchResultUI[]) : [];

  const mbAlbumsRaw = (() => {
    if (mbAlbumsSettled.status === "rejected") {
      console.error("[bench] searchMusicBrainzAlbums threw:", mbAlbumsSettled.reason);
      return [];
    }
    const val = mbAlbumsSettled.value as any;
    if (!val.success) console.warn("[bench] searchMusicBrainzAlbums failed:", val.error);
    return val.success ? (val.results || []) : [];
  })();

  const mbArtistsRaw = (() => {
    if (mbArtistsSettled.status === "rejected") {
      console.error("[bench] searchMusicBrainzArtists threw:", mbArtistsSettled.reason);
      return [];
    }
    const val = mbArtistsSettled.value as any;
    if (!val.success) console.warn("[bench] searchMusicBrainzArtists failed:", val.error);
    return val.success ? (val.results || []) : [];
  })();

  // Build MB SearchResultUI list
  const mbList: SearchResultUI[] = [
    ...mbAlbumsRaw.map((a: any) => ({
      id: a.id,
      releaseId: a.releaseId,
      title: a.title,
      subtitle: a.artistName,
      kind: "album" as const,
      coverUrl: a.coverUrl,
      releaseDate: a.releaseDate,
      source: "musicbrainz" as const,
      score: a.score,
      releaseCount: a.releaseCount,
    })),
    ...mbArtistsRaw.map((a: any) => ({
      id: a.id,
      title: a.name,
      subtitle: a.type || undefined,
      kind: "artist" as const,
      source: "musicbrainz" as const,
      score: a.score,
    })),
  ];

  // mergeAndRank (same logic as SearchOverlay)
  const limit = 15;
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

  const dedupedExternal = mbList.filter((ext) => {
    if (internalIds.has(ext.id)) return false;
    if (ext.kind === "album") {
      const key = `${ext.title.toLowerCase()}|||${(ext.subtitle || "").toLowerCase()}`;
      if (internalAlbumKeys.has(key)) return false;
    }
    if (ext.kind === "artist") {
      if (internalArtistNames.has(ext.title.toLowerCase().trim())) return false;
    }
    return true;
  });

  const merged = [...internal, ...dedupedExternal]
    .sort((a, b) => computeRankDebug(b, q).total - computeRankDebug(a, q).total)
    .slice(0, limit);

  return NextResponse.json({
    query: q,
    kind,
    timing_ms: timingMs,
    internal_raw: internal,
    mb_albums_raw: mbAlbumsRaw.slice(0, 10),  // post-filter (score ≥ threshold + Album/EP type)
    mb_artists_raw: mbArtistsRaw.slice(0, 5),
    merged: merged.map((item, i) => {
      const breakdown = computeRankDebug(item, q);
      return {
        rank: i + 1,
        id: item.id,
        title: item.title,
        subtitle: item.subtitle ?? null,
        kind: item.kind,
        source: item.source,
        mb_score: item.score ?? null,
        release_count: item.releaseCount ?? null,
        final_score: Math.round(breakdown.total * 10) / 10,
        score_breakdown: {
          mb: Math.round(breakdown.mb * 10) / 10,
          internal_bonus: breakdown.internal_bonus,
          popularity: Math.round(breakdown.popularity * 10) / 10,
          text: breakdown.text,
        },
      };
    }),
  });
}
