// frontend/components/AlbumHero.tsx
"use client";

import Link from "next/link";
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
                        <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0">
                            <img
                                src={album.coverUrl}
                                alt={album.title}
                                className="w-full h-full object-cover"
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

            {/* ========== TA NOTE ========== */}
            {myLatestEntry && (
                <div className="border-t border-border-divider mt-14 pt-10 mb-16">
                    {/* Section title */}
                    <div className="flex items-center gap-3 mb-8">
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

                    {/* Actions */}
                    <div className="flex gap-2 mt-6">
                        <AddToDiaryButton
                            albumId={albumId || album.id}
                            userId={userId}
                            initialSaved={isSaved}
                            existingEntriesCount={myEntriesCount}
                            autoOpen={autoOpenDiary}
                            onSuccess={() => setIsMyActivitiesOpen(true)}
                        />
                        <SaveAlbumButton albumId={albumId || album.id} initialSaved={isSaved} />
                    </div>
                </div>
            )}

            {/* If no My Activity, show buttons separately */}
            {!myLatestEntry && (
                <div className="mt-6 flex gap-2">
                    <AddToDiaryButton
                        albumId={albumId || album.id}
                        userId={userId}
                        initialSaved={isSaved}
                        existingEntriesCount={myEntriesCount}
                        autoOpen={autoOpenDiary}
                        onSuccess={() => setIsMyActivitiesOpen(myEntriesCount > 0)}
                    />
                    <SaveAlbumButton albumId={albumId || album.id} initialSaved={isSaved} />
                </div>
            )}

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

