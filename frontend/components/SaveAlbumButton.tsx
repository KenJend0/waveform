"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSaveAlbum } from "@/app/actions/saved-albums";
import { showToast } from "@/components/Toast";

type SaveAlbumButtonProps = {
  albumId: string;
  initialSaved?: boolean;
  userId?: string;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function SaveAlbumButton({
  albumId,
  initialSaved = false,
  userId,
}: SaveAlbumButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSaveToggle() {
    if (!userId) {
      showToast("Connecte-toi pour sauvegarder un album", "error");
      return;
    }
    try {
      setLoading(true);
      const result = await toggleSaveAlbum(albumId);
      setSaved(result.saved);
      router.refresh();
    } catch (err) {
      console.error("Error toggling save:", err);
      showToast(errorMessage(err, "Impossible de sauvegarder cet album"), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSaveToggle}
      disabled={loading}
      className={`text-label px-3 py-1.5 rounded-[8px] transition-colors duration-150 border ${
        !userId
          ? "text-text-tertiary border-border opacity-50 cursor-default"
          : saved
          ? "bg-[#1C1C1C] text-[#F5F3EF] border-[#1C1C1C] hover:opacity-85"
          : "text-text-secondary hover:text-text-primary border-border hover:border-[#8E6F5E]"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {saved ? "Sauvegardé" : "Sauvegarder"}
    </button>
  );
}
