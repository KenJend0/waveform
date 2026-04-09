"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/app/actions/social";
import { showToast } from "@/components/Toast";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
  skipRefresh?: boolean;
  eventSource?: string;
}

export default function FollowButton({
  userId,
  initialIsFollowing,
  skipRefresh = false,
  eventSource,
}: FollowButtonProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollow = async () => {
    try {
      setIsLoading(true);
      const result = await toggleFollow(userId, eventSource);

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
      className={`px-6 py-2.5 text-[14px] font-medium rounded-[8px] transition-colors duration-150 inline-flex items-center justify-center gap-2 min-w-[100px] ${
        isFollowing
          ? "bg-[#1C1C1C] text-[#F5F3EF] border-transparent hover:bg-[#1C1C1C]"
          : "bg-transparent text-text-primary border border-border hover:bg-background-secondary"
      } disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <>
          <span className={`h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0`} />
          {isFollowing ? "Abonné" : "S'abonner"}
        </>
      ) : (
        isFollowing ? "Abonné" : "S'abonner"
      )}
    </button>
  );
}

