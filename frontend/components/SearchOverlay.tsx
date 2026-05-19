"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists, importAlbumFromMusicBrainz, searchMusicBrainzRecordings, importTrackFromMusicBrainz } from "@/app/actions/musicbrainz";
import { getArtistImagesByMbids } from "@/app/actions/artists";
import { showToast } from "@/components/Toast";
import { Clock, X, Disc3, User, Search, ArrowRight, Music } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
} from '@/lib/recentSearches';
import { computeRank, mergeAndRank } from '@/lib/searchRanking';

type SearchTab = "albums" | "artists" | "tracks" | "users";

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
  const placeholderIcon = item.kind === "album" || item.kind === "track"
    ? <Disc3 size={16} className="text-text-disabled" />
    : item.kind === "user" || item.kind === "artist"
    ? <User size={16} className="text-text-disabled" />
    : <Music size={16} className="text-text-disabled" />;

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
  const [activeTab, setActiveTab] = useState<SearchTab>("albums");
  const [results, setResults] = useState<SearchResultUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);
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
      setHasMoreResults(false);
      setLoading(false);
      setLoadingExtended(false);
      return;
    }

    let aborted = false;
    const limit = 6;

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
            activeTab === "albums"
              ? searchMusicBrainzAlbums(q, 20)
              : Promise.resolve(null),
            activeTab === "artists"
              ? searchMusicBrainzArtists(q, 5)
              : Promise.resolve(null),
            activeTab === "tracks"
              ? searchMusicBrainzRecordings(q, 20)
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

      const phase1 = mergeAndRank(internal, [], q, limit + 1);
      setHasMoreResults(phase1.length > limit);
      setResults(phase1.slice(0, limit)); // ← first paint
      setLoading(false);

      // ── PHASE 2 — merge MB results (non-blocking update) ────────────────────
      if (mbPromise) {
        try {
          const [mbAlbumsRes, mbArtistsRes, mbRecordingsRes] = await mbPromise;
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

          if (mbRecordingsRes?.success && mbRecordingsRes.results) {
            mbRecordingsRes.results.forEach((rec) =>
              mbList.push({
                id: rec.mbid,
                recordingMbid: rec.mbid,
                releaseId: rec.releaseId,
                title: rec.title,
                subtitle: `${rec.artistName} · ${rec.albumTitle}`,
                kind: "track",
                coverUrl: rec.coverUrl || null,
                source: "musicbrainz",
                score: rec.score,
              })
            );
          }

          const merged = mergeAndRank(internal, mbList, q, limit + 1);
          setHasMoreResults(merged.length > limit);
          setResults(merged.slice(0, limit));

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
            const redirectUrl = (result as any).redirectUrl as string ?? `/albums/${result.albumId}`;
            // Fire-and-forget enrichment (genres, bio, streaming links)
            if ('mbid' in result && result.mbid && 'title' in result && 'artist' in result) {
              fetch('/api/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumId: result.albumId, mbid: result.mbid, title: result.title, artist: result.artist }),
              }).catch(() => {});
            }
            router.push(redirectUrl);
          } else {
            showToast('error' in result && result.error ? result.error : "Erreur lors de l'import", "error");
          }
        } catch {
          showToast("Erreur lors de l'import", "error");
        } finally {
          setImportingId(null);
        }
        return;
      }

      if (item.kind === "track" && item.source === "musicbrainz") {
        setImportingId(item.id);
        try {
          const result = await importTrackFromMusicBrainz(
            item.recordingMbid || item.id,
            item.releaseId || "",
            item.title
          );
          if (result.success && result.trackId) {
            setIsOpen(false);
            setResults([]);
            setQ("");
            router.push(`/tracks/${result.trackId}`);
          } else {
            showToast("Erreur lors de l'import du titre", "error");
          }
        } catch {
          showToast("Erreur lors de l'import du titre", "error");
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
      } else if (item.kind === "track") {
        router.push(`/tracks/${item.id}`);
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
    setIsOpen(false);
    setQ("");
    router.push(`/search?q=${encodeURIComponent(q)}&filter=${activeTab}`);
  };

  const tabLabels: Record<SearchTab, string> = {
    albums: "Albums",
    artists: "Artistes",
    tracks: "Titres",
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
                  placeholder="Rechercher un album, un titre, un artiste..."
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

              {/* Tabs — toujours visibles dès l'ouverture */}
              <div className="flex gap-5">
                {(["albums", "tracks", "artists", "users"] as SearchTab[]).map((tab) => (
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
                      {hasMoreResults ? (
                        <>Plus de résultats disponibles — voir tout pour{" "}</>
                      ) : (
                        <>Voir tous les résultats pour{" "}</>
                      )}
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
