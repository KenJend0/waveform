"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2 } from "lucide-react";

type Props = {
  event_id: string;
  created_at: string;
  user: { id: string; username?: string; display_name?: string; avatar?: string };
  album: { id: string; title: string; artist: string; cover_url?: string };
  rating?: number;
  review_body?: string;
  likes_count?: number;
  is_liked?: boolean;
  timeDisplay: string;
};

export default function FeedCardReview({
  user,
  album,
  rating,
  review_body,
  likes_count = 0,
  is_liked = false,
  timeDisplay,
}: Props) {
  // Convertir rating en entier (arrondir)
  const ratingInt = rating ? Math.round(rating) : null;
  const emptyStars = ratingInt ? Math.max(0, 5 - ratingInt) : 5;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 mb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/users/${user.username}`} className="flex items-center gap-3 hover:opacity-80 transition">
          <Image
            src={user.avatar || "/default-avatar.png"}
            alt={user.display_name || user.username || "user"}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div>
            <p className="font-semibold text-white">{user.display_name || user.username}</p>
            <p className="text-xs text-gray-400">{timeDisplay}</p>
          </div>
        </Link>
        {ratingInt && (
          <div className="text-emerald-400 text-lg" title={`Note: ${rating}/10`}>
            {"★".repeat(ratingInt)}{"☆".repeat(emptyStars)}
          </div>
        )}
      </div>

      {/* Album */}
      <Link href={`/albums/${album.id}`} className="flex gap-4 mb-4 hover:opacity-90 transition">
        {album.cover_url && (
          <Image
            src={album.cover_url}
            alt={album.title}
            width={80}
            height={80}
            className="rounded-lg shadow-md"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-lg text-white">{album.title}</h3>
          <p className="text-gray-400 text-sm">{album.artist}</p>
        </div>
      </Link>

      {/* Review Text */}
      {review_body && (
        <p className="text-gray-300 leading-relaxed mb-4 border-l-2 border-neutral-700 pl-3">
          {review_body}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <button className="flex items-center gap-1 hover:text-emerald-400 transition">
          <Heart className={is_liked ? "fill-emerald-400 text-emerald-400" : ""} size={18} />
          <span>{likes_count}</span>
        </button>
        <button className="flex items-center gap-1 hover:text-emerald-400 transition">
          <MessageCircle size={18} />
        </button>
        <button className="flex items-center gap-1 hover:text-emerald-400 transition">
          <Share2 size={18} />
        </button>
      </div>
    </motion.article>
  );
}