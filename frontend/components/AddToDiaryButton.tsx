"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertDiaryEntry } from "@/app/actions/diary";
import { toggleSaveAlbum } from "@/app/actions/saved-albums";
import { voteAlbumGenre } from "@/app/actions/metadata";
import { GENRE_FAMILIES, type GenreFamily } from "@/lib/genre-families";
import StarRating from "@/components/StarRating";
import BottomSheet from "@/components/BottomSheet";
import { showToast } from "@/components/Toast";

type AddToDiaryButtonProps = {
  albumId: string;
  userId?: string;
  initialSaved?: boolean;
  existingEntriesCount?: number;
  autoOpen?: boolean;
  source?: string;
  albumHasGenres?: boolean;
  onSuccess?: () => void;
};

export default function AddToDiaryButton({
  albumId,
  userId,
  initialSaved = false,
  existingEntriesCount = 0,
  autoOpen = false,
  source,
  albumHasGenres = true,
  onSuccess,
}: AddToDiaryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "genre-nudge">("form");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [genreVoting, setGenreVoting] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<GenreFamily | null>(null);
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
  const [listenedAt, setListenedAt] = useState<string>(today);
  const [removeFromSaved, setRemoveFromSaved] = useState<boolean>(initialSaved);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (!userId) {
      showToast("Vous devez être connecté pour ajouter une écoute", "error");
      return;
    }

    if (!listenedAt) {
      showToast("Date requise", "error");
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    try {
      const result = await upsertDiaryEntry({
        albumId,
        listenedAt,
        rating: rating ?? 0,
        reviewBody: body || undefined,
        relisten: hasExistingEntry,
        source,
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

        const entryId = result.data?.id ?? null;
        setSavedEntryId(entryId);

        if (!albumHasGenres) {
          setStep("genre-nudge");
        } else {
          showToast("Enregistré !", "success");
          setBody("");
          setRating(null);
          setIsOpen(false);
          setStep("form");
          if (entryId) {
            router.replace(`/diary/${entryId}`);
          } else {
            router.refresh();
          }
          onSuccess?.();
        }
      } else {
        showToast(result.error || "Erreur lors de l'enregistrement", "error");
      }
    } catch (err) {
      showToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  }

  function navigateAfterNudge() {
    setIsOpen(false);
    setStep("form");
    setBody("");
    setRating(null);
    if (savedEntryId) {
      router.replace(`/diary/${savedEntryId}`);
    } else {
      router.refresh();
    }
    onSuccess?.();
  }

  async function handleGenreVote(slug: string) {
    setGenreVoting(true);
    try {
      await voteAlbumGenre(albumId, slug);
    } catch {
      // best-effort
    } finally {
      setGenreVoting(false);
      setSelectedFamily(null);
      navigateAfterNudge();
    }
  }

  function handleFamilyClick(family: GenreFamily) {
    if (family.subgenres.length === 0) {
      handleGenreVote(family.slug);
    } else {
      setSelectedFamily(family);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          if (!userId) {
            showToast("Connecte-toi pour ajouter une écoute à ton journal", "error");
            return;
          }
          setIsOpen(true);
        }}
        className="text-sm font-medium bg-accent-deep text-[#FAF8F4] px-4 py-2 rounded-[8px] hover:opacity-90 transition-opacity duration-150"
      >
        {buttonLabel}
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => {
          if (step === "genre-nudge") { navigateAfterNudge(); return; }
          setIsOpen(false);
        }}
        title={step === "genre-nudge" ? "Un dernier truc" : (hasExistingEntry ? "Enregistrer une ré-écoute" : "Évaluer cet album")}
        maxHeight="h-[70vh]"
      >
        {step === "genre-nudge" && (
          <div className="px-6 py-4">
            {!selectedFamily ? (
              <>
                <p className="text-meta text-text-secondary mb-6">
                  Cet album n&apos;a pas encore de genre. Tu peux en suggérer un pour aider la communauté.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {GENRE_FAMILIES.map((f) => (
                    <button
                      key={f.slug}
                      onClick={() => handleFamilyClick(f)}
                      disabled={genreVoting}
                      className="px-3 py-1.5 rounded-full border border-border text-sm text-text-primary hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150 disabled:opacity-50"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={navigateAfterNudge}
                  className="w-full text-sm text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                >
                  Passer
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedFamily(null)}
                  className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors duration-150 mb-5"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {selectedFamily.label}
                </button>
                <p className="text-meta text-text-secondary mb-4">Un sous-genre plus précis ?</p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {selectedFamily.subgenres.map((sub) => (
                    <button
                      key={sub.slug}
                      onClick={() => handleGenreVote(sub.slug)}
                      disabled={genreVoting}
                      className="px-3 py-1.5 rounded-full border border-border text-sm text-text-primary hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150 disabled:opacity-50"
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleGenreVote(selectedFamily.slug)}
                  disabled={genreVoting}
                  className="w-full text-sm text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                >
                  Voter pour {selectedFamily.label} sans préciser
                </button>
              </>
            )}
          </div>
        )}
        {step === "form" && (
        <form onSubmit={submit} className="px-6 py-4 space-y-section-sm">
          {/* Rating */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-meta text-text-secondary">Note</label>
              <span className="text-text-primary font-medium text-sm">{rating ?? 0} / 10</span>
            </div>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-meta text-text-secondary mb-2">Date d'écoute</label>
            <div className="relative">
              <input
                type="date"
                value={listenedAt}
                max={today}
                onChange={(e) => setListenedAt(e.target.value)}
                className="w-full px-4 py-3 pr-10 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] text-meta appearance-none"
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
            <label className="block text-meta text-text-secondary mb-2">Quelques mots</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ce que tu as ressenti, si tu en as envie."
              className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] resize-none h-24 text-meta transition-colors duration-150"
            />
          </div>

          {initialSaved && (
            <label className="flex items-center gap-2 text-label text-text-secondary">
              <input
                type="checkbox"
                checked={removeFromSaved}
                onChange={(e) => setRemoveFromSaved(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Retirer des sauvegardes après ajout
            </label>
          )}

          <div className="flex gap-2 pt-2 pb-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-meta transition-colors duration-150"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="flex-1 px-6 py-2.5 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#BDBDBD] disabled:cursor-not-allowed text-[#F5F3EF] font-medium rounded-[8px] text-meta transition-opacity duration-150"
            >
              {loading || isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
        )}
      </BottomSheet>
    </>
  );
}

