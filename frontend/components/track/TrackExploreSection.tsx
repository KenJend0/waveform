"use client";

import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
type TrackWithStats = {
    track_id: string;
    track_title: string;
    artist_name: string;
    album_title: string;
    cover_url: string | null;
    avg_rating: number | null;
};

type Props = {
    trendingTracks: TrackWithStats[];
    friendsTracks: TrackWithStats[];
};

function TrackCard({ track }: { track: TrackWithStats }) {
    return (
        <Link
            href={`/tracks/${track.track_id}`}
            className="group flex-shrink-0 w-36 sm:w-40"
        >
            <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative mb-2">
                {track.cover_url ? (
                    <CoverImage
                        src={track.cover_url}
                        alt={track.track_title}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                        placeholder={
                            <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                                <span className="text-text-disabled text-2xl">♪</span>
                            </div>
                        }
                    />
                ) : (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                        <span className="text-text-disabled text-2xl">♪</span>
                    </div>
                )}
            </div>
            <p className="text-sm text-text-primary font-medium truncate leading-snug group-hover:text-[#8E6F5E] transition-colors">
                {track.track_title}
            </p>
            <p className="text-label text-text-tertiary truncate">{track.artist_name}</p>
        </Link>
    );
}

export default function TrackExploreSection({ trendingTracks }: Pick<Props, 'trendingTracks'>) {
    if (trendingTracks.length === 0) return null;

    return (
        <section>
            <h2 className="text-h2 text-text-primary mb-5">Titres populaires cette semaine</h2>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                {trendingTracks.map((track) => (
                    <div key={track.track_id} className="snap-center">
                        <TrackCard track={track} />
                    </div>
                ))}
            </div>
        </section>
    );
}
