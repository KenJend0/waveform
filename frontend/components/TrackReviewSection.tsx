"use client";

import { useState } from "react";
import Link from "next/link";
import { type TrackReview } from "@/app/actions/track-diary";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import TrackReviewsBottomSheet from "@/components/TrackReviewsBottomSheet";

type Props = {
    trackId: string;
    initialReviews?: TrackReview[];
    reviewsCount?: number;
};

export default function TrackReviewSection({ trackId, initialReviews = [], reviewsCount = 0 }: Props) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    return (
        <>
            <div className="flex items-baseline justify-between mb-8">
                <h2 className="text-h2 text-text-primary">Critiques</h2>
                {reviewsCount > 0 && (
                    <button
                        onClick={() => setIsSheetOpen(true)}
                        className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                    >
                        voir toutes
                    </button>
                )}
            </div>

            {initialReviews.length === 0 ? (
                <p className="text-meta text-text-tertiary">Aucune critique pour le moment.</p>
            ) : (
                <div className="space-y-3">
                    {initialReviews.map((review) => (
                        <ReviewItem key={review.id} review={review} />
                    ))}
                </div>
            )}

            {reviewsCount > 0 && (
                <TrackReviewsBottomSheet
                    trackId={trackId}
                    isOpen={isSheetOpen}
                    onClose={() => setIsSheetOpen(false)}
                />
            )}
        </>
    );
}

function ReviewItem({ review }: { review: TrackReview }) {
    const displayName = review.username || "Utilisateur";

    return (
        <Link
            href={`/track-diary/${review.id}`}
            className="block bg-background-secondary rounded-[10px] p-4 hover:opacity-75 transition-opacity duration-150"
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <UserAvatar userId={review.user_id} src={review.avatar_url} size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-baseline gap-1">
                            <span className="text-meta font-medium text-text-primary">{displayName}</span>
                            <span className="text-label text-text-tertiary">
                                · {new Date(review.created_at).toLocaleDateString('fr-FR')}
                            </span>
                        </div>
                        {review.rating !== null && (
                            <span className="inline-flex items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] px-1.5 py-0.5 text-accent font-display italic text-[15px] leading-none">
                                {review.rating}
                                <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
                            </span>
                        )}
                    </div>
                    {review.review_body && (
                        <p className="font-display italic text-sm text-accent-deep leading-relaxed break-words line-clamp-3">
                            &laquo;&thinsp;{review.review_body}&thinsp;&raquo;
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}
