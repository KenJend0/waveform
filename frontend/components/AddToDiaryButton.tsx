"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertDiaryEntry } from "@/app/actions/diary";
import { toggleSaveAlbum } from "@/app/actions/saved-albums";
import StarRating from "@/components/StarRating";
import { showToast } from "@/components/Toast";

type AddToDiaryButtonProps = {
  albumId: string;
  userId?: string;
  initialSaved?: boolean;
  existingEntriesCount?: number;
  autoOpen?: boolean;
  onSuccess?: () => void;
};

export default function AddToDiaryButton({
  albumId,
  userId,
  initialSaved = false,
  existingEntriesCount = 0,
  autoOpen = false,
  onSuccess,
}: AddToDiaryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const hasExistingEntry = existingEntriesCount > 0;
  const buttonLabel = hasExistingEntry ? "Ré-écouter" : "Ajouter au journal";

  useEffect(() => {
    if (autoOpen && userId && !autoOpened) {
      setIsOpen(true);
      setAutoOpened(true);
    }
  }, [autoOpen, userId, autoOpened]);

  // Form state
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [listenedAt, setListenedAt] = useState<string>(today);
  const [removeFromSaved, setRemoveFromSaved] = useState<boolean>(initialSaved);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (!userId) {
      setStatus("Vous devez être connecté pour ajouter une écoute");
      return;
    }

    if (!listenedAt) {
      setStatus("Date requise");
      return;
    }

    setLoading(true);
    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await upsertDiaryEntry({
        albumId,
        listenedAt,
        rating: rating ?? 0,
        reviewBody: body || undefined,
        relisten: hasExistingEntry,
      });

      if (result.success) {
        if (removeFromSaved) {
          try {
            await toggleSaveAlbum(albumId);
          } catch (err) {
                console.error("Error removing from saved albums:", err);
                showToast("Impossible de retirer l'album des sauvegardes", "error");
          }
        }

        setStatus("Enregistré !");
        setTimeout(() => {
          setBody("");
          setRating(null);
          setStatus(null);
          setIsOpen(false);
          if (result.data?.id) {
            router.replace(`/diary/${result.data.id}`);
          } else {
            router.refresh();
          }
          onSuccess?.();
        }, 1000);
      } else {
        setStatus(`Erreur : ${result.error}`);
      }
    } catch (err) {
      setStatus(`Erreur : ${String(err)}`);
      showToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  }

  if (!userId) {
    return (
      <button
        disabled
        className="text-[12px] text-text-disabled px-3 py-1.5 rounded-[8px] opacity-50 cursor-not-allowed"
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-[12px] text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-[8px] transition-colors duration-150 border border-border hover:border-[#8E6F5E]"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-[12px] p-6 max-w-md w-full border border-border">
            <h2 className="text-[14px] font-medium text-text-primary mb-section-sm">
              {hasExistingEntry ? "Enregistrez une ré-écoute" : "Évaluez cet album"}
            </h2>

            <form onSubmit={submit} className="space-y-section-sm">
              {/* Rating */}
              <div>
                <label className="block text-[14px] text-text-secondary mb-3">Note</label>
                <div className="flex items-center gap-3">
                  <StarRating value={rating} onChange={setRating} />
                  <span className="text-text-primary font-medium text-[14px] whitespace-nowrap">
                    {rating ?? 0} / 10
                  </span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[14px] text-text-secondary mb-2">Date d'écoute</label>
                <div className="relative">
                  <input
                    type="date"
                    value={listenedAt}
                    max={today}
                    onChange={(e) => setListenedAt(e.target.value)}
                    className="w-full px-4 py-3 pr-10 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] text-[14px] appearance-none"
                  />
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none"
                  >
                    <path
                      fill="currentColor"
                      d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z"
                    />
                  </svg>
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-[14px] text-text-secondary mb-2">Quelques mots</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Ce que tu as ressenti, si tu en as envie."
                  className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] resize-none h-24 text-[14px] transition-colors duration-150"
                />
              </div>

              {status && (
                <p className="text-[12px] font-medium text-text-primary bg-background-secondary rounded-[8px] px-3 py-2">
                  {status}
                </p>
              )}

              {initialSaved && (
                <label className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={removeFromSaved}
                    onChange={(e) => setRemoveFromSaved(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Retirer des sauvegardes après ajout
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-[14px] transition-colors duration-150"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || isSubmitting}
                  className="flex-1 px-6 py-2.5 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#BDBDBD] disabled:cursor-not-allowed text-[#F5F3EF] font-medium rounded-[8px] text-[14px] transition-opacity duration-150"
                >
                  {loading || isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

