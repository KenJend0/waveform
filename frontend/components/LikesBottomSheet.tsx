"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BottomSheet from "@/components/BottomSheet";
import { getEntryLikes } from "@/app/actions/diary";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

type LikesBottomSheetProps = {
  entryId: string;
  isOpen: boolean;
  onClose: () => void;
  count: number;
};

type LikeUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function LikesBottomSheet({
  entryId,
  isOpen,
  onClose,
  count,
}: LikesBottomSheetProps) {
  const [likes, setLikes] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadLikes = async () => {
      setLoading(true);
      try {
        const result = await getEntryLikes(entryId);
        setLikes(result);
      } catch (err) {
        console.error("Error loading likes:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLikes();
  }, [isOpen, entryId]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`J'aime · ${count}`}
      maxHeight="max-h-[50vh]"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8E6F5E]" />
        </div>
      ) : likes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[14px] text-text-tertiary">
            Aucun like pour le moment
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-divider">
          {likes.map((user) => (
            <Link
              key={user.id}
              href={`/u/${user.username}`}
              onClick={onClose}
              className="flex items-center gap-3 px-6 py-3 hover:bg-background-secondary transition-colors duration-150"
            >
              <div className="flex-shrink-0 rounded-full overflow-hidden border border-border">
                <UserAvatar userId={user.id} src={user.avatar_url} size={36} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-text-primary truncate">
                  {user.username}
                </p>
                <p className="text-[12px] text-text-tertiary truncate">
                  @{user.username}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
