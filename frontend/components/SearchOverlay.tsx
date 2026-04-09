"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists, importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { getArtistImagesByMbids } from "@/app/actions/artists";
import { showToast } from "@/components/Toast";
import { Clock, X, Disc3, User, Search, ArrowRight } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
} from '@/lib/recentSearches';

type SearchTab = "all" | "albums" | "artists" | "users";

// ---------------------------------------------------------------------------
// Ranking helpers
// ---------------------------------------------------------------------------

/** Strip accents, punctuation, extra spaces for resilient comparison */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // accents
    .replace(/[^\w\s]/g, "")           // punctuation (apostrophes, hyphens…)
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove leading articles so "The Dark Side…" matches query "dark side…" */
function stripArticle(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}

// Keywords that indicate tribute/cover/karaoke artists — penalised heavily
const TRIBUTE_KEYWORDS = ["tribute", "karaoke", "backing track", "made famous", "originally performed"];

/** Score a result for ordering — higher = more relevant */
function computeRank(item: SearchResultUI, query: string): number {
  const t = stripArticle(normalize(item.title));
  const q = stripArticle(normalize(query));
  const artistStr = normalize(item.subtitle || "");
  let rank = 0;

  // Tribute / karaoke penalty: these are almost never what the user wants.
  // Check both title and artist fields to catch "Kanye West Tribute Band" style names.
  if (TRIBUTE_KEYWORDS.some((k) => t.includes(k) || artistStr.includes(k))) rank -= 150;

  // Live / remix version penalty: targets suffixes like "(live)", "(remix)", "(acoustic)"
  // in parentheses or after a dash — avoids penalising "Live Through This", "Remix" (artist).
  // Only fires when the query doesn't explicitly ask for a live/remix version.
  const versionSuffix = /[\(\[]\s*(?:live|remix|acoustic|session|demo|version)\s*[\)\]]/i;
  if (versionSuffix.test(item.title) && !versionSuffix.test(query)) rank -= 120;

  // Artist match bonus: if the query contains the artist's name, the result is almost
  // certainly the intended one — "thriller michael jackson" → bonus for MJ, not Augustus Pablo.
  if (artistStr && q.includes(artistStr)) rank += 80;
  else if (artistStr && artistStr.includes(q)) rank += 20;

  // Text similarity — scored BEFORE MB to cap MB's contribution proportionally.
  // Exact match (t === q): MB score barely matters — text quality already proves relevance.
  // Starts-with: MB score capped at 40 to avoid titles like "Ziggy Stardust (Live)" by
  // an obscure band beating Bowie's canonical album purely via a high MB title-match score.
  let textScore = 0;
  if (t === q) { textScore = 300; rank += Math.min((item.score ?? 0) * 0.8, 20); }
  else if (t.startsWith(q)) { textScore = 150; rank += Math.min((item.score ?? 0) * 0.8, 40); }
  else if (t.includes(q) || q.includes(t)) { textScore = 50; rank += (item.score ?? 0) * 0.8; }
  else { rank += (item.score ?? 0) * 0.8; }
  rank += textScore;

  // Imported albums take clear priority: the user has already decided they're relevant.
  if (item.source === "internal") rank += 120;

  // Popularity: use actual releaseCount for MB results; default 50 for internal albums
  // (internal = curated quality, should be competitive with popular MB results).
  const effectiveReleaseCount = item.releaseCount ?? (item.source === "internal" ? 50 : 0);
  if (effectiveReleaseCount > 0) rank += Math.min(Math.log2(effectiveReleaseCount + 1) * 12, 80);

  return rank;
}

