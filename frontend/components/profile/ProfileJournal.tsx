"use client";

import { useState } from "react";
import Link from "next/link";

type Entry = {
  id: string;
  rating: number | null;
  review_body: string | null;
  listened_at: string;
  albums: {
    id: string;
    title: string;
    cover_url: string | null;
    artist_id: string;
    artists: {
      id: string;
      name: string;
    };
  };
};

interface ProfileJournalProps {
  entries: Entry[];
}

export default function ProfileJournal({ entries }: ProfileJournalProps) {
  const [displayCount, setDisplayCount] = useState(3);

  const visibleEntries = entries.slice(0, displayCount);
  const hasMore = displayCount < entries.length;

  return (
    <section className="mb-24">
      <h2 className="text-h2 text-text-primary mb-8">
        Critiques récentes
      </h2>
      <div className="space-y-4">
        {visibleEntries.map((entry) => {
          const album = entry.albums;
          if (!album) return null;

          return (
            <Link
              key={entry.id}
              href={`/diary/${entry.id}`}
              className="group block border border-border hover:border-[#8E6F5E] transition-colors duration-150 p-4 bg-background-secondary rounded-[12px] flex gap-4"
            >
              {/* Cover */}
              {album.cover_url && (
                <div className="flex-shrink-0">
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-[10px] object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                {/* Header: Album title + Rating */}
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-medium text-text-primary group-hover:text-[#8E6F5E] transition-colors duration-150 truncate">
                      {album.title}
                    </h2>
                    <p className="text-[12px] text-text-tertiary mt-1 truncate">{album.artists?.name}</p>
                  </div>
                  {entry.rating && (
                    <div className="flex-shrink-0 text-[12px] font-medium text-[#8E6F5E] whitespace-nowrap">
                      {entry.rating}/10
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="text-[12px] text-text-tertiary mt-2">
                  {new Date(entry.listened_at).toLocaleDateString("fr-FR")}
                </div>

                {/* Review text */}
                {entry.review_body && (
                  <p className="text-[14px] text-text-secondary leading-[1.6] mt-3 line-clamp-3">
                    {entry.review_body}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Show more button */}
      {hasMore && (
        <button
          onClick={() => setDisplayCount(displayCount + 3)}
          className="mt-8 text-[12px] text-text-tertiary hover:text-[#8E6F5E] transition-colors duration-150 font-medium"
        >
          Afficher plus
        </button>
      )}
    </section>
  );
}

