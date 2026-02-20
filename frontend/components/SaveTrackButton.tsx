"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

type SaveAlbumButtonProps = {
  albumId: string;
};

export default function SaveTrackButton({ albumId }: SaveAlbumButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveAlbum = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // TODO: Implement save album functionality with Supabase
      // For now, just toggle the UI state
      setIsSaved(!isSaved);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button
      onClick={handleSaveAlbum}
      disabled={isSaving}
      className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-tertiary text-text-secondary hover:text-text-primary rounded-[8px] text-meta font-medium transition-colors duration-150 disabled:opacity-50"
    >
      <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}

