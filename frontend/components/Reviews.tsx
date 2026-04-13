"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlbumReviewsPreview, type AlbumReview } from "@/app/actions/diary";
import { showToast } from "@/components/Toast";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type Review = AlbumReview;

export default function Reviews({ albumId, initialReviews }: { albumId: string; initialReviews?: AlbumReview[] }) {
    const [items, setItems] = useState<Review[]>(initialReviews ?? []);
    const [loading, setLoading] = useState(!initialReviews);

    useEffect(() => {
        // Skip fetch si les données ont été pré-chargées côté serveur
        if (initialReviews) return;

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
        <div className="space-y-3">
            {items.map((review) => (
                <ReviewItem key={review.id} review={review} />
            ))}
        </div>
    );
}

function ReviewItem({ review }: { review: Review }) {
    const displayName = review.username || "User";

    return (
        <Link
            href={`/diary/${review.id}`}
            className="block bg-background-secondary rounded-[10px] p-4 hover:opacity-75 transition-opacity duration-150"
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <UserAvatar userId={review.user_id} src={review.avatar_url} size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-baseline gap-1">
                            <span className="text-[14px] font-medium text-text-primary">{displayName}</span>
                            <span className="text-[12px] text-text-tertiary">
                                · {new Date(review.created_at).toLocaleDateString('fr-FR')}
                            </span>
                        </div>
                        {review.rating !== null && (
                            <span className="text-[14px] text-text-primary font-medium">{review.rating}/10</span>
                        )}
                    </div>
                    {review.review_body && (
                        <p className="text-[13px] text-text-secondary leading-relaxed break-words line-clamp-3">
                            {review.review_body}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}

