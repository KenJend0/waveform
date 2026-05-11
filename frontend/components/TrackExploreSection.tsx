"use client";

import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
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
                {track.avg_rating !== null && (
                    <div className="absolute bottom-0 right-0 bg-[#1C1C1C]/80 text-[#F5F3EF] text-[11px] font-medium px-1.5 py-0.5 rounded-tl-[4px]">
                        {track.avg_rating}
                    </div>
                )}
            </div>
            <p className="text-[13px] text-text-primary font-medium truncate leading-snug group-hover:text-[#8E6F5E] transition-colors">
                {track.track_title}
            </p>
            <p className="text-[11px] text-text-tertiary truncate">{track.artist_name}</p>
            <p className="text-[10px] text-text-disabled truncate">{track.album_title}</p>
        </Link>
    );
}

export default function TrackExploreSection({ trendingTracks, friendsTracks }: Props) {
    return (
        <section className="space-y-8">
            <h2 className="text-h2 text-text-primary">Titres</h2>

            {trendingTracks.length > 0 && (
                <div>
                    <h3 className="text-[13px] font-medium text-text-secondary mb-4">
                        Populaires cette semaine
                    </h3>
                    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {trendingTracks.map((track) => (
                            <div key={track.track_id} className="snap-center">
                                <TrackCard track={track} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {friendsTracks.length > 0 && (
                <div>
                    <h3 className="text-[13px] font-medium text-text-secondary mb-4">
                        Appréciés par tes contacts
                    </h3>
                    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {friendsTracks.map((track) => (
                            <div key={track.track_id} className="snap-center">
                                <TrackCard track={track} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
