// frontend/components/AlbumHero.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import MyActivitiesModal from "@/components/MyActivitiesModal";
import SaveAlbumButton from "@/components/SaveAlbumButton";
import AddToDiaryButton from "@/components/AddToDiaryButton";
import EditDiaryEntryButton from "@/components/EditDiaryEntryButton";
import GenrePills from "@/components/GenrePills";
import NetworkListenersBottomSheet from "@/components/NetworkListenersBottomSheet";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import { msToDuration } from "@/lib/time";

type NetworkListener = {
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating: number | null;
    listenedAt: string | null;
    entryId: string | null;
    hasReview: boolean;
};

type AlbumHeroProps = {
    album: {
        id: string;
        title: string;
        artist: string;
        artistId?: string;
        coverUrl?: string | null;
        year?: number | null;
        trackCount?: number;
        totalDurationMs?: number;
    };
    albumId?: string;
    isSaved?: boolean;
    userId?: string;
    stats?: {
        reviews_count: number;
        avg_rating: number | null;
        listeners_count: number;
    };
    myLatestEntry?: {
        id: string;
        rating: number | null;
        review_body: string | null;
        listened_at: string;
        created_at?: string;
    };
    myEntriesCount?: number;
    autoOpenDiary?: boolean;
    albumHasGenres?: boolean;
    genres?: string[];
    genreWeights?: Record<string, number>;
    streamingLinks?: { spotify?: string; appleMusic?: string; deezer?: string; tidal?: string };
    networkListeners?: NetworkListener[];
};

