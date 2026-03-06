"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlbumReviewsPreview } from "@/app/actions/diary";
import { showToast } from "@/components/Toast";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type Review = {
    id: string;
    user_id: string;
    rating: number | null;
    review_body: string | null;
    created_at: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
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
        <div>
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
        <div className="py-4 border-b border-border-divider last:border-0">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <Link href={profileLink} className="flex-shrink-0 mt-0.5">
                    <UserAvatar userId={review.user_id} src={review.avatar_url} size={28} />
                </Link>

                <div className="flex-1 min-w-0">
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
                            <span className="text-[14px] text-text-primary font-medium">
                                {review.rating}/10
                            </span>
                        )}
                    </div>

                    {/* Text */}
                    {review.review_body && (
                        <p className="text-[13px] text-text-secondary leading-relaxed break-words">
                            {review.review_body}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

