"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voteAlbumGenre } from "@/app/actions/metadata";
import { GENRE_FAMILIES, type GenreFamily } from "@/lib/genre-families";
import BottomSheet from "@/components/ui/BottomSheet";
import { showToast } from "@/components/ui/Toast";

type Props = {
    genres: string[];
    albumId: string;
    userId?: string;
    genreWeights?: Record<string, number>;
    className?: string;
};

export default function GenrePills({ genres, albumId, userId, genreWeights, className }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [voting, setVoting] = useState(false);
    const [selectedFamily, setSelectedFamily] = useState<GenreFamily | null>(null);

    async function handleVote(slug: string, opts?: { silent?: boolean }) {
        setVoting(true);
        try {
            await voteAlbumGenre(albumId, slug);
            if (!opts?.silent) {
                showToast("Genre suggéré, merci !", "success");
                setSelectedFamily(null);
                setOpen(false);
            }
            router.refresh();
        } catch (err: any) {
            const msg = err?.message?.includes('Limite') ? err.message : "Erreur lors du vote";
            showToast(msg, "error");
        } finally {
            setVoting(false);
        }
    }

    function handleFamilyClick(family: GenreFamily) {
        if (family.subgenres.length === 0) {
            handleVote(family.slug);
        } else {
            // Le vote sur la famille est immédiat ; le sous-genre n'est qu'un raffinement optionnel.
            handleVote(family.slug, { silent: true });
            setSelectedFamily(family);
        }
    }

    return (
        <>
            <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
                {genres.map((g) => {
                    const votes = genreWeights?.[g];
                    const isHeavy = votes != null && votes > 0;
                    return (
                        <span
                            key={g}
                            className={`text-[11px] tracking-[0.02em] rounded-full px-2.5 py-1 capitalize border ${
                                isHeavy
                                    ? 'border-[#B8AFA0] text-text-warm'
                                    : 'border-rule text-text-secondary'
                            }`}
                        >
                            {g}
                        </span>
                    );
                })}
                {userId && (
                    <button
                        onClick={() => setOpen(true)}
                        className="text-label text-text-tertiary border border-border rounded-full px-2.5 py-0.5 hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150"
                    >
                        + Genre
                    </button>
                )}
            </div>

            <BottomSheet
                isOpen={open}
                onClose={() => { setSelectedFamily(null); setOpen(false); }}
                title="Suggérer un genre"
                maxHeight="h-[60vh]"
            >
                <div className="px-6 py-4">
                    {!selectedFamily ? (
                        <div className="flex flex-wrap gap-2">
                            {GENRE_FAMILIES.map((f) => (
                                <button
                                    key={f.slug}
                                    onClick={() => handleFamilyClick(f)}
                                    disabled={voting}
                                    className="px-3 py-1.5 rounded-full border border-border text-sm text-text-primary hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150 disabled:opacity-50"
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
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
                            <p className="text-meta text-text-secondary mb-4">
                                Vote enregistré pour <span className="text-text-primary">{selectedFamily.label}</span>. Tu peux préciser le sous-genre si tu le connais (optionnel) :
                            </p>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {selectedFamily.subgenres.map((sub) => (
                                    <button
                                        key={sub.slug}
                                        onClick={() => handleVote(sub.slug)}
                                        disabled={voting}
                                        className="px-3 py-1.5 rounded-full border border-border text-sm text-text-primary hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150 disabled:opacity-50"
                                    >
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => { setSelectedFamily(null); setOpen(false); }}
                                className="w-full text-sm text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                            >
                                Terminé
                            </button>
                        </>
                    )}
                </div>
            </BottomSheet>
        </>
    );
}
