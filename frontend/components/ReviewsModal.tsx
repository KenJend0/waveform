"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getAlbumReviewsPage } from "@/app/actions/diary";
import { showToast } from "@/components/Toast";

type Review = {
    id: string;
    user_id: string;
    rating: number | null;
    review_body: string | null;
    created_at: string;
    username?: string | null;
};

type Tab = "my" | "friends" | "all";

type ReviewsModalProps = {
    albumId: string;
    isOpen: boolean;
    onClose: () => void;
};

export default function ReviewsModal({
    albumId,
    isOpen,
    onClose,
}: ReviewsModalProps) {
    const [items, setItems] = useState<Review[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [currentTab, setCurrentTab] = useState<Tab>("all");
    const [userId, setUserId] = useState<string | null>(null);
    const [hasFollowing, setHasFollowing] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setItems([]);
        setOffset(0);
        setHasMore(false);
        loadReviews(0, true);
    }, [isOpen, currentTab]);

    const loadReviews = async (startOffset: number, replace: boolean) => {
        setLoading(true);
        try {
            const result = await getAlbumReviewsPage({
                albumId,
                tab: currentTab,
                offset: startOffset,
                limit: 12,
            });

            setUserId(result.userId);
            setHasFollowing(result.hasFollowing);
            setHasMore(result.hasMore);
            setOffset(startOffset + result.items.length);
            setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
        } catch (err) {
                console.error("Error loading reviews:", err);
                showToast("Impossible de charger les critiques", "error");
                if (startOffset === 0) setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        await loadReviews(offset, false);
    };

    const handleTabChange = (tab: Tab) => {
        if (tab !== currentTab) {
            setCurrentTab(tab);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-[12px] max-w-2xl w-full max-h-[80vh] flex flex-col border border-border">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-border-divider">
                    <h2 className="text-body font-medium font-sans text-text-primary">Critiques</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-background-secondary rounded-[8px] transition-colors duration-150"
                    >
                        <X size={18} className="text-text-secondary" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-divider px-6">
                    <button
                        onClick={() => handleTabChange("all")}
                        className={`px-4 py-3 text-meta font-medium transition-colors duration-150 ${
                            currentTab === "all"
                                ? "border-b-2 border-[#1C1C1C] text-text-primary"
                                : "text-text-secondary hover:text-text-primary"
                        }`}
                    >
                        Tous
                    </button>
                    {userId && hasFollowing && (
                        <button
                            onClick={() => handleTabChange("friends")}
                            className={`px-4 py-3 text-meta font-medium transition-colors duration-150 ${
                                currentTab === "friends"
                                    ? "border-b-2 border-[#1C1C1C] text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            Amis
                        </button>
                    )}
                    {userId && (
                        <button
                            onClick={() => handleTabChange("my")}
                            className={`px-4 py-3 text-meta font-medium transition-colors duration-150 ${
                                currentTab === "my"
                                    ? "border-b-2 border-[#1C1C1C] text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            Moi
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading && items.length === 0 ? (
                        <p className="text-meta text-text-tertiary">Chargement...</p>
                    ) : items.length === 0 ? (
                        <p className="text-meta text-text-tertiary">
                            {currentTab === "my"
                                ? "Vous n'avez pas encore critiqué cet album"
                                : currentTab === "friends"
                                ? "Vos amis n'ont pas encore critiqué cet album"
                                : "Pas de critiques pour l'instant"}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {items.map((review) => (
                                <ReviewItem key={review.id} review={review} />
                            ))}
                            {hasMore && (
                                <button
                                    onClick={loadMore}
                                    className="w-full mt-4 px-4 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-meta font-medium transition-colors duration-150"
                                >
                                    Charger plus
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ReviewItem({ review }: { review: Review }) {
    const displayName = review.username || "User";
    const username = review.username || review.user_id;
    const profileLink = `/u/${username}`;

    return (
        <div className="py-4 border-b border-border-divider last:border-0">
            {/* Header */}
            <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1">
                    <Link
                        href={profileLink}
                        className="text-meta font-medium text-text-primary hover:text-[#8E6F5E] transition-colors duration-150"
                    >
                        {displayName}
                    </Link>
                    <span className="text-label text-text-tertiary">
                        · {new Date(review.created_at).toLocaleDateString('fr-FR')}
                    </span>
                </div>
                {review.rating !== null && (
                    <span className="text-meta text-text-primary">
                        {review.rating}/10
                    </span>
                )}
            </div>

            {/* Text */}
            {review.review_body && (
                <p className="font-display italic text-meta text-accent-deep leading-relaxed">
                    &laquo;&thinsp;{review.review_body}&thinsp;&raquo;
                </p>
            )}
        </div>
    );
}

