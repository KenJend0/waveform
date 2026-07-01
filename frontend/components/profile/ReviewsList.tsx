"use client";

import { useState } from "react";
import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import { Heart, MessageCircle } from "lucide-react";
import type { UnifiedReview } from "@/app/actions/diary";
import { toggleDiaryLike } from "@/app/actions/diary";
import { toggleTrackDiaryLike } from "@/app/actions/track-diary";
import { showToast } from "@/components/ui/Toast";
import LikesBottomSheet from "@/components/ui/LikesBottomSheet";
import { useAuth } from "@/lib/AuthContext";
import { useRatingFilter } from "./RatingFilterContext";

type SortOption = "date_listened" | "personal_rating";

type Props = {
  reviews: UnifiedReview[];
};

const SORT_LABELS: Record<SortOption, string> = {
  date_listened: "Date d'écoute",
  personal_rating: "Ma note",
};

export default function ReviewsList({ reviews }: Props) {
  const { user } = useAuth();
  const { selectedRating } = useRatingFilter();
  const ratingFilter = selectedRating !== null ? selectedRating + 1 : null;
  const [sortBy, setSortBy] = useState<SortOption>("date_listened");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [openLikesEntry, setOpenLikesEntry] = useState<{ id: string; type: 'album' | 'track' } | null>(null);

  const [likesState, setLikesState] = useState<Record<string, { isLiked: boolean; likesCount: number; liking?: boolean }>>(() => {
    const s: Record<string, { isLiked: boolean; likesCount: number; liking?: boolean }> = {};
    reviews.forEach((r) => {
      s[r.id] = { isLiked: r.is_liked, likesCount: r.likes_count, liking: false };
    });
    return s;
  });

  const handleLike = async (entryId: string, type: 'album' | 'track') => {
    const cur = likesState[entryId];
    if (!cur || cur.liking) return;
    setLikesState((prev) => ({ ...prev, [entryId]: { ...prev[entryId], liking: true } }));
    try {
      if (type === 'track') {
        await toggleTrackDiaryLike(entryId);
      } else {
        await toggleDiaryLike(entryId);
      }
      const newLiked = !cur.isLiked;
      setLikesState((prev) => ({
        ...prev,
        [entryId]: { isLiked: newLiked, likesCount: newLiked ? cur.likesCount + 1 : Math.max(0, cur.likesCount - 1), liking: false },
      }));
    } catch {
      showToast("Impossible d'aimer la revue", "error");
      setLikesState((prev) => ({ ...prev, [entryId]: { ...prev[entryId], liking: false } }));
    }
  };

  if (reviews.length === 0)
    return <div className="text-center text-text-tertiary py-12">Aucune revue pour l'instant</div>;

  const filtered = ratingFilter !== null ? reviews.filter((r) => r.rating === ratingFilter) : reviews;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "personal_rating") return (b.rating || 0) - (a.rating || 0);
    const diff = new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
    return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      <div className="mb-6 relative inline-block">
        <button
          onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          className="text-label text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
        >
          Trié par: <span className="font-medium text-text-primary">{SORT_LABELS[sortBy]}</span>
          <span className="text-[10px]">▾</span>
        </button>
        {sortDropdownOpen && (
          <div className="absolute top-full mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max">
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([option, label]) => (
              <button
                key={option}
                onClick={() => { setSortBy(option); setSortDropdownOpen(false); }}
                className={`w-full text-left px-3 py-2 text-label transition-colors duration-150 ${
                  sortBy === option ? "bg-background-secondary text-text-primary font-medium" : "text-text-tertiary hover:bg-background-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-text-tertiary py-12">Aucune revue avec cette note</div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {sorted.map((review) => (
          <article
            key={`${review.type}-${review.id}`}
            className="relative min-w-0 p-4 border border-border transition-colors duration-150 flex gap-4 bg-background-secondary rounded-[12px] overflow-hidden"
          >
            {/* Barre accent gauche */}
            <div className="absolute left-0 top-5 bottom-5 w-0.5 bg-accent opacity-40 rounded-r-full" />

            {/* Cover */}
            {review.cover_url && (
              <Link href={review.href} className="flex-shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[10px] overflow-hidden bg-background-secondary">
                  <CoverImage
                    src={review.cover_url}
                    alt={review.title}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                    placeholder={<div className="w-full h-full bg-background-tertiary" />}
                  />
                </div>
              </Link>
            )}

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div className="mb-3">
                <div className="flex items-start gap-2 mb-0.5">
                  <Link href={review.href} className="hover:text-accent transition-colors duration-150 block flex-1 min-w-0">
                    <p className="font-display font-normal text-[18px] text-text-warm leading-snug line-clamp-2">{review.title}</p>
                  </Link>
                  <span className="font-display italic text-sm text-accent border border-accent rounded-full px-2 py-0.5 leading-snug flex-shrink-0 bg-[#FAF8F4]">
                    {review.type === 'track' ? 'titre' : 'album'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 mt-0.5">
                  <span className="text-text-tertiary text-label">{review.subtitle}</span>
                  {review.rating && (
                    <span className="inline-flex items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] px-1.5 py-0.5 text-accent font-display italic text-[15px] leading-none w-fit">
                      {Math.round(review.rating)}
                      <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
                    </span>
                  )}
                </div>
              </div>

              {review.review_body && (
                <p className="font-display italic text-meta leading-relaxed text-accent-deep line-clamp-3 mb-3">
                  &laquo;&thinsp;{review.review_body}&thinsp;&raquo;
                </p>
              )}

              <div className="flex items-center justify-end gap-4 pt-3 border-t border-rule">
                <div className="flex items-center gap-4 text-label text-text-tertiary">
                  <span className="flex items-center gap-1">
                    {user ? (
                      <button
                        onClick={() => handleLike(review.id, review.type)}
                        disabled={likesState[review.id]?.liking}
                        className="hover:text-like transition-colors duration-150 disabled:opacity-50"
                      >
                        <Heart
                          size={16}
                          className={likesState[review.id]?.isLiked ? "fill-like text-like" : ""}
                        />
                      </button>
                    ) : (
                      <Heart size={16} />
                    )}
                    {likesState[review.id]?.likesCount > 0 ? (
                      <button
                        onClick={() => setOpenLikesEntry({ id: review.id, type: review.type })}
                        className={`flex items-baseline gap-2 hover:underline ${likesState[review.id]?.isLiked ? "text-like" : ""}`}
                      >
                        <span>{likesState[review.id].likesCount}</span>
                        <span>J&apos;aime</span>
                      </button>
                    ) : (
                      <span className="ml-1">J&apos;aime</span>
                    )}
                  </span>
                  <Link
                    href={`${review.href}#comments`}
                    className="flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-150"
                  >
                    <MessageCircle size={14} />
                    <span>Répondre</span>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      )}

      {openLikesEntry && (
        <LikesBottomSheet
          entryId={openLikesEntry.id}
          contentType={openLikesEntry.type === 'track' ? 'track_diary_entry' : 'diary_entry'}
          isOpen={true}
          onClose={() => setOpenLikesEntry(null)}
          count={likesState[openLikesEntry.id]?.likesCount ?? 0}
        />
      )}
    </div>
  );
}
