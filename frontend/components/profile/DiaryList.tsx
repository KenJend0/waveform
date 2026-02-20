"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { DiaryEntryUI } from "@/app/actions/diary";

type SortOption = "date_listened" | "release_date" | "personal_rating";

type Props = {
  entries: DiaryEntryUI[];
  isMe: boolean;
};

const SORT_LABELS: Record<SortOption, string> = {
  date_listened: "Date d'écoute",
  release_date: "Date de parution",
  personal_rating: "Ma note",
};

export default function DiaryList({ entries, isMe }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>("date_listened");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  if (entries.length === 0)
    return <div className="text-center text-text-tertiary py-12">Aucune entrée dans le journal</div>;

  // Group entries by album_id and keep only the latest for each
  let latestEntriesByAlbum = Array.from(
    new Map(
      entries.map((entry) => [entry.album_id, entry])
    ).values()
  );

  // Sort entries based on selected option
  latestEntriesByAlbum = [...latestEntriesByAlbum].sort((a, b) => {
    switch (sortBy) {
      case "date_listened":
        return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
      case "release_date":
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      case "personal_rating":
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  return (
    <div>
      {/* Sort selector - textual dropdown */}
      <div className="mb-6 relative inline-block">
        <button
          onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
        >
          Trié par: <span className="font-medium text-text-primary">{SORT_LABELS[sortBy]}</span>
          <span className="text-[10px]">▾</span>
        </button>

        {sortDropdownOpen && (
          <div className="absolute top-full mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max">
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([option, label]) => (
              <button
                key={option}
                onClick={() => {
                  setSortBy(option);
                  setSortDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                  sortBy === option
                    ? "bg-background-secondary text-text-primary font-medium"
                    : "text-text-tertiary hover:bg-background-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 gap-6">
      {latestEntriesByAlbum.map((entry) => (
        <div key={entry.id}>
          <div className="flex flex-col">
            <Link
              href={`/diary/${entry.id}`}
              className="group relative block aspect-square rounded-[10px] overflow-hidden"
            >
              {entry.cover_url ? (
                <Image
                  src={entry.cover_url}
                  alt={entry.album_title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-background-tertiary" />
              )}
            </Link>

            {/* Info below cover */}
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
        </div>
      ))}
      </div>
    </div>
  );
}

