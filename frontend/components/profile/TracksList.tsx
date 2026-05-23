"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { TrackDiaryEntryUI } from "@/app/actions/track-diary";
import { getUserTrackDiary } from "@/app/actions/track-diary";

type SortOption = "date_listened" | "personal_rating";

const SORT_LABELS: Record<SortOption, string> = {
    date_listened: "Date d'écoute",
    personal_rating: "Ma note",
};

const PAGE_SIZE = 50;

type Props = {
    userId: string;
    initialEntries: TrackDiaryEntryUI[];
};

export default function TracksList({ userId, initialEntries }: Props) {
    const [entries, setEntries] = useState(initialEntries);
    const [sortBy, setSortBy] = useState<SortOption>("date_listened");
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [hasMore, setHasMore] = useState(initialEntries.length === PAGE_SIZE);
    const [loadingMore, setLoadingMore] = useState(false);

    if (entries.length === 0) {
        return <div className="text-center text-text-tertiary py-12">Aucun titre noté pour le moment</div>;
    }

    const sorted = [...entries].sort((a, b) => {
        switch (sortBy) {
            case "date_listened":
                return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
            case "personal_rating":
                return (b.rating || 0) - (a.rating || 0);
            default:
                return 0;
        }
    });

    const loadMore = async () => {
        setLoadingMore(true);
        const more = await getUserTrackDiary(userId, entries.length, PAGE_SIZE);
        setEntries((prev) => [...prev, ...more]);
        setHasMore(more.length === PAGE_SIZE);
        setLoadingMore(false);
    };

    return (
        <div>
            {/* Sort selector */}
            <div className="mb-6 relative inline-block">
                <button
                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                    className="text-label text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
                >
                    Trié par: <span className="font-medium text-text-primary">{SORT_LABELS[sortBy]}</span>
                    <span className="text-[10px]">▾</span>
                </button>
                {sortDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-[8px] z-10 min-w-[160px] overflow-hidden shadow-lg">
                        {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => { setSortBy(key); setSortDropdownOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-background-secondary transition-colors duration-150 ${
                                    sortBy === key ? "text-text-primary font-medium" : "text-text-secondary"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
                {sorted.map((entry) => (
                    <Link key={entry.id} href={`/tracks/${entry.track_id}`} className="group">
                        <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative">
                            {entry.cover_url ? (
                                <Image
                                    src={entry.cover_url}
                                    alt={entry.track_title}
                                    fill
                                    className="object-cover"
                                    sizes="128px"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                                    <span className="text-text-disabled text-[20px]">♪</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-1.5 flex items-start justify-between gap-1">
                            <p className="text-label text-text-primary font-medium truncate leading-snug group-hover:text-accent transition-colors flex-1 min-w-0">
                                {entry.track_title}
                            </p>
                            {entry.rating !== null && (
                                <span className="text-label text-accent font-medium flex-shrink-0">{entry.rating}/10</span>
                            )}
                        </div>
                        <p className="text-label text-text-tertiary truncate">{entry.artist_name}</p>
                    </Link>
                ))}
            </div>

            {hasMore && (
                <div className="mt-8 text-center">
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                    >
                        {loadingMore ? "Chargement…" : "Charger plus"}
                    </button>
                </div>
            )}
        </div>
    );
}
