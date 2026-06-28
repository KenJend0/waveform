"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertTrackDiaryEntry, deleteTrackDiaryEntry } from "@/app/actions/track-diary";
import { Edit2, Trash2 } from "lucide-react";
import StarRating from "@/components/StarRating";
import { showToast } from "@/components/Toast";
import BottomSheet from "@/components/BottomSheet";

type Props = {
  entryId: string;
  trackId: string;
  albumId: string;
  artistId: string;
  currentRating?: number | null;
  currentReview?: string | null;
  currentListenedAt?: string;
  headless?: boolean;
  externalEditOpen?: boolean;
  onExternalEditClose?: () => void;
  externalDeleteOpen?: boolean;
  onExternalDeleteClose?: () => void;
};

export default function EditTrackDiaryEntryButton({
  entryId,
  trackId,
  albumId,
  artistId,
  currentRating = null,
  currentReview = null,
  currentListenedAt,
  headless = false,
  externalEditOpen,
  onExternalEditClose,
  externalDeleteOpen,
  onExternalDeleteClose,
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolvedEditOpen = externalEditOpen ?? isEditOpen;
  const resolvedDeleteOpen = externalDeleteOpen ?? isDeleteConfirm;
  const closeEdit = onExternalEditClose ?? (() => setIsEditOpen(false));
  const closeDelete = onExternalDeleteClose ?? (() => setIsDeleteConfirm(false));

  const [rating, setRating] = useState<number | null>(currentRating ?? null);
  const [body, setBody] = useState(currentReview || "");
  const [listenedAt, setListenedAt] = useState(
    currentListenedAt ? currentListenedAt.split("T")[0] : today
  );

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!listenedAt) { showToast("Date requise", "error"); return; }
    setLoading(true);
    try {
      const result = await upsertTrackDiaryEntry({
        trackId,
        albumId,
        artistId,
        listenedAt,
        rating: rating ?? undefined,
        reviewBody: body || undefined,
        isPublic: true,
      });
      if (result.success) {
        showToast("Mis à jour !", "success");
        closeEdit();
        router.refresh();
      } else {
        showToast(result.error || "Erreur lors de la mise à jour", "error");
      }
    } catch {
      showToast("Erreur lors de la mise à jour", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const result = await deleteTrackDiaryEntry(entryId);
      if (result.success) {
        showToast("Écoute supprimée", "success");
        closeDelete();
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(`/tracks/${trackId}`);
        }
      } else {
        showToast(result.error || "Erreur lors de la suppression", "error");
      }
    } catch {
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!headless && (
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-1 text-text-tertiary hover:text-text-secondary transition-colors duration-150"
            title="Modifier"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => setIsDeleteConfirm(true)}
            className="p-1 text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Modal modifier */}
      <BottomSheet isOpen={resolvedEditOpen} onClose={closeEdit} title="Mettre à jour" maxHeight="h-[70vh]">
            <form onSubmit={handleUpdate} className="px-6 py-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-meta text-text-secondary">Note</span>
                  <span className="text-text-primary font-medium text-sm">{rating ?? 0} / 10</span>
                </div>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div>
                <label className="block text-label text-text-secondary mb-2">Date d'écoute</label>
                <div className="relative">
                  <input
                    type="date"
                    value={listenedAt}
                    max={today}
                    onChange={(e) => setListenedAt(e.target.value)}
                    className="w-full px-3 py-2 pr-9 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] text-meta appearance-none"
                  />
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none">
                    <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z" />
                  </svg>
                </div>
              </div>

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Vos pensées..."
                className="w-full h-36 resize-none border border-border rounded-[10px] p-3 text-meta bg-background-secondary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E]"
              />

              <div className="flex gap-2 pt-2 pb-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-meta transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-3 py-2.5 bg-[#1C1C1C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-meta disabled:opacity-50 transition-opacity"
                >
                  Mettre à jour
                </button>
              </div>
            </form>
      </BottomSheet>

      {/* Confirmation suppression */}
      <BottomSheet isOpen={resolvedDeleteOpen} onClose={closeDelete} title="Supprimer ?">
            <div className="px-6 py-4">
              <p className="text-label text-text-secondary mb-4">Cette action ne peut pas être annulée.</p>
              <div className="flex gap-2 pb-2">
                <button
                  onClick={closeDelete}
                  className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-meta transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-3 py-2.5 bg-[#C86C6C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-meta disabled:opacity-50 transition-opacity"
                >
                  Supprimer
                </button>
              </div>
            </div>
      </BottomSheet>
    </>
  );
}
