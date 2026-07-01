"use client";

import { useState } from "react";
import ReviewsBottomSheet from "@/components/album/ReviewsBottomSheet";
import Reviews from "@/components/album/Reviews";
import type { AlbumReview } from "@/app/actions/diary";

type AlbumReviewSectionProps = {
    albumId: string;
    reviewsCount?: number;
    initialReviews?: AlbumReview[];
};

export default function AlbumReviewSection({ albumId, reviewsCount = 0, initialReviews }: AlbumReviewSectionProps) {
    const [isReviewsSheetOpen, setIsReviewsSheetOpen] = useState(false);

    return (
        <>
            <div className="flex items-baseline justify-between mb-8">
                <h2 className="text-h2 text-text-primary">
                    Critiques
                </h2>
                {reviewsCount > 0 && (
                    <button
                        onClick={() => setIsReviewsSheetOpen(true)}
                        className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                    >
                        voir toutes
                    </button>
                )}
            </div>
            <Reviews albumId={albumId} initialReviews={initialReviews} />

            {reviewsCount > 0 && (
                <ReviewsBottomSheet
                    albumId={albumId}
                    isOpen={isReviewsSheetOpen}
                    onClose={() => setIsReviewsSheetOpen(false)}
                />
            )}
        </>
    );
}

