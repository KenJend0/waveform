"use client";

import { useState } from "react";
import { type DiscoveryAlbum } from "@/app/actions/explore";
import DiscoverCard from "@/components/explore/DiscoverCard";

export default function DecouverteContent({ albums }: { albums: DiscoveryAlbum[] }) {
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const visible = albums.filter((a) => !dismissedIds.has(a.album_id));

    function handleDismiss(albumId: string) {
        setDismissedIds((prev) => new Set(prev).add(albumId));
    }

    if (visible.length === 0) {
        return <p className="text-text-tertiary text-meta">Rien pour le moment.</p>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
            {visible.map((album) => (
                <DiscoverCard
                    key={album.album_id}
                    item={{
                        id: `discovery-${album.album_id}`,
                        album_id: album.album_id,
                        album_title: album.title,
                        artist_name: album.artist,
                        cover_url: album.cover_url,
                        discover_kind: "discovery",
                        reason: album.via_username ? `via @${album.via_username}` : undefined,
                    }}
                    onDismiss={handleDismiss}
                />
            ))}
        </div>
    );
}
