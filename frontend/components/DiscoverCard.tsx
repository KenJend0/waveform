"use client";

import Image from "next/image";
import Link from "next/link";

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
};

export default function DiscoverCard({ item }: { item: DiscoverItem }) {
    return (
        <Link href={`/albums/${item.album_id}`} className="block group">
            {/* Image */}
            <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-3">
                {item.cover_url ? (
                    <Image
                        src={item.cover_url}
                        alt={item.album_title}
                        width={400}
                        height={400}
                        className="object-cover w-full aspect-square"
                    />
                ) : (
                    <div className="w-full aspect-square bg-background-tertiary" />
                )}
            </div>

            {/* Infos */}
            <h3 className="text-text-primary font-medium text-[14px] leading-snug mb-0.5 line-clamp-2 group-hover:text-[#8E6F5E] transition-colors duration-150">
                {item.album_title}
            </h3>
            <p className="text-text-secondary text-[12px] truncate">
                {item.artist_name}
            </p>

            {/* Rating optionnel - sauf pour trending_week */}
            {item.score && item.discover_kind !== 'trending_week' && (
                <p className="text-text-tertiary text-[12px] mt-0.5">
                    {Math.round(item.score * 2)}/10
                </p>
            )}
        </Link>
    );
}

