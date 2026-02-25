"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlbumReviewsPreview } from "@/app/actions/diary";
import { showToast } from "@/components/Toast";

type Review = {
    id: string;
    user_id: string;
    rating: number | null;
    review_body: string | null;
    created_at: string;
    display_name?: string | null;
    username?: string | null;
};

export default function Reviews({ albumId }: { albumId: string }) {
    const [items, setItems] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const entries = await getAlbumReviewsPreview(albumId, 3);
                setItems(entries);
            } catch (err) {
                console.error("Error loading reviews:", err);
                showToast("Impossible de charger les critiques", "error");
                setItems([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [albumId]);

    if (loading) return <p className="text-[14px] text-text-tertiary">Chargement...</p>;
    if (items.length === 0) return (
        <p className="text-[14px] text-text-tertiary">Aucune critique pour le moment.</p>
    );

    return (
        <div className="space-y-4">
            {items.map((review) => (
                <ReviewItem key={review.id} review={review} />
            ))}
        </div>
    );
}

function ReviewItem({ review }: { review: Review }) {
    const displayName = review.display_name || "User";
    const username = review.username || review.user_id;
    const profileLink = `/u/${username}`;

    return (
        <div className="border border-border-divider rounded-[12px] p-4">
            {/* Header */}
            <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1">
                    <Link
                        href={profileLink}
                        className="text-[14px] font-medium text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
                    >
                        {displayName}
                    </Link>
                    <span className="text-[12px] text-text-tertiary">
                        · {new Date(review.created_at).toLocaleDateString('fr-FR')}
                    </span>
                </div>
                {review.rating !== null && (
                    <span className="text-[14px] text-text-primary">
                        {review.rating}/10
                    </span>
                )}
            </div>

            {/* Text */}
            {review.review_body && (
                <p className="text-[14px] text-text-secondary leading-relaxed border-l-2 border-border pl-3 mt-3">
                    {review.review_body}
                </p>
            )}
        </div>
    );
}

