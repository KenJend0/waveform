"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toggleListItem, createList, getOrCreateDefaultList } from "@/app/actions/lists";
import { showToast } from "@/components/Toast";
import { type UserList } from "@/app/actions/lists";
import { toastErrorMessage } from "@/lib/toastErrors";

type Props = {
    albumId?: string;
    trackId?: string;
    userId?: string;
    userLists: Pick<UserList, "id" | "title" | "is_default">[];
    initialListsContaining: string[];
};

export default function AddToListButton({
    albumId,
    trackId,
    userId,
    userLists,
    initialListsContaining,
}: Props) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [listsContaining, setListsContaining] = useState<Set<string>>(
        new Set(initialListsContaining)
    );
    const [loadingListId, setLoadingListId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fermer au clic extérieur
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setIsCreating(false);
                setNewTitle("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    useEffect(() => {
        if (isCreating && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isCreating]);

    const handleOpen = () => {
        if (!userId) {
            showToast("Connecte-toi pour ajouter à une liste", "error");
            return;
        }
        setIsOpen((v) => !v);
    };

    const handleToggle = async (listId: string) => {
        setLoadingListId(listId);
        const wasIn = listsContaining.has(listId);
        // Optimistic update
        setListsContaining((prev) => {
            const next = new Set(prev);
            if (wasIn) next.delete(listId);
            else next.add(listId);
            return next;
        });
        try {
            await toggleListItem(listId, { albumId, trackId });
            router.refresh();
        } catch (err) {
            // Revert on error
            setListsContaining((prev) => {
                const next = new Set(prev);
                if (wasIn) next.add(listId);
                else next.delete(listId);
                return next;
            });
            showToast(toastErrorMessage(err, "Erreur, réessaie"), "error");
        } finally {
            setLoadingListId(null);
        }
    };

    const handleCreateAndAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;
        setIsSubmittingCreate(true);
        try {
            const newList = await createList({ title, isPublic: false });
            await toggleListItem(newList.id, { albumId, trackId });
            setListsContaining((prev) => new Set([...prev, newList.id]));
            setIsCreating(false);
            setNewTitle("");
            showToast(`Ajouté à "${title}"`, "success");
            router.refresh();
        } catch (err) {
            showToast(toastErrorMessage(err, "Erreur lors de la création"), "error");
        } finally {
            setIsSubmittingCreate(false);
        }
    };

    // Label du bouton
    const inCount = listsContaining.size;
    const label = inCount === 0
        ? "Ajouter à une liste"
        : inCount === 1
            ? `Dans ${userLists.find((l) => listsContaining.has(l.id))?.title ?? "une liste"}`
            : `Dans ${inCount} listes`;

    const isInAny = inCount > 0;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleOpen}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-sm font-medium transition-colors duration-150 ${
                    isInAny
                        ? "text-accent border border-accent bg-transparent hover:bg-background-secondary"
                        : "text-text-tertiary bg-transparent hover:text-text-primary"
                }`}
            >
                {isInAny ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                        <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                )}
                <span className="truncate max-w-[140px]">{label}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-background border border-border rounded-[12px] shadow-lg z-50 overflow-hidden">
                    {/* Listes existantes */}
                    {userLists.length > 0 && (
                        <div className="py-1">
                            {userLists.map((list) => {
                                const checked = listsContaining.has(list.id);
                                const loading = loadingListId === list.id;
                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleToggle(list.id)}
                                        disabled={loading}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background-secondary transition-colors text-left disabled:opacity-50"
                                    >
                                        <span
                                            className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${
                                                checked
                                                    ? "bg-text-primary border-text-primary"
                                                    : "border-border-divider bg-transparent"
                                            }`}
                                        >
                                            {checked && (
                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="text-[13px] text-text-primary truncate flex-1">
                                            {list.title}
                                        </span>
                                        {list.is_default && (
                                            <span className="text-[10px] text-text-tertiary shrink-0">par défaut</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {userLists.length > 0 && <div className="border-t border-border-divider" />}

                    {/* Créer une liste */}
                    {!isCreating ? (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background-secondary transition-colors text-left"
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-text-tertiary">
                                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <span className="text-[13px] text-text-secondary">Créer une liste</span>
                        </button>
                    ) : (
                        <div className="px-3 py-3">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateAndAdd();
                                    if (e.key === "Escape") {
                                        setIsCreating(false);
                                        setNewTitle("");
                                    }
                                }}
                                placeholder="Nom de la liste"
                                className="w-full bg-background-secondary border border-border rounded-[8px] px-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-disabled outline-none focus:border-text-secondary mb-2"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateAndAdd}
                                    disabled={!newTitle.trim() || isSubmittingCreate}
                                    className="flex-1 py-1.5 rounded-[8px] text-[12px] font-medium bg-text-primary text-background disabled:opacity-40 transition-opacity"
                                >
                                    {isSubmittingCreate ? "…" : "Créer"}
                                </button>
                                <button
                                    onClick={() => { setIsCreating(false); setNewTitle(""); }}
                                    className="px-3 py-1.5 rounded-[8px] text-[12px] text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
