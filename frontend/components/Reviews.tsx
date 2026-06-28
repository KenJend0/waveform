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

    if (loading) return <p className="text-meta text-text-tertiary">Chargement...</p>;
    if (items.length === 0) return (
        <p className="text-meta text-text-tertiary">Aucune critique pour le moment.</p>
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

