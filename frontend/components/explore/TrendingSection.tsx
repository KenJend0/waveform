"use client";

import { useState } from "react";
import Link from "next/link";
import ChartRow from "@/components/explore/ChartRow";
import { type TrendingAlbum } from "@/app/actions/explore";
import { type TrackWithStats } from "@/app/actions/track-diary";

type Props = {
    albums: TrendingAlbum[];
    tracks: TrackWithStats[];
};

export default function TrendingSection({ albums, tracks }: Props) {
    const [tab, setTab] = useState<"albums" | "titres">("albums");

    if (albums.length === 0 && tracks.length === 0) return null;

    return (
        <section>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h2 className="text-h2 text-text-primary">
                        <em className="font-display italic text-accent-deep">Tendances</em> de la semaine
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Ce que la communauté écoute en ce moment.
                    </p>
                </div>
                <Link
                    href="/explore/tendances"
                    className="font-display italic text-sm text-accent border-b border-accent pb-px shrink-0 hover:text-accent-deep hover:border-accent-deep transition-colors mt-1"
                >
                    voir tout
                </Link>
            </div>

            <div className="flex gap-1.5 mb-5">
                {(["albums", "titres"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-3 py-1 rounded-full text-label font-medium transition-colors ${
                            tab === t
                                ? "bg-text-primary text-background"
                                : "bg-background-secondary text-text-secondary hover:text-text-primary"
                        }`}
                    >
                        {t === "albums" ? "Albums" : "Titres"}
                    </button>
                ))}
            </div>

            {tab === "albums" && (
                albums.length > 0 ? (
                    <div className="flex flex-col">
                        {albums.slice(0, 5).map((item, index) => (
                            <ChartRow
                                key={item.id}
                                href={`/albums/${item.album_id}`}
                                rank={index + 1}
                                cover_url={item.cover_url}
                                title={item.album_title}
                                subtitle={item.artist_name}
                                delta={item.delta}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-text-tertiary text-meta">Rien pour le moment.</p>
                )
            )}

            {tab === "titres" && (
                tracks.length > 0 ? (
                    <div className="flex flex-col">
                        {tracks.slice(0, 5).map((track, index) => (
                            <ChartRow
                                key={track.track_id}
                                href={`/tracks/${track.track_id}`}
                                rank={index + 1}
                                cover_url={track.cover_url || ""}
                                title={track.track_title}
                                subtitle={track.artist_name}
                                delta={track.delta}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-text-tertiary text-meta">Rien pour le moment.</p>
                )
            )}
        </section>
    );
}
