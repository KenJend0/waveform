"use client";

import Link from "next/link";

type AlbumCardWithActionsProps = {
  album: {
    id: string;
    title: string;
    cover_url: string | null;
    artist_name: string;
  };
  year?: number;
  trackCount: number;
  avgRating: number | null;
};

export default function AlbumCardWithActions({
  album,
  year,
  trackCount,
  avgRating,
}: AlbumCardWithActionsProps) {
  return (
    <>
      <div className="group relative">
        {/* Album Cover Link */}
        <Link href={`/albums/${album.id}`} className="block">
          <div className="rounded-[10px] overflow-hidden aspect-square bg-background-secondary relative">
            {album.cover_url ? (
              <img
                src={album.cover_url}
                alt={album.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-background-secondary text-text-tertiary">
                <div className="text-[24px]">â™ª</div>
              </div>
            )}
            {/* Rating Badge */}
            {avgRating && (
              <div className="absolute top-2 right-2 bg-[#1C1C1C] rounded-[8px] px-2 py-1 text-label font-medium text-[#F5F3EF]">
                {avgRating.toFixed(1)}
              </div>
            )}
          </div>
        </Link>

        {/* Album Info */}
        <div className="mt-3">
          <Link
            href={`/albums/${album.id}`}
            className="text-meta font-medium text-text-primary group-hover:text-[#8E6F5E] transition-colors duration-150 truncate block"
          >
            {album.title}
          </Link>
          <div className="text-label text-text-secondary mt-1">
            {year && <span>{year}</span>}
            {year && trackCount && <span> â€¢ </span>}
            {trackCount && (
              <span>{trackCount} track{trackCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

