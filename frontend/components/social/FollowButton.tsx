"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/app/actions/social";
import { showToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";

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
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollow = async () => {
    if (!user) {
      showToast("Connecte-toi pour suivre cet utilisateur", "error");
      return;
    }
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
      className={`px-5 py-2 text-meta font-medium rounded-pill transition-colors duration-150 inline-flex items-center justify-center gap-2 min-w-[90px] disabled:cursor-not-allowed ${
        isFollowing
          ? "bg-background-tertiary text-text-secondary hover:border hover:border-accent hover:text-accent"
          : "border border-sage text-sage hover:bg-sage hover:text-paper-hi"
      }`}
    >
      {isLoading ? (
        <>
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />
          {isFollowing ? "Suivi" : "Suivre"}
        </>
      ) : (
        isFollowing ? "Suivi" : "Suivre"
      )}
    </button>
  );
}

