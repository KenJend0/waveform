"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StarRating from "@/components/StarRating";
import BottomSheet from "@/components/BottomSheet";
import { upsertTrackDiaryEntry } from "@/app/actions/track-diary";
import { showToast } from "@/components/Toast";

type Props = {
    trackId: string;
    albumId: string;
    artistId: string;
    userId?: string;
    existingEntry?: {
        id: string;
        rating: number | null;
        reviewBody: string | null;
        listenedAt: string;
    } | null;
    source?: string;
};

export default function TrackDiaryInline({ trackId, albumId, artistId, userId, existingEntry, source }: Props) {
    const router = useRouter();
    const today = new Date().toISOString().split("T")[0];

    const [open, setOpen] = useState(false);
    const [rating, setRating] = useState<number | null>(existingEntry?.rating ?? null);
    const [comment, setComment] = useState(existingEntry?.reviewBody ?? "");
    const [listenedAt, setListenedAt] = useState(existingEntry?.listenedAt ?? today);
    const [submitting, setSubmitting] = useState(false);

    const handleClose = () => {
        setOpen(false);
        // Reset to existing values on cancel
        setRating(existingEntry?.rating ?? null);
        setComment(existingEntry?.reviewBody ?? "");
        setListenedAt(existingEntry?.listenedAt ?? today);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const result = await upsertTrackDiaryEntry({
                trackId,
                albumId,
                artistId,
                listenedAt,
                rating: rating ?? undefined,
                reviewBody: comment.trim() || undefined,
                isPublic: true,
                source,
            });
            if (result.success) {
                showToast(existingEntry ? "Note mise à jour" : "Écoute enregistrée", "success");
                setOpen(false);
                router.push(`/track-diary/${result.data!.id}`);
            } else {
                showToast(result.error || "Erreur lors de l'enregistrement", "error");
            }
        } catch {
            showToast("Erreur lors de l'enregistrement", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => {
                    if (!userId) {
                        showToast("Connecte-toi pour ajouter une écoute à ton journal", "error");
                        return;
                    }
                    setOpen(true);
                }}
                className="text-label text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-[8px] transition-colors duration-150 border border-border hover:border-[#8E6F5E]"
            >
                {existingEntry ? "Ré-écouter" : "Ajouter au journal"}
            </button>

            <BottomSheet
                isOpen={open}
                onClose={handleClose}
                title={existingEntry ? "Modifier ma note" : "Noter ce titre"}
                maxHeight="max-h-[85vh]"
            >
                <div className="px-6 py-5 space-y-6">
                    {/* Note */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-meta text-text-secondary">Note</span>
                            <span className="text-meta font-medium text-text-primary">
                                {rating !== null ? `${rating} / 10` : "–"}
                            </span>
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
                                className="w-full px-4 py-3 pr-10 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] appearance-none"
                            />
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none">
                                <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z" />
                            </svg>
                        </div>
                    </div>

                    {/* Texte libre */}
                    <div>
                        <label className="block text-meta text-text-secondary mb-2">Quelques mots</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Ce que tu as ressenti, si tu en as envie."
                            rows={4}
                            className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-3 bg-[#1C1C1C] text-[#F5F3EF] text-meta font-medium rounded-[8px] hover:opacity-85 disabled:opacity-50 transition-opacity"
                    >
                        {submitting ? "Enregistrement…" : "Enregistrer"}
                    </button>
                </div>
            </BottomSheet>
        </>
    );
}
