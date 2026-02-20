"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SavedAlbumUI } from "@/app/actions/saved-albums";

type SortOption = "saved_date" | "release_date";

type Props = {
  albums: SavedAlbumUI[];
};

const SORT_LABELS: Record<SortOption, string> = {
  saved_date: "Date d'ajout",
  release_date: "Date de parution",
};

export default function SavedTracks({ albums }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>("saved_date");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  if (albums.length === 0)
    return <div className="text-center text-text-tertiary py-12">Aucun album sauvegardé</div>;

  // Sort albums based on selected option
  const sortedAlbums = [...albums].sort((a, b) => {
    switch (sortBy) {
      case "saved_date":
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
      case "release_date":
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
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
        {sortedAlbums.map((album) => (
        <div key={album.id}>
          <Link
            href={`/albums/${album.album_id}`}
            className="group relative block aspect-square rounded-[10px] overflow-hidden"
          >
            {album.cover_url ? (
              <Image
                src={album.cover_url}
                alt={album.album_title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-background-tertiary" />
            )}
          </Link>

          {/* Info below cover */}
          <div className="mt-2 text-left">
            <p className="text-[12px] font-medium text-text-primary truncate">{album.album_title}</p>
            <p className="text-[10px] text-text-tertiary truncate">{album.artist_name}</p>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}

