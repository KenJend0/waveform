"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Share2, Link2, Edit2, Trash2 } from "lucide-react";
import EditDiaryEntryButton from "@/components/album/EditDiaryEntryButton";
import { showToast } from "@/components/ui/Toast";

type Props = {
    entryId: string;
    albumId: string;
    currentRating?: number | null;
    currentReview?: string | null;
    currentListenedAt?: string;
};

export default function AlbumEntryMenu({
    entryId,
    albumId,
    currentRating,
    currentReview,
    currentListenedAt,
}: Props) {
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleShare = async () => {
        setOpen(false);
        const url = `${window.location.origin}/diary/${entryId}`;
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try { await navigator.share({ url, title: "Mon écoute sur Waveform" }); } catch {}
        } else {
            await handleCopyLink();
        }
    };

    const handleCopyLink = async () => {
        setOpen(false);
        const url = `${window.location.origin}/diary/${entryId}`;
        try {
            await navigator.clipboard.writeText(url);
            showToast("Lien copié", "success");
        } catch {
            showToast("Impossible de copier le lien", "error");
        }
    };

    return (
        <div className="relative flex-shrink-0" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="p-1.5 rounded-[6px] text-text-tertiary hover:text-accent hover:bg-background-secondary transition-colors"
                title="Plus d'options"
            >
                <MoreHorizontal size={16} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[10px] shadow-[0_4px_12px_-4px_rgba(60,40,20,0.14)] z-50 py-1.5 overflow-hidden">
                    <p className="text-[9px] uppercase tracking-[0.22em] text-text-disabled px-3 pt-1.5 pb-1">Options</p>
                    <button
                        onClick={handleShare}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
                    >
                        <Share2 size={13} className="text-text-secondary flex-shrink-0" />
                        Partager
                    </button>
                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
                    >
                        <Link2 size={13} className="text-text-secondary flex-shrink-0" />
                        Copier le lien
                    </button>
                    <div className="h-px bg-[#C9C2B5] mx-2 my-1" />
                    <button
                        onClick={() => { setOpen(false); setEditOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
                    >
                        <Edit2 size={13} className="text-text-secondary flex-shrink-0" />
                        Modifier
                    </button>
                    <button
                        onClick={() => { setOpen(false); setDeleteOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#C86C6C] hover:bg-[#ECE8E1] transition-colors text-left"
                    >
                        <Trash2 size={13} className="flex-shrink-0" />
                        Supprimer
                    </button>
                </div>
            )}

            <EditDiaryEntryButton
                entryId={entryId}
                albumId={albumId}
                currentRating={currentRating}
                currentReview={currentReview}
                currentListenedAt={currentListenedAt}
                headless
                externalEditOpen={editOpen}
                onExternalEditClose={() => setEditOpen(false)}
                externalDeleteOpen={deleteOpen}
                onExternalDeleteClose={() => setDeleteOpen(false)}
            />
        </div>
    );
}
