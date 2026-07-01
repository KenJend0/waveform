"use client";

import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import { dismissRecommendation } from "@/app/actions/explore";

type DiscoverItem = {
    id: string;
    album_title: string;
    artist_name: string;
    cover_url: string;
    discover_kind: string;
    score?: number;
    album_id: string;
    reason?: string;
    category?: string;
    algo?: string;
    delta?: number | null;
};

function DeltaBadge({ delta }: { delta: number | null }) {
    if (delta === null) return null;

    if (delta === 0) {
        return (
            <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-paper-hi/90 border border-border text-text-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm leading-none">
                =
            </span>
        );
    }

    const isUp = delta > 0;
    return (
        <span className={`absolute top-2 right-2 flex items-center gap-0.5 bg-paper-hi/90 border text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm leading-none ${isUp ? 'border-sage text-sage' : 'border-like text-like'}`}>
            {isUp ? (
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6"/></svg>
            ) : (
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            )}
            {Math.abs(delta)}
        </span>
    );
}

export default function DiscoverCard({
    item,
    rank,
    onDismiss,
}: {
    item: DiscoverItem;
    rank?: number;
    onDismiss?: (albumId: string) => void;
}) {
    function handleDismiss(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onDismiss?.(item.album_id);
        dismissRecommendation(item.album_id);
    }

    return (
        <Link href={`/albums/${item.album_id}`} className="block group">
            {/* Image */}
            <div className="rounded-cover overflow-hidden bg-background-secondary mb-3 relative">
                {rank !== undefined && (
                    <span className="absolute top-0 left-1 z-10 font-display italic text-[40px] leading-none text-accent pointer-events-none select-none" style={{ textShadow: '0 1px 0 #FAF8F4, 1px 1px 0 #FAF8F4, -1px 1px 0 #FAF8F4' }}>
                        {rank}
                    </span>
                )}
                {item.delta !== undefined && <DeltaBadge delta={item.delta ?? null} />}
                {item.cover_url ? (
                    <CoverImage
                        src={item.cover_url}
                        alt={item.album_title}
                        width={400}
                        height={400}
                        className="object-cover w-full aspect-square"
                        placeholder={<div className="w-full aspect-square bg-background-tertiary" />}
                    />
                ) : (
                    <div className="w-full aspect-square bg-background-tertiary" />
                )}
                {onDismiss && (
                    <button
                        onClick={handleDismiss}
                        title="Pas pour moi"
                        className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-text-primary/45 text-background flex items-center justify-center text-sm leading-none hover:bg-text-primary/70 transition-colors duration-150"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Infos */}
            {item.reason && (
                <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary bg-background-secondary border border-border rounded-full px-2 py-0.5 mb-1 max-w-full truncate">
                    {item.reason}
                </span>
            )}
            <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                {item.album_title}
            </p>
            <p className="text-label text-text-tertiary truncate mt-0.5">
                {item.artist_name}
            </p>

            {/* Rating optionnel - sauf pour trending_week */}
            {item.score && item.discover_kind !== 'trending_week' && (
                <p className="text-text-tertiary text-label mt-0.5">
                    {Math.round(item.score * 2)}/10
                </p>
            )}
        </Link>
    );
}

