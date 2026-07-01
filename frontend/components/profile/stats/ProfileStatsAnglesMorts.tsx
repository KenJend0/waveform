'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/album/CoverImage';
import { getTopFamilySlugs } from '@/lib/stats-dimensions';
import type { AnglesMortsAlbum, StatsGenreEntry } from '@/app/actions/profile-stats';

type Props = {
  anglesMorts: AnglesMortsAlbum[];
  genreData: StatsGenreEntry[];
};

function DefaultCover() {
  return (
    <div className="w-full h-full bg-background-secondary rounded-[6px] flex items-center justify-center">
      <span className="text-text-disabled text-[20px]">♪</span>
    </div>
  );
}

export default function ProfileStatsAnglesMorts({ anglesMorts, genreData }: Props) {
  const ranked = useMemo(() => {
    if (anglesMorts.length === 0) return [];

    const topSlugs = new Set(getTopFamilySlugs(genreData, 5));

    // Build genre slug set per album from the candidate data
    // We don't have candidate genre data here; sort by avg_rating (already filtered by genre in server)
    // Simple sort: highest community rating first, limit 5
    return [...anglesMorts]
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 5);
  }, [anglesMorts, genreData]);

  return (
    <div className="bg-[#FAF8F4] border border-border rounded-[12px] px-4 pt-4 pb-5">
      <h3 className="font-display font-normal text-[18px] text-text-warm leading-none mb-1">
        Tes <em className="italic text-accent-deep">angles morts</em>
      </h3>
      <p className="text-label text-text-tertiary mb-4">
        Albums acclamés que tu n&apos;as pas encore écoutés
      </p>

      {ranked.length === 0 ? (
        <p className="text-meta text-text-tertiary py-4 text-center">
          Pas assez d&apos;albums dans la base pour l&apos;instant.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {ranked.map((album) => {
            const coverSrc = album.mbid
              ? `https://coverartarchive.org/release-group/${album.mbid}/front`
              : album.cover_url ?? '';

            return (
              <Link
                key={album.id}
                href={`/albums/${album.id}`}
                className="flex-shrink-0 w-[100px] group"
              >
                <div className="relative aspect-square rounded-[8px] overflow-hidden bg-background-secondary mb-2">
                  {coverSrc ? (
                    <CoverImage
                      src={coverSrc}
                      fallback={album.cover_url ?? undefined}
                      placeholder={<DefaultCover />}
                      alt={album.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <DefaultCover />
                  )}
                </div>
                <p className="text-[11px] font-medium text-text-primary leading-tight line-clamp-2">
                  {album.title}
                </p>
                <p className="text-[10px] text-text-tertiary mt-0.5 truncate">
                  {album.artist_name}
                </p>
                <p className="text-[10px] text-accent-deep mt-0.5 font-medium">
                  {album.avg_rating.toFixed(1)}/10
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
