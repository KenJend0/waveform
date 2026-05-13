"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CoverImage } from "@/components/CoverImage";
import type { DiaryEntryUI } from "@/app/actions/diary";
import { getUserDiary } from "@/app/actions/diary";
import type { TrackDiaryEntryUI } from "@/app/actions/track-diary";
import { getUserTrackDiary } from "@/app/actions/track-diary";

type AlbumSort = "date_listened" | "release_date" | "personal_rating";
type TrackSort = "date_listened" | "personal_rating";
type MediaFilter = "albums" | "titres";

const ALBUM_SORT_LABELS: Record<AlbumSort, string> = {
  date_listened: "Date d'écoute",
  release_date: "Date de parution",
  personal_rating: "Ma note",
};

const TRACK_SORT_LABELS: Record<TrackSort, string> = {
  date_listened: "Date d'écoute",
  personal_rating: "Ma note",
};

const PAGE_SIZE = 50;

type Props = {
  entries: DiaryEntryUI[];
  isMe: boolean;
  trackEntries?: TrackDiaryEntryUI[];
  userId?: string;
};

export default function DiaryList({ entries, isMe, trackEntries, userId }: Props) {
  const showToggle = trackEntries !== undefined;
  const [media, setMedia] = useState<MediaFilter>("albums");

  // Album state
  const [albumEntries, setAlbumEntries] = useState<DiaryEntryUI[]>(entries);
  const [albumHasMore, setAlbumHasMore] = useState(entries.length === PAGE_SIZE);
  const [albumLoadingMore, setAlbumLoadingMore] = useState(false);
  const [albumSort, setAlbumSort] = useState<AlbumSort>("date_listened");

  // Track state
  const [trackList, setTrackList] = useState<TrackDiaryEntryUI[]>(trackEntries ?? []);
  const [trackHasMore, setTrackHasMore] = useState((trackEntries?.length ?? 0) === PAGE_SIZE);
  const [trackLoadingMore, setTrackLoadingMore] = useState(false);
  const [trackSort, setTrackSort] = useState<TrackSort>("date_listened");

  // Shared sort dropdown
  const [sortOpen, setSortOpen] = useState(false);

  const loadMoreAlbums = async () => {
    if (!userId) return;
    setAlbumLoadingMore(true);
    const more = await getUserDiary(userId, albumEntries.length, PAGE_SIZE);
    setAlbumEntries((prev) => [...prev, ...more]);
    setAlbumHasMore(more.length === PAGE_SIZE);
    setAlbumLoadingMore(false);
  };

  const loadMoreTracks = async () => {
    if (!userId) return;
    setTrackLoadingMore(true);
    const more = await getUserTrackDiary(userId, trackList.length, PAGE_SIZE);
    setTrackList((prev) => [...prev, ...more]);
    setTrackHasMore(more.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  const sortedAlbums = [...albumEntries].sort((a, b) => {
    switch (albumSort) {
      case "date_listened": {
        const diff = new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
        return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      case "release_date": {
        const dA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dB - dA;
      }
      case "personal_rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      default:
        return 0;
    }
  });

  const sortedTracks = [...trackList].sort((a, b) => {
    if (trackSort === "personal_rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
  });

  const currentSortLabel = media === "albums" ? ALBUM_SORT_LABELS[albumSort] : TRACK_SORT_LABELS[trackSort];

  return (
    <div>
      {/* Toolbar: sort left, media toggle right */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative inline-block">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
          >
            Trié par: <span className="font-medium text-text-primary">{currentSortLabel}</span>
            <span className="text-[10px]">▾</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max">
              {media === "albums"
                ? (Object.entries(ALBUM_SORT_LABELS) as [AlbumSort, string][]).map(([opt, label]) => (
                    <button
                      key={opt}
                      onClick={() => { setAlbumSort(opt); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                        albumSort === opt ? "bg-background-secondary text-text-primary font-medium" : "text-text-tertiary hover:bg-background-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))
                : (Object.entries(TRACK_SORT_LABELS) as [TrackSort, string][]).map(([opt, label]) => (
                    <button
                      key={opt}
                      onClick={() => { setTrackSort(opt); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                        trackSort === opt ? "bg-background-secondary text-text-primary font-medium" : "text-text-tertiary hover:bg-background-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))
              }
            </div>
          )}
        </div>

        {showToggle && (
          <div className="flex items-center gap-1 text-[12px]">
            <button
              onClick={() => { setMedia("albums"); setSortOpen(false); }}
              className={`transition-colors duration-150 ${
                media === "albums" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Albums
            </button>
            <span className="text-text-disabled select-none">·</span>
            <button
              onClick={() => { setMedia("titres"); setSortOpen(false); }}
              className={`transition-colors duration-150 ${
                media === "titres" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Titres
            </button>
          </div>
        )}
      </div>

      {/* Albums */}
      {media === "albums" && (
        albumEntries.length === 0 ? (
          <div className="text-center text-text-tertiary py-12">Aucune entrée dans le journal</div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {sortedAlbums.map((entry) => (
                <div key={entry.id} className="flex flex-col">
                  <Link
                    href={`/diary/${entry.id}`}
                    className="group relative block aspect-square rounded-[10px] overflow-hidden"
                  >
                    {entry.cover_url ? (
                      <CoverImage
                        src={entry.cover_url}
                        alt={entry.album_title}
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                      />
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
                      {entry.rating && (
                        <div className="text-[#8E6F5E] font-medium text-[12px] ml-2 flex-shrink-0">
                          {Math.round(entry.rating)}/10
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {albumHasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMoreAlbums}
                  disabled={albumLoadingMore}
                  className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                >
                  {albumLoadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* Titres */}
      {media === "titres" && (
        trackList.length === 0 ? (
          <div className="text-center text-text-tertiary py-12">Aucun titre noté pour le moment</div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
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
  );
}

