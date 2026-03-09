// frontend/components/AlbumHero.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import MyActivitiesModal from "@/components/MyActivitiesModal";
import SaveAlbumButton from "@/components/SaveAlbumButton";
import AddToDiaryButton from "@/components/AddToDiaryButton";
import EditDiaryEntryButton from "@/components/EditDiaryEntryButton";

type AlbumHeroProps = {
    album: {
        id: string;
        title: string;
        artist: string;
        artistId?: string;
        coverUrl?: string | null;
        year?: number | null;
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
    streamingLinks?: { spotify?: string; appleMusic?: string; deezer?: string; tidal?: string };
    networkListeners?: Array<{ userId: string; username: string; displayName: string | null; avatarUrl: string | null }>;
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
    streamingLinks,
    networkListeners = [],
}: AlbumHeroProps) {
    const [coverError, setCoverError] = useState(false);
    const [isMyActivitiesOpen, setIsMyActivitiesOpen] = useState(false);

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
                    <div className="text-[14px] text-text-secondary mb-4">
                        {album.artistId ? (
                            <Link href={`/artists/${album.artistId}`} className="hover:text-[#8E6F5E] transition-colors duration-150">
                                {album.artist}
                            </Link>
                        ) : (
                            album.artist
                        )}
                        {album.year && ` · ${album.year}`}
                    </div>

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

            {/* Network listeners */}
            {networkListeners.length > 0 && (() => {
                const shown = networkListeners.slice(0, 3);
                const rest = networkListeners.length - shown.length;
                const names = shown.map((l) => l.displayName || l.username);
                let label: string;
                if (names.length === 1) {
                    label = `${names[0]} a écouté cet album`;
                } else if (rest === 0) {
                    label = `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]} ont écouté cet album`;
                } else {
                    label = `${names.join(", ")} et ${rest} autre${rest > 1 ? "s" : ""} ont écouté cet album`;
                }
                return (
                    <div className="flex items-center gap-2 mt-5">
                        <div className="flex -space-x-1.5">
                            {shown.map((l) => (
                                <div key={l.userId} className="w-5 h-5 rounded-full overflow-hidden bg-background-secondary border border-background-primary flex-shrink-0">
                                    {l.avatarUrl ? (
                                        <Image src={l.avatarUrl} alt={l.displayName || l.username} width={20} height={20} className="object-cover w-full h-full" />
                                    ) : (
                                        <div className="w-full h-full bg-background-tertiary" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <span className="text-[12px] text-text-tertiary leading-snug">{label}</span>
                    </div>
                );
            })()}

            {/* ========== TA NOTE ========== */}
            {myLatestEntry && (
                <div className="border-t border-border-divider mt-8 pt-8 mb-10">
                    {/* Section title */}
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

                    {/* Card */}
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

            {/* Inline metadata (when only one of genres/streaming is present, no bio) */}
            {genres && genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                    {genres.map((g) => (
                        <span key={g} className="text-[11px] text-text-tertiary bg-background-secondary rounded-full px-2.5 py-0.5 capitalize">
                            {g}
                        </span>
                    ))}
                </div>
            )}

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
                <SaveAlbumButton albumId={albumId || album.id} initialSaved={isSaved} />
            </div>

            {/* My Activities Modal */}
            {userId && (
                <MyActivitiesModal
                    albumId={albumId || album.id}
                    isOpen={isMyActivitiesOpen}
                    onClose={() => setIsMyActivitiesOpen(false)}
                />
            )}
        </>
    );
}

