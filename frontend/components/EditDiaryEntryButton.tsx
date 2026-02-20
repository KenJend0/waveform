"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertDiaryEntry, deleteDiaryEntry } from "@/app/actions/diary";
import { Edit2, Trash2 } from "lucide-react";
import StarIcon from "@/components/icons/StarIcon";

type EditDiaryEntryButtonProps = {
  entryId: string;
  albumId: string;
  currentRating?: number | null;
  currentReview?: string | null;
  currentListenedAt?: string;
  onUpdated?: () => void;
  showDelete?: boolean;
  variant?: "compact" | "full";
};

export default function EditDiaryEntryButton({
  entryId,
  albumId,
  currentRating = null,
  currentReview = null,
  currentListenedAt,
  onUpdated,
  showDelete = true,
  variant = "compact",
}: EditDiaryEntryButtonProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  // Form state
  const [rating, setRating] = useState<number | null>(currentRating ?? null);
  const [body, setBody] = useState(currentReview || "");
  const [listenedAt, setListenedAt] = useState<string>(
    currentListenedAt ? currentListenedAt.split("T")[0] : today
  );

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (!listenedAt) {
      setStatus("Date requise");
      setLoading(false);
      return;
    }

    try {
      const result = await upsertDiaryEntry({
        albumId,
        listenedAt,
        rating: rating ?? 0,
        reviewBody: body || undefined,
      });

      if (result.success) {
        setStatus("Mis Ã  jour !");
        setTimeout(() => {
          setIsEditOpen(false);
          setStatus(null);
          router.refresh();
          onUpdated?.();
        }, 1000);
      } else {
        setStatus(`Erreur : ${result.error}`);
      }
    } catch (err) {
      setStatus(`Erreur : ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setStatus(null);

    try {
      const result = await deleteDiaryEntry(entryId);

      if (result.success) {
        setStatus("SupprimÃ© !");
        setTimeout(() => {
          setIsDeleteConfirm(false);
          setStatus(null);
          router.refresh();
          onUpdated?.();
        }, 1000);
      } else {
        setStatus(`Erreur : ${result.error}`);
      }
    } catch (err) {
      setStatus(`Erreur : ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <>
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-1 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
            title="Modifier"
          >
            <Edit2 size={14} />
          </button>
          {showDelete && (
            <button
              onClick={() => setIsDeleteConfirm(true)}
              className="p-1 text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Edit Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-[12px] p-6 max-w-md w-full border border-border">
              <h2 className="text-[14px] font-medium text-text-primary mb-section-sm">Mettre Ã  jour</h2>

              <form onSubmit={handleUpdate} className="mt-3 space-y-3">
                {/* Stars Rating */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`transition-opacity duration-150 ${
                        rating && rating >= star
                          ? "opacity-100"
                          : "opacity-30 hover:opacity-60"
                      }`}
                    >
                      <StarIcon filled={!!(rating && rating >= star)} />
                    </button>
                  ))}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[12px] text-text-secondary mb-2">Date d'ecoute</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={listenedAt}
                      max={today}
                      onChange={(e) => setListenedAt(e.target.value)}
                      className="w-full px-3 py-2 pr-9 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] text-[14px] appearance-none"
                    />
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none"
                    >
                      <path
                        fill="currentColor"
                        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Vos pensÃ©es..."
                  className="w-full border border-border rounded-[10px] p-3 text-[14px] bg-background-secondary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
                />

                {status && (
                  <p className="text-[12px] font-medium text-text-primary bg-background-secondary rounded-[8px] px-3 py-2">
                    {status}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-[14px] transition-colors duration-150"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-3 py-2.5 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-[14px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                  >
                    Mettre Ã  jour
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {isDeleteConfirm && (
          <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-[12px] p-6 max-w-md w-full border border-border">
              <h2 className="text-[14px] font-medium text-text-primary mb-2">Supprimer ?</h2>
              <p className="text-[12px] text-text-secondary mb-section-sm">Cette action ne peut pas Ãªtre annulÃ©e.</p>

              {status && (
                <p className="text-[12px] font-medium text-text-primary bg-background-secondary rounded-[8px] px-3 py-2 mb-4">
                  {status}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setIsDeleteConfirm(false)}
                  className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-[14px] transition-colors duration-150"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-3 py-2.5 bg-[#C86C6C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-[14px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full variant not implemented for now
  return null;
}

