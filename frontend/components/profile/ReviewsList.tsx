"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import type { DiaryEntryUI } from "@/app/actions/diary";
import { toggleDiaryLike } from "@/app/actions/diary";
import { showToast } from "@/components/Toast";

type SortOption = "date_listened" | "release_date" | "personal_rating";

type Props = {
  reviews: DiaryEntryUI[];
};

const SORT_LABELS: Record<SortOption, string> = {
  date_listened: "Date d'écoute",
  release_date: "Date de parution",
  personal_rating: "Ma note",
};

export default function ReviewsList({ reviews }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>("date_listened");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Local optimistic like state per review
  const [likesState, setLikesState] = useState<Record<string, { isLiked: boolean; likesCount: number; liking?: boolean }>>(() => {
    const s: Record<string, { isLiked: boolean; likesCount: number; liking?: boolean }> = {};
    reviews.forEach((r) => {
      s[r.id] = { isLiked: r.is_liked ?? false, likesCount: r.likes_count ?? 0, liking: false };
    });
    return s;
  });

  useEffect(() => {
    const s: Record<string, { isLiked: boolean; likesCount: number; liking?: boolean }> = {};
    reviews.forEach((r) => {
      s[r.id] = { isLiked: r.is_liked ?? false, likesCount: r.likes_count ?? 0, liking: false };
    });
    setLikesState(s);
  }, [reviews]);

  const handleLike = async (entryId: string) => {
    const cur = likesState[entryId];
    if (!cur || cur.liking) return;
    setLikesState((prev) => ({ ...prev, [entryId]: { ...prev[entryId], liking: true } }));
    try {
      await toggleDiaryLike(entryId);
      const newLiked = !cur.isLiked;
      const newCount = newLiked ? cur.likesCount + 1 : Math.max(0, cur.likesCount - 1);
      setLikesState((prev) => ({ ...prev, [entryId]: { ...prev[entryId], isLiked: newLiked, likesCount: newCount, liking: false } }));
    } catch (err) {
      console.error('Like error:', err);
      showToast("Impossible d'aimer la revue", "error");
      setLikesState((prev) => ({ ...prev, [entryId]: { ...prev[entryId], liking: false } }));
    }
  };

  if (reviews.length === 0)
    return <div className="text-center text-text-tertiary py-12">Aucune revue pour l'instant</div>;

  // Sort reviews based on selected option
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case "date_listened": {
        const diff = new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
        return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      case "release_date":
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      case "personal_rating":
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  return (
    <div>
      {/* Sort selector - textual dropdown */}
      <div className="mb-6 relative inline-block">
        <button
          onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
        >
          Trié par: <span className="font-medium text-text-primary">{SORT_LABELS[sortBy]}</span>
          <span className="text-[10px]">▾</span>
        </button>

        {sortDropdownOpen && (
          <div className="absolute top-full mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max">
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([option, label]) => (
              <button
                key={option}
                onClick={() => {
                  setSortBy(option);
                  setSortDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                  sortBy === option
                    ? "bg-background-secondary text-text-primary font-medium"
                    : "text-text-tertiary hover:bg-background-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {sortedReviews.map((review) => (
        <article
          key={review.id}
          className="p-4 border border-border hover:border-[#8E6F5E] transition-colors duration-150 flex gap-4 bg-background-secondary rounded-[12px]"
        >
          {/* Album Cover - Left side */}
          {review.cover_url && (
            <Link href={`/diary/${review.id}`} className="flex-shrink-0">
              <Image
                src={review.cover_url}
                alt={review.album_title}
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-[10px] object-cover"
              />
            </Link>
          )}

          {/* Content - Right side */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {/* Info */}
            <div className="mb-3">
              <Link href={`/diary/${review.id}`} className="hover:text-[#8E6F5E] transition-colors duration-150 block">
                <h3 className="font-medium text-[14px] text-text-primary truncate">{review.album_title}</h3>
              </Link>
              <Link href={`/artists/${review.artist_id}`} className="text-text-tertiary text-[12px] hover:text-[#8E6F5E] transition-colors duration-150">
                {review.artist_name}
              </Link>
            </div>

            {/* Review body */}
            {review.review_body && (
              <p className="text-[14px] leading-[1.6] text-text-secondary line-clamp-3 mb-3">{review.review_body}</p>
            )}

            {/* Rating and engagement */}
            <div className="flex items-center justify-between pt-3 border-t border-border-divider">
              {review.rating && (
                <div className="text-[#8E6F5E] font-medium text-[12px]">
                  {Math.round(review.rating)}/10
                </div>
              )}
              <div className="flex items-center gap-2 text-[12px] text-text-tertiary ml-auto">
                <button
                  onClick={() => handleLike(review.id)}
                  disabled={likesState[review.id]?.liking}
                  className="flex items-center gap-1 hover:text-[#C86C6C] transition-colors duration-150 disabled:opacity-50"
                >
                  <Heart
                    size={14}
                    className={likesState[review.id]?.isLiked ? "fill-[#C86C6C] text-[#C86C6C]" : ""}
                  />
                  <span>{likesState[review.id]?.likesCount ?? review.likes_count}</span>
                </button>
                <Link
                  href={`/diary/${review.id}#comments`}
                  className="flex items-center gap-1 text-text-tertiary hover:text-text-primary transition-colors duration-150"
                >
                  <MessageCircle size={14} />
                  <span className="text-[12px]">{review.comments_count ?? 0}</span>
                </Link>
              </div>
            </div>
          </div>
        </article>
        ))}
      </div>
    </div>
  );
}

