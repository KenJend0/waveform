"use client";

import { useState } from "react";
import Link from "next/link";
import { type DiscoveryResult } from "@/app/actions/explore";
import DiscoverCard from "@/components/explore/DiscoverCard";
import { useAuth } from "@/lib/AuthContext";

export default function DiscoverySection({ result }: { result: DiscoveryResult }) {
    const { user } = useAuth();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const visible = result.albums.filter((a) => !dismissedIds.has(a.album_id)).slice(0, 5);

    if (visible.length === 0) return null;

    function handleDismiss(albumId: string) {
        setDismissedIds((prev) => new Set(prev).add(albumId));
    }

    const isBubble = result.mode === 'bubble';

    return (
        <section>
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-h2 text-text-primary mb-1">
                        {isBubble ? (
                            <>Hors de ta <em style={{ fontStyle: 'italic', color: 'var(--color-accent-deep, #5C4538)' }}>bulle</em></>
                        ) : (
                            <>À <em style={{ fontStyle: 'italic', color: 'var(--color-accent-deep, #5C4538)' }}>découvrir</em></>
                        )}
                    </h2>
                    <p className="text-[13px] text-text-secondary">
                        {isBubble
                            ? "Des artistes absents de ton journal, suggérés par des comptes que tu suis."
                            : result.hasTasteProfile
                                ? "Des albums largement salués, en dehors de tes artistes habituels."
                                : "Des albums largement salués sur Waveform, pour commencer à explorer."}
                    </p>
                </div>
                <Link
                    href="/explore/decouverte"
                    className="font-display italic text-sm text-accent border-b border-accent pb-px shrink-0 hover:text-accent-deep hover:border-accent-deep transition-colors mt-1"
                >
                    voir tout
                </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide lg:hidden">
                {visible.map((album) => (
                    <div key={album.album_id} className="snap-center shrink-0 w-44 sm:w-48 md:w-52">
                        <DiscoverCard
                            item={{
                                id: `discovery-${album.album_id}`,
                                album_id: album.album_id,
                                album_title: album.title,
                                artist_name: album.artist,
                                cover_url: album.cover_url,
                                discover_kind: "discovery",
                                reason: album.via_username ? `via @${album.via_username}` : undefined,
                            }}
                            onDismiss={user ? handleDismiss : undefined}
                        />
                    </div>
                ))}
            </div>
            <div className="hidden lg:grid lg:grid-cols-5 gap-4">
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
                        onDismiss={user ? handleDismiss : undefined}
                    />
                ))}
            </div>
        </section>
    );
}