/** Merge internal + MB results, deduplicate, rank, limit */
function mergeAndRank(
  internal: SearchResultUI[],
  external: SearchResultUI[],
  query: string,
  limit: number
): SearchResultUI[] {
  const internalIds = new Set(internal.map((r) => r.id));

  // Deduplicate MB vs internal: albums by title+artist, artists by name
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

  const dedupedExternal = external.filter((ext) => {
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

  return [...internal, ...dedupedExternal]
    .sort((a, b) => computeRank(b, query) - computeRank(a, query))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// ResultRow
// ---------------------------------------------------------------------------

function ResultRow({
  item,
  onSelect,
  importing,
}: {
  item: SearchResultUI;
  onSelect: (item: SearchResultUI) => void;
  importing: boolean;
}) {
  const isRound = item.kind === "artist" || item.kind === "user";
  const hasImage = !!item.coverUrl;
  const placeholderIcon = item.kind === "album"
    ? <Disc3 size={16} className="text-text-disabled" />
    : <User size={16} className="text-text-disabled" />;

  return (
    <button
      onClick={() => !importing && onSelect(item)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-colors duration-150 ${
        importing
          ? "cursor-wait opacity-70"
          : "hover:bg-background-secondary cursor-pointer"
      }`}
    >
      {/* Thumbnail */}
      <div
        className={`flex-shrink-0 w-10 h-10 bg-background-tertiary overflow-hidden flex items-center justify-center ${
          isRound ? "rounded-full" : "rounded-[6px]"
        }`}
      >
        {hasImage ? (
          <CoverImage
            src={item.coverUrl!}
            fallback={
              item.source === "musicbrainz" && item.kind === "album" && item.releaseId
                ? `https://coverartarchive.org/release/${item.releaseId}/front`
                : undefined
            }
            alt={item.title}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            placeholder={placeholderIcon}
          />
        ) : placeholderIcon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {importing ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#8E6F5E] flex-shrink-0" />
            <span className="text-[13px] text-text-secondary">Import en cours…</span>
          </div>
        ) : (
          <>
            <p className="text-[14px] text-text-primary font-medium truncate leading-snug">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="text-[12px] text-text-tertiary truncate mt-0.5 leading-snug">
                {item.subtitle}
                {item.kind === "album" && item.releaseDate && (
                  <span className="text-text-disabled"> · {item.releaseDate.substring(0, 4)}</span>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SearchOverlay() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [results, setResults] = useState<SearchResultUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Search effect
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      setLoadingExtended(false);
      return;
    }

    let aborted = false;
    const limit = activeTab === "all" ? 8 : 6;

    const run = async () => {
      // Debounce — 300ms prevents MB spam on fast typing
      await new Promise((r) => setTimeout(r, 300));
      if (aborted) return;

      setLoading(true);
      setResults([]);

      // ── PHASE 2 — launch MB in background (parallel with phase 1) ──────────
      // Must be started BEFORE awaiting anything, so it runs concurrently.
      // Cache hit (~1ms memory / ~15ms Supabase) → ready before phase 1 finishes.
      // MB cold (~300ms) → enriches after phase 1 paint.
      // Timeout 400ms server-side → if MB is slow, phase 1 result stands.
      // ────────────────────────────────────────────────────────────────────────
      const mbPromise = activeTab !== "users"
        ? Promise.all([
            activeTab === "all" || activeTab === "albums"
              ? searchMusicBrainzAlbums(q, 20)
              : Promise.resolve(null),
            activeTab === "all" || activeTab === "artists"
              ? searchMusicBrainzArtists(q, 5)
              : Promise.resolve(null),
          ])
        : null;

      if (activeTab !== "users") setLoadingExtended(true);

      // ── PHASE 1 — internal search only (blocking, fast, immediate paint) ───
      // INVARIANT: nothing between here and setResults() below may block on
      // external I/O. searchInternal is a single Supabase query with no awaited
      // side-effects (analytics are fire-and-forget).
      // ────────────────────────────────────────────────────────────────────────
      let internal: SearchResultUI[] = [];
      try {
        internal = await searchInternal(q, activeTab);
      } catch {
        // Internal failed — MB-only fallback handled in phase 2
      }
      if (aborted) return;

      setResults(mergeAndRank(internal, [], q, limit)); // ← first paint
      setLoading(false);

      // ── PHASE 2 — merge MB results (non-blocking update) ────────────────────
      if (mbPromise) {
        try {
          const [mbAlbumsRes, mbArtistsRes] = await mbPromise;
          if (aborted) return;

          const mbList: SearchResultUI[] = [];

          if (mbAlbumsRes?.success && mbAlbumsRes.results) {
            mbAlbumsRes.results.forEach((album) =>
              mbList.push({
                id: album.id,
                releaseId: album.releaseId,
                title: album.title,
                subtitle: album.artistName,
                kind: "album",
                coverUrl: album.coverUrl || null,
                releaseDate: album.releaseDate,
                source: "musicbrainz",
                score: album.score,
                releaseCount: album.releaseCount,
              })
            );
          }

          if (mbArtistsRes?.success && mbArtistsRes.results) {
            mbArtistsRes.results.forEach((artist) =>
              mbList.push({
                id: artist.id,
                title: artist.name,
                subtitle: [artist.type, artist.country].filter(Boolean).join(" · "),
                kind: "artist",
                source: "musicbrainz",
                score: artist.score,
              })
            );
          }

          const merged = mergeAndRank(internal, mbList, q, limit);
          setResults(merged);

          // Load images for MB artists (Wikidata lookup, runs after results shown)
          const mbArtistMbids = mbList
            .filter((r) => r.kind === "artist")
            .map((r) => r.id);

          if (mbArtistMbids.length > 0) {
            getArtistImagesByMbids(mbArtistMbids)
              .then((images) => {
                if (!aborted) {
                  setResults((prev) =>
                    prev.map((r) =>
                      r.kind === "artist" && r.source === "musicbrainz" && images[r.id]
                        ? { ...r, coverUrl: images[r.id] }
                        : r
                    )
                  );
                }
              })
              .catch(() => {});
          }
        } catch {
          // MB error: keep internal results as-is
        } finally {
          if (!aborted) setLoadingExtended(false);
        }
      }
    };

    run();
    return () => {
      aborted = true;
    };
  }, [q, activeTab]);

  const handleSelect = useCallback(
    async (item: SearchResultUI) => {
      if (q.trim()) {
        saveRecentSearch(q.trim());
      }

      if (item.kind === "album" && item.source === "musicbrainz") {
        setImportingId(item.id);
        try {
          // Use the release MBID for import — falls back to release-group MBID if unavailable
          const result = await importAlbumFromMusicBrainz(item.releaseId || item.id);
          if (result.success && 'albumId' in result && result.albumId) {
            setIsOpen(false);
            setResults([]);
            setQ("");
            router.push(`/albums/${result.albumId}`);
            // Fire-and-forget enrichment (genres, bio, streaming links)
            if ('mbid' in result && result.mbid && 'title' in result && 'artist' in result) {
              fetch('/api/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumId: result.albumId, mbid: result.mbid, title: result.title, artist: result.artist }),
              }).catch(() => {});
            }
          } else {
            showToast("Erreur lors de l'import", "error");
          }
        } catch {
          showToast("Erreur lors de l'import", "error");
        } finally {
          setImportingId(null);
        }
        return;
      }

      setIsOpen(false);
      setResults([]);
      setQ("");

      if (item.kind === "album") {
        router.push(`/albums/${item.id}`);
      } else if (item.kind === "artist") {
        router.push(
          item.source === "musicbrainz"
            ? `/artists/preview/${item.id}`
            : `/artists/${item.id}`
        );
      } else if (item.kind === "user") {
        router.push(`/u/${item.slug ?? item.title}`);
      }
    },
    [q, router]
  );

  const handleSeeAll = () => {
    const filterParam = activeTab === "users" ? "users" : activeTab;
    setIsOpen(false);
    setQ("");
    router.push(`/search?q=${encodeURIComponent(q)}&filter=${filterParam}`);
  };

  const tabLabels: Record<SearchTab, string> = {
    all: "Tout",
    albums: "Albums",
    artists: "Artistes",
    users: "Profils",
  };

  const hasResults = results.length > 0;
  const isSearching = loading || loadingExtended;

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setIsOpen(true)} className="w-full max-w-2xl mx-auto">
        <div className="bg-background-secondary hover:bg-background-tertiary rounded-[10px] px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors duration-150">
          <Search size={15} className="text-text-tertiary flex-shrink-0" />
          <span className="text-[14px] text-text-tertiary">
            Rechercher un album, un artiste, ou un profil
          </span>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#1C1C1C]/20 z-50 flex items-start justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-background w-full max-w-2xl rounded-b-[14px] mt-0 max-h-[88vh] overflow-hidden flex flex-col border border-border border-t-0 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-0 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Search size={16} className="text-text-tertiary flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Rechercher un album, un artiste..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="flex-1 bg-transparent text-[15px] text-text-primary placeholder-text-tertiary focus:outline-none"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="p-1 -mr-1 text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0"
                    aria-label="Effacer la recherche"
                  >
                    <X size={18} />
                  </button>
                )}
                {!q && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 -mr-1 text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0"
                    aria-label="Fermer la recherche"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Tabs — visibles uniquement quand il y a une requête */}
              {q.trim() && (
                <div className="flex gap-5">
                  {(["all", "albums", "artists", "users"] as SearchTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-[13px] font-medium pb-3 border-b-2 transition-colors duration-150 ${
                        activeTab === tab
                          ? "text-text-primary border-[#8E6F5E]"
                          : "text-text-tertiary border-transparent hover:text-text-secondary"
                      }`}
                    >
                      {tabLabels[tab]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-3">
              {/* No query: recent searches */}
              {!q.trim() ? (
                recentSearches.length > 0 ? (
                  <div>
                    <p className="text-[11px] text-text-tertiary font-medium uppercase tracking-[0.08em] px-3 mb-2">
                      Recherches récentes
                    </p>
                    <div className="space-y-0.5">
                      {recentSearches.map((search, i) => (
                        <div
                          key={i}
                          onClick={() => setQ(search)}
                          className="flex items-center justify-between px-3 py-2 hover:bg-background-secondary rounded-[8px] transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Clock size={14} className="text-text-disabled flex-shrink-0" />
                            <span className="text-[14px] text-text-primary truncate">{search}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = removeRecentSearch(search);
                              setRecentSearches(updated);
                            }}
                            className="text-text-disabled hover:text-text-primary transition-colors flex-shrink-0 ml-2"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-text-tertiary text-[13px] px-3 py-4">
                    Commencez à taper pour rechercher
                  </p>
                )
              ) : loading ? (
                /* Initial loading */
                <div className="flex items-center gap-2 px-3 py-4">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E]" />
                  <span className="text-[13px] text-text-tertiary">Recherche…</span>
                </div>
              ) : (
                <>
                  {hasResults ? (
                    <div className="space-y-0.5">
                      {results.map((item) => (
                        <ResultRow
                          key={`${item.source}-${item.id}`}
                          item={item}
                          onSelect={handleSelect}
                          importing={importingId === item.id}
                        />
                      ))}
                    </div>
                  ) : !loadingExtended ? (
                    <p className="text-text-tertiary text-[13px] px-3 py-4">
                      Aucun résultat pour{" "}
                      <span className="font-medium text-text-secondary">« {q} »</span>
                    </p>
                  ) : null}

                  {/* Extended loading indicator */}
                  {loadingExtended && (
                    <div className="flex items-center gap-1.5 px-3 py-2 mt-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#8E6F5E] opacity-50" />
                      <span className="text-[11px] text-text-disabled">Recherche étendue…</span>
                    </div>
                  )}

                  {/* See all results */}
                  {q.trim() && activeTab !== "users" && (
                    <button
                      onClick={handleSeeAll}
                      className="flex items-center gap-1.5 px-3 py-2.5 mt-2 w-full text-[13px] text-text-tertiary hover:text-[#8E6F5E] transition-colors duration-150 group"
                    >
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      Voir tous les résultats pour{" "}
                      <span className="font-medium text-text-secondary ml-1">« {q} »</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
