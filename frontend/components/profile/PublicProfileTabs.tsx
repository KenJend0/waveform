"use client";

import { useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { type FavoriteAlbum } from "./Top3Albums";
import ReviewsList from "./ReviewsList";
import type { DiaryEntryUI, UnifiedReview } from "@/app/actions/diary";
import { getUserDiary } from "@/app/actions/diary";
import type { TrackDiaryEntryUI } from "@/app/actions/track-diary";
import { getUserTrackDiary } from "@/app/actions/track-diary";
import type { UserList } from "@/app/actions/lists";
import ListsTab from "./ListsTab";

const PAGE_SIZE = 50;

type Tab = "journal" | "revues" | "listes";
type MediaFilter = "albums" | "titres";
type AlbumSort = "date_listened" | "release_date" | "their_rating";
type TrackSort = "date_listened" | "their_rating";

type Props = {
  profileUserId: string;
  username: string;
  diaryEntries: DiaryEntryUI[];
  publicLists: UserList[];
  myListenedAlbums: Record<string, number | null>;
  isLoggedIn: boolean;
  trackEntries?: TrackDiaryEntryUI[];
  unifiedReviews?: UnifiedReview[];
};

// ─── Sort dropdown ───────────────────────────────────────────────────────────
function SortDropdown<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
      >
        Tri :{" "}
        <span className="font-medium text-text-primary">{current?.label}</span>
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max shadow-sm"
          onMouseLeave={() => setOpen(false)}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                value === opt.id
                  ? "bg-background-secondary text-text-primary font-medium"
                  : "text-text-tertiary hover:bg-background-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PublicProfileTabs({
  profileUserId,
  diaryEntries,
  publicLists,
  myListenedAlbums,
  isLoggedIn,
  trackEntries = [],
  unifiedReviews = [],
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const resolveTab = (raw: string | null): Tab => {
    if (raw === "revues" || raw === "listes") return raw;
    if (raw === "ecouter") return "listes";
    return "journal";
  };

  const [tab, setTab] = useState<Tab>(() => resolveTab(searchParams.get("tab")));
  const [media, setMedia] = useState<MediaFilter>("albums");

  // Album state
  const [allEntries, setAllEntries] = useState<DiaryEntryUI[]>(diaryEntries);
  const [hasMore, setHasMore] = useState(diaryEntries.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [albumSort, setAlbumSort] = useState<AlbumSort>("date_listened");
  const [albumSortOpen, setAlbumSortOpen] = useState(false);

  // Track state
  const [trackList, setTrackList] = useState<TrackDiaryEntryUI[]>(trackEntries);
  const [trackHasMore, setTrackHasMore] = useState(trackEntries.length === PAGE_SIZE);
  const [trackLoadingMore, setTrackLoadingMore] = useState(false);
  const [trackSort, setTrackSort] = useState<TrackSort>("date_listened");
  const [trackSortOpen, setTrackSortOpen] = useState(false);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    if (t === "journal") params.delete("tab");
    else params.set("tab", t);
    const query = params.toString();
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  };

  const loadMoreAlbums = async () => {
    setLoadingMore(true);
    const more = await getUserDiary(profileUserId, allEntries.length, PAGE_SIZE);
    setAllEntries((prev) => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const loadMoreTracks = async () => {
    setTrackLoadingMore(true);
    const more = await getUserTrackDiary(profileUserId, trackList.length, PAGE_SIZE);
    setTrackList((prev) => [...prev, ...more]);
    setTrackHasMore(more.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  // Deduplicate diary by album (keep latest)
  const uniqueDiary = Array.from(
    new Map(allEntries.map((e) => [e.album_id, e])).values()
  );

  const TABS = [
    { id: "journal" as Tab, label: "Journal" },
    { id: "revues" as Tab, label: "Revues", count: unifiedReviews.length },
    { id: "listes" as Tab, label: "Listes", count: publicLists.length },
  ];

  const ALBUM_SORT_OPTIONS: { id: AlbumSort; label: string }[] = [
    { id: "date_listened", label: "Date d'écoute" },
    { id: "release_date", label: "Parution" },
    { id: "their_rating", label: "Sa note" },
  ];

  const TRACK_SORT_OPTIONS: { id: TrackSort; label: string }[] = [
    { id: "date_listened", label: "Date d'écoute" },
    { id: "their_rating", label: "Sa note" },
  ];

  const sortAlbums = (entries: DiaryEntryUI[]) =>
    [...entries].sort((a, b) => {
      switch (albumSort) {
        case "release_date":
          return new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime();
        case "their_rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        default:
          return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
      }
    });

  const filteredDiary = sortAlbums(uniqueDiary);

  const sortedTracks = [...trackList].sort((a, b) => {
    if (trackSort === "their_rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
  });

  const currentSortLabel = media === "albums"
    ? ALBUM_SORT_OPTIONS.find((o) => o.id === albumSort)?.label
    : TRACK_SORT_OPTIONS.find((o) => o.id === trackSort)?.label;

  return (
    <div className="px-4 sm:px-6 lg:px-0">
      <div className="pb-28">
        {/* Tab bar */}
        <div className="flex gap-5 mb-8 border-b border-border-divider">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`text-[14px] pb-3 transition-colors duration-150 border-b-2 -mb-px flex items-baseline gap-1.5 ${
                tab === t.id
                  ? "text-text-primary border-[#1C1C1C]"
                  : "text-text-tertiary hover:text-text-secondary border-transparent"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="text-[11px] text-text-disabled">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Journal ── */}
        {tab === "journal" && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              {/* Left: sort dropdown */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Sort dropdown */}
                <div className="relative inline-block">
                  <button
                    onClick={() => {
                      if (media === "albums") setAlbumSortOpen((v) => !v);
                      else setTrackSortOpen((v) => !v);
                    }}
                    className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
                  >
                    Tri :{" "}
                    <span className="font-medium text-text-primary">{currentSortLabel}</span>
                    <span className="text-[10px]">▾</span>
                  </button>
                  {albumSortOpen && media === "albums" && (
                    <div
                      className="absolute top-full left-0 mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max shadow-sm"
                      onMouseLeave={() => setAlbumSortOpen(false)}
                    >
                      {ALBUM_SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { setAlbumSort(opt.id); setAlbumSortOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                            albumSort === opt.id
                              ? "bg-background-secondary text-text-primary font-medium"
                              : "text-text-tertiary hover:bg-background-secondary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {trackSortOpen && media === "titres" && (
                    <div
                      className="absolute top-full left-0 mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max shadow-sm"
                      onMouseLeave={() => setTrackSortOpen(false)}
                    >
                      {TRACK_SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { setTrackSort(opt.id); setTrackSortOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                            trackSort === opt.id
                              ? "bg-background-secondary text-text-primary font-medium"
                              : "text-text-tertiary hover:bg-background-secondary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Albums · Titres toggle */}
              <div className="flex items-center gap-1 text-[12px]">
                <button
                  onClick={() => { setMedia("albums"); setAlbumSortOpen(false); setTrackSortOpen(false); }}
                  className={`transition-colors duration-150 ${
                    media === "albums" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Albums
                </button>
                <span className="text-text-disabled select-none">·</span>
                <button
                  onClick={() => { setMedia("titres"); setAlbumSortOpen(false); setTrackSortOpen(false); }}
                  className={`transition-colors duration-150 ${
                    media === "titres" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Titres
                </button>
              </div>
            </div>

            {/* Albums grid */}
            {media === "albums" && (
              filteredDiary.length === 0 ? (
                <p className="text-center text-text-tertiary py-12 text-[14px]">
                  {"Aucune écoute pour l'instant"}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
                    {filteredDiary.map((entry) => (
                      <div key={entry.id}>
                        <Link
                          href={`/diary/${entry.id}`}
                          className="group relative block aspect-square rounded-[10px] overflow-hidden"
                        >
                          {entry.cover_url ? (
                            <Image src={entry.cover_url} alt={entry.album_title} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-background-tertiary" />
                          )}
                        </Link>
                        <div className="mt-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-text-primary truncate">{entry.album_title}</p>
                              <p className="text-[10px] text-text-tertiary truncate">{entry.artist_name}</p>
                            </div>
                            {entry.rating != null && (
                              <span className="text-[10px] font-medium text-[#8E6F5E] ml-1.5 flex-shrink-0">
                                {entry.rating}/10
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={loadMoreAlbums}
                        disabled={loadingMore}
                        className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                      >
                        {loadingMore ? "Chargement…" : "Charger plus"}
                      </button>
                    </div>
                  )}
                </>
              )
            )}

            {/* Tracks grid */}
            {media === "titres" && (
              trackList.length === 0 ? (
                <p className="text-center text-text-tertiary py-12 text-[14px]">Aucun titre noté pour le moment</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
                    {sortedTracks.map((entry) => (
                      <Link key={entry.id} href={`/tracks/${entry.track_id}`} className="group">
                        <div className="aspect-square rounded-[10px] overflow-hidden bg-background-secondary relative">
                          {entry.cover_url ? (
                            <Image src={entry.cover_url} alt={entry.track_title} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                              <span className="text-text-disabled text-[20px]">♪</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-start justify-between gap-1">
                          <p className="text-[12px] text-text-primary font-medium truncate leading-snug group-hover:text-[#8E6F5E] transition-colors flex-1 min-w-0">
                            {entry.track_title}
                          </p>
                          {entry.rating !== null && (
                            <span className="text-[11px] text-[#8E6F5E] font-medium flex-shrink-0">{entry.rating}/10</span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-tertiary truncate">{entry.artist_name}</p>
                      </Link>
                    ))}
                  </div>
                  {trackHasMore && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={loadMoreTracks}
                        disabled={trackLoadingMore}
                        className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                      >
                        {trackLoadingMore ? "Chargement…" : "Charger plus"}
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        )}

        {/* ── Revues ── */}
        {tab === "revues" && (
          <ReviewsList reviews={unifiedReviews} />
        )}

        {/* ── Listes ── */}
        {tab === "listes" && (
          <ListsTab lists={publicLists} isOwner={false} />
        )}
      </div>
    </div>
  );
}
