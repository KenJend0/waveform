"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";

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
              className="group block border border-border hover:border-accent transition-colors duration-150 p-4 bg-background-secondary rounded-card flex gap-4"
            >
              {/* Cover */}
              {album.cover_url && (
                <div className="flex-shrink-0 relative" style={{ width: 64 }}>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-cover overflow-hidden relative">
                    <CoverImage src={album.cover_url} alt={album.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                {/* Header: Album title + Rating */}
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                      {album.title}
                    </p>
                    <p className="text-label text-text-tertiary mt-1 truncate">{album.artists?.name}</p>
                  </div>
                  {entry.rating && (
                    <div className="flex-shrink-0 text-label font-medium text-accent whitespace-nowrap">
                      {entry.rating}/10
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="text-label text-text-tertiary mt-2">
                  {new Date(entry.listened_at).toLocaleDateString("fr-FR")}
                </div>

                {/* Review text */}
                {entry.review_body && (
                  <p className="text-meta text-text-secondary leading-[1.6] mt-3 line-clamp-3">
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
          className="mt-8 text-label text-text-tertiary hover:text-accent transition-colors duration-150 font-medium"
        >
          Afficher plus
        </button>
      )}
    </section>
  );
}

