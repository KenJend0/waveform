"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, UserPlus, MessageCircle, AtSign, X } from "lucide-react";

type NotificationType = "like" | "follow" | "comment" | "mention" | "reply";

type Props = {
  id: string;
  type: NotificationType;
  actor_id: string;
  actor_display_name?: string;
  actor_username?: string;
  actor_avatar?: string;
  target_user_id?: string;
  target_display_name?: string;
  target_username?: string;
  target_album_id?: string;
  album_title?: string;
  album_cover?: string;
  message: string;
  is_read: boolean;
  created_at: string;
  timeDisplay: string;
  onMarkAsRead: () => void;
  onDelete: () => void;
};

export default function NotificationCard({
  id,
  type,
  actor_avatar,
  actor_display_name,
  actor_username,
  target_album_id,
  album_title,
  album_cover,
  target_username,
  message,
  is_read,
  timeDisplay,
  onMarkAsRead,
  onDelete,
}: Props) {
  const getIcon = () => {
    switch (type) {
      case "like":
        return <Heart size={20} className="fill-red-500 text-red-500" />;
      case "follow":
        return <UserPlus size={20} className="text-emerald-400" />;
      case "comment":
        return <MessageCircle size={20} className="text-blue-400" />;
      case "mention":
        return <AtSign size={20} className="text-purple-400" />;
      case "reply":
        return <MessageCircle size={20} className="text-blue-400" />;
    }
  };

  return (
    <article
      className={`card p-4 flex gap-3 items-start cursor-pointer transition group ${
        !is_read ? "border-l-4 border-emerald-400 bg-emerald-950/10" : ""
      }`}
      onClick={onMarkAsRead}
    >
      {/* Avatar */}
      <Link href={`/users/${actor_username}`} className="shrink-0">
        <Image
          src={actor_avatar || "/default-avatar.png"}
          alt={actor_display_name || "user"}
          width={48}
          height={48}
          className="rounded-full"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getIcon()}
          <Link
            href={`/users/${actor_username}`}
            className="font-semibold hover:text-emerald-400 transition truncate"
          >
            {actor_display_name}
          </Link>
        </div>

        <p className="text-sm text-gray-300 mb-2">{message}</p>

        {/* Album Preview */}
        {target_album_id && album_title && (
          <Link
            href={`/albums/${target_album_id}`}
            className="flex gap-2 items-center mb-2 hover:opacity-80 transition"
          >
            {album_cover && (
              <Image
                src={album_cover}
                alt={album_title}
                width={40}
                height={40}
                className="rounded"
              />
            )}
            <span className="text-xs text-gray-400 hover:text-emerald-400 truncate">
              {album_title}
            </span>
          </Link>
        )}

        <p className="text-xs text-gray-500">{timeDisplay}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {type === "follow" && (
          <button className="btn-primary text-xs px-3 py-1 opacity-0 group-hover:opacity-100 transition">
            Suivre
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 hover:bg-neutral-700 rounded transition opacity-0 group-hover:opacity-100"
          title="Supprimer"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>
    </article>
  );
}