export default function AlbumHero({
    album,
    albumId,
    isSaved = false,
    userId,
    stats,
    myLatestEntry,
    myEntriesCount = 0,
    autoOpenDiary = false,
    albumHasGenres = true,
    genres,
    genreWeights,
    streamingLinks,
    networkListeners = [],
}: AlbumHeroProps) {
    const [coverError, setCoverError] = useState(false);
    const [isMyActivitiesOpen, setIsMyActivitiesOpen] = useState(false);
    const [isNetworkOpen, setIsNetworkOpen] = useState(false);

    return (
        <>
            {/* ========== ALBUM (Object) ========== */}
            <div className="flex flex-col md:flex-row md:gap-section-md md:items-start">
                {/* Cover */}
                <div className="flex-shrink-0 w-full md:w-48 mb-2 md:mb-0">
                    {album.coverUrl && !coverError ? (
                        <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0 relative">
                            <Image
                                src={album.coverUrl}
                                alt={album.title}
                                fill
                                className="object-cover"
                                onError={() => setCoverError(true)}
                            />
                        </div>
                    ) : (
                        <div className="rounded-[10px] bg-background-secondary aspect-square w-full max-w-48 mx-auto md:mx-0 flex items-center justify-center">
                            <span className="text-text-tertiary text-[12px]">Pas de couverture</span>
                        </div>
                    )}
                </div>

                {/* Right: Title + Artist + Year + Stats */}
                <div className="flex-1">
                    <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2] mb-2">
                        {album.title}
                    </h1>

                    {/* Ligne 1 : artiste · année */}
                    <div className="text-[14px] text-text-secondary">
                        {album.artistId ? (
                            <Link href={`/artists/${album.artistId}`} className="hover:text-[#8E6F5E] transition-colors duration-150">
                                {album.artist}
                            </Link>
                        ) : (
                            album.artist
                        )}
                        {album.year && ` · ${album.year}`}
                    </div>

                    {/* Ligne 2 : X morceaux · durée */}
                    {(album.trackCount != null || album.totalDurationMs != null) && (
                        <div className="text-[13px] text-text-tertiary mt-0.5 mb-4">
                            {album.trackCount != null && `${album.trackCount} morceau${album.trackCount > 1 ? "x" : ""}`}
                            {album.trackCount != null && album.totalDurationMs != null && " · "}
                            {album.totalDurationMs != null && msToDuration(album.totalDurationMs)}
                        </div>
                    )}

                    {/* Stats */}
                    {stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.reviews_count > 0) && (
                        <div className="flex items-baseline gap-5 mt-2">
                            {stats.avg_rating !== null && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.avg_rating.toFixed(1)}</span>
                                    <span className="text-[12px] text-text-tertiary ml-0.5">/10 moy.</span>
                                </span>
                            )}
                            {stats.listeners_count > 0 && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.listeners_count.toLocaleString()}</span>
                                    <span className="text-[12px] text-text-tertiary ml-1">{stats.listeners_count === 1 ? "auditeur" : "auditeurs"}</span>
                                </span>
                            )}
                            {stats.reviews_count > 0 && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.reviews_count.toLocaleString()}</span>
                                    <span className="text-[12px] text-text-tertiary ml-1">{stats.reviews_count === 1 ? "critique" : "critiques"}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Network listeners — cliquable, ouvre le bottom sheet */}
            {networkListeners.length > 0 && (() => {
                const shown = networkListeners.slice(0, 3);
                const rest = networkListeners.length - shown.length;

                const tokens = shown.map((l) => l.username);
                let label: string;
                if (tokens.length === 1) {
                    label = `${tokens[0]} a écouté cet album`;
                } else if (rest === 0) {
                    label = `${tokens.slice(0, -1).join(", ")} et ${tokens[tokens.length - 1]} ont écouté cet album`;
                } else {
                    label = `${tokens.join(", ")} et ${rest} autre${rest > 1 ? "s" : ""} ont écouté cet album`;
                }

                return (
                    <button
                        onClick={() => setIsNetworkOpen(true)}
                        className="flex items-center gap-2 mt-5 hover:opacity-75 transition-opacity duration-150"
                    >
                        <div className="flex -space-x-1.5">
                            {shown.map((l) => (
                                <div key={l.userId} className="border border-background-primary rounded-full flex-shrink-0">
                                    <UserAvatar userId={l.userId} src={l.avatarUrl} size={20} />
                                </div>
                            ))}
                        </div>
                        <span className="text-[12px] text-text-tertiary leading-snug">{label}</span>
                    </button>
                );
            })()}

            {/* Genres */}
            {genres !== undefined && (genres.length > 0 || userId) && (
                <GenrePills
                    genres={genres}
                    albumId={albumId || album.id}
                    userId={genres.length < 3 ? userId : undefined}
                    genreWeights={genreWeights}
                    className="mt-4"
                />
            )}

            {/* Streaming links */}
            {streamingLinks && Object.values(streamingLinks).some(Boolean) && (
                <div className="flex items-center gap-2 flex-wrap mt-4">
                    <span className="text-[12px] text-text-tertiary">Écouter sur</span>
                    {[
                        { key: "spotify", label: "Spotify", href: streamingLinks.spotify },
                        { key: "appleMusic", label: "Apple Music", href: streamingLinks.appleMusic },
                        { key: "deezer", label: "Deezer", href: streamingLinks.deezer },
                        { key: "tidal", label: "Tidal", href: streamingLinks.tidal },
                    ]
                        .filter((s) => s.href)
                        .map((s, i, arr) => (
                            <span key={s.key} className="flex items-center gap-2">
                                <a
                                    href={s.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[12px] text-text-secondary hover:text-text-primary transition-colors duration-150"
                                >
                                    {s.label}
                                </a>
                                {i < arr.length - 1 && (
                                    <span className="text-[12px] text-text-disabled">·</span>
                                )}
                            </span>
                        ))}
                </div>
            )}

            {/* ========== TA NOTE ========== */}
            {myLatestEntry && (
                <div className="border-t border-border-divider mt-8 pt-8 mb-10">
                    <div className="flex items-center gap-3 mb-6">
                        <h2 className="text-h2 text-text-primary">
                            Mon écoute
                        </h2>
                        {myEntriesCount > 1 && (
                            <button
                                onClick={() => setIsMyActivitiesOpen(true)}
                                className="text-[12px] text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150"
                            >
                                voir toutes
                            </button>
                        )}
                    </div>

                    <div className="bg-background-secondary rounded-[12px] p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                {myLatestEntry.rating && (
                                    <div className="mb-3">
                                        <span className="text-[24px] font-medium text-text-primary">
                                            {myLatestEntry.rating}
                                        </span>
                                        <span className="text-[12px] text-text-tertiary ml-1">/10</span>
                                    </div>
                                )}

                                {myLatestEntry.review_body && (
                                    <blockquote className="text-[14px] text-text-secondary italic mb-3 leading-relaxed max-w-lg">
                                        {myLatestEntry.review_body}
                                    </blockquote>
                                )}

                                <div className="text-[12px] text-text-tertiary">
                                    {new Date(myLatestEntry.listened_at).toLocaleDateString('fr-FR')}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-text-tertiary">
                                {userId && (
                                    <EditDiaryEntryButton
                                        entryId={myLatestEntry.id}
                                        albumId={albumId || album.id}
                                        currentRating={myLatestEntry.rating}
                                        currentReview={myLatestEntry.review_body}
                                        currentListenedAt={myLatestEntry.listened_at}
                                        variant="compact"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions — always visible */}
            <div className="flex gap-2 mt-4">
                <AddToDiaryButton
                    albumId={albumId || album.id}
                    userId={userId}
                    initialSaved={isSaved}
                    existingEntriesCount={myEntriesCount}
                    autoOpen={autoOpenDiary}
                    albumHasGenres={albumHasGenres}
                    onSuccess={() => setIsMyActivitiesOpen(myEntriesCount > 0)}
                />
                <SaveAlbumButton albumId={albumId || album.id} initialSaved={isSaved} userId={userId} />
            </div>

            {/* My Activities Modal */}
            {userId && (
                <MyActivitiesModal
                    albumId={albumId || album.id}
                    isOpen={isMyActivitiesOpen}
                    onClose={() => setIsMyActivitiesOpen(false)}
                />
            )}

            {/* Network Listeners Bottom Sheet */}
            <NetworkListenersBottomSheet
                listeners={networkListeners}
                isOpen={isNetworkOpen}
                onClose={() => setIsNetworkOpen(false)}
            />
        </>
    );
}
