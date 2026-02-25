"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/app/actions/social";
import { showToast } from "@/components/Toast";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
  skipRefresh?: boolean;
}

export default function FollowButton({
  userId,
  initialIsFollowing,
  skipRefresh = false,
}: FollowButtonProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollow = async () => {
    try {
      setIsLoading(true);
      const result = await toggleFollow(userId);

      if (result.success && typeof result.following === "boolean") {
        setIsFollowing(result.following);
        if (!skipRefresh) router.refresh();
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      showToast("Impossible de mettre à jour l'abonnement", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={`px-6 py-2.5 text-[14px] font-medium rounded-[8px] transition-colors duration-150 ${
        isFollowing
          ? "bg-[#1C1C1C] text-[#F5F3EF] border-transparent hover:bg-[#1C1C1C]"
          : "bg-transparent text-text-primary border border-border hover:bg-background-secondary"
      } disabled:opacity-50`}
    >
      {isFollowing ? "Abonné" : "S'abonner"}
    </button>
  );
}

