"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/app/actions/social";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
}

export default function FollowButton({
  userId,
  initialIsFollowing,
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
        router.refresh();
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
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
          ? "bg-background-secondary text-text-primary border border-border hover:bg-background-tertiary"
          : "bg-transparent text-text-primary border border-border hover:bg-background-secondary"
      } disabled:opacity-50`}
    >
      {isFollowing ? "Abonné" : "S'abonner"}
    </button>
  );
}

