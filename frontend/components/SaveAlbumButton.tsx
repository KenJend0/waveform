"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSaveAlbum } from "@/app/actions/saved-albums";
import { showToast } from "@/components/Toast";

type SaveAlbumButtonProps = {
  albumId: string;
  initialSaved?: boolean;
};

export default function SaveAlbumButton({
  albumId,
  initialSaved = false,
}: SaveAlbumButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSaveToggle() {
    try {
      setLoading(true);
      const result = await toggleSaveAlbum(albumId);
      setSaved(result.saved);
      router.refresh();
    } catch (err) {
      console.error("Error toggling save:", err);
      showToast("Impossible de sauvegarder cet album", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSaveToggle}
      disabled={loading}
      className={`text-[12px] px-3 py-1.5 rounded-[8px] transition-colors duration-150 border ${
        saved
          ? "bg-[#1C1C1C] text-[#F5F3EF] border-[#1C1C1C] hover:opacity-85"
          : "text-text-secondary hover:text-text-primary border-border hover:border-[#8E6F5E]"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {saved ? "Sauvegardé" : "Sauvegarder"}
    </button>
  );
}

