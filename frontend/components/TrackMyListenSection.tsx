"use client";

import { useState } from "react";
import TrackEntryMenu from "@/components/TrackEntryMenu";
import EditTrackDiaryEntryButton from "@/components/EditTrackDiaryEntryButton";

type Props = {
    trackId: string;
    albumId: string;
    artistId: string;
    userId?: string;
    entry: {
        id: string;
        rating: number | null;
        reviewBody: string | null;
        listenedAt: string;
    };
};

export default function TrackMyListenSection({ trackId, albumId, artistId, userId, entry }: Props) {
    const [addReviewOpen, setAddReviewOpen] = useState(false);

    return (
        <section className="border-b border-border-divider pb-12">
            <h2 className="text-h2 text-text-primary mb-6">Mon écoute</h2>

            <div className="relative bg-background-secondary rounded-[12px] p-4 pl-5">
                <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-accent opacity-50 rounded-r-full" />

                <div className="flex items-center justify-between mb-3">
                    {entry.rating && (
                        <span className="inline-flex items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] px-2 py-1 text-accent font-display italic text-[18px] leading-none">
                            {entry.rating}
                            <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
                        </span>
                    )}
                    {userId && (
                        <TrackEntryMenu
                            entryId={entry.id}
                            trackId={trackId}
                            albumId={albumId}
                            artistId={artistId}
                            currentRating={entry.rating}
                            currentReview={entry.reviewBody}
                            currentListenedAt={entry.listenedAt}
                        />
                    )}
                </div>

                {entry.reviewBody ? (
                    <p className="text-meta text-text-secondary italic leading-relaxed max-w-lg mb-3">
                        &laquo;&thinsp;{entry.reviewBody}&thinsp;&raquo;
                    </p>
                ) : userId && (
                    <button
                        onClick={() => setAddReviewOpen(true)}
                        className="block font-display italic text-meta text-accent hover:text-accent-deep transition-colors duration-150 mb-3"
                    >
                        + Ajouter une critique
                    </button>
                )}

                <span className="inline-flex items-center gap-1.5 bg-[#FAF8F4] border border-rule rounded-full px-2.5 py-1 font-display italic text-[12px] text-accent leading-none">
                    {new Date(entry.listenedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
            </div>

            {userId && (
                <EditTrackDiaryEntryButton
                    entryId={entry.id}
                    trackId={trackId}
                    albumId={albumId}
                    artistId={artistId}
                    currentRating={entry.rating}
                    currentReview={entry.reviewBody}
                    currentListenedAt={entry.listenedAt}
                    headless
                    externalEditOpen={addReviewOpen}
                    onExternalEditClose={() => setAddReviewOpen(false)}
                />
            )}
        </section>
    );
}
