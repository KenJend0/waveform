"use client";

import { useState } from "react";
import AlbumEntryMenu from "@/components/album/AlbumEntryMenu";
import MyActivitiesModal from "@/components/album/MyActivitiesModal";
import EditDiaryEntryButton from "@/components/album/EditDiaryEntryButton";

type Props = {
    albumId: string;
    userId?: string;
    entry: {
        id: string;
        rating: number | null;
        review_body: string | null;
        listened_at: string;
        created_at?: string;
    };
    entriesCount: number;
};

export default function MyListenSection({ albumId, userId, entry, entriesCount }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [addReviewOpen, setAddReviewOpen] = useState(false);

    return (
        <section className="border-b border-border-divider pb-12">
            <div className="flex items-center gap-3 mb-6">
                <h2 className="text-h2 text-text-primary">Mon écoute</h2>
                {entriesCount > 1 && (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                    >
                        voir toutes
                    </button>
                )}
            </div>

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
                        <AlbumEntryMenu
                            entryId={entry.id}
                            albumId={albumId}
                            currentRating={entry.rating}
                            currentReview={entry.review_body}
                            currentListenedAt={entry.listened_at}
                        />
                    )}
                </div>

                {entry.review_body ? (
                    <p className="font-display text-meta text-accent-deep italic leading-relaxed max-w-lg mb-3">
                        &laquo;&thinsp;{entry.review_body}&thinsp;&raquo;
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
                    {new Date(entry.listened_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
            </div>

            {userId && (
                <>
                    <MyActivitiesModal
                        albumId={albumId}
                        isOpen={isOpen}
                        onClose={() => setIsOpen(false)}
                    />
                    <EditDiaryEntryButton
                        entryId={entry.id}
                        albumId={albumId}
                        currentRating={entry.rating}
                        currentReview={entry.review_body}
                        currentListenedAt={entry.listened_at}
                        headless
                        externalEditOpen={addReviewOpen}
                        onExternalEditClose={() => setAddReviewOpen(false)}
                    />
                </>
            )}
        </section>
    );
}
