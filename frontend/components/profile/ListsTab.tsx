"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ListCard from "@/components/ListCard";
import { createList, deleteList, updateList, type UserList } from "@/app/actions/lists";
import { showToast } from "@/components/Toast";

type Props = {
    lists: UserList[];
    savedLists?: UserList[];
    isOwner?: boolean;
    userId?: string;
};

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

type ListFilter = "mine" | "saved" | "all";

function CreateListForm({ onCreated }: { onCreated: () => void }) {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        const t = title.trim();
        if (!t) return;
        setSaving(true);
        try {
            await createList({ title: t, isPublic });
            showToast(`Liste "${t}" créée`, "success");
            setTitle("");
            router.refresh();
            onCreated();
        } catch (err) {
            showToast(errorMessage(err, "Erreur lors de la création"), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mb-6 p-4 bg-background-secondary rounded-[12px] space-y-3">
            <p className="text-[13px] font-medium text-text-primary">Nouvelle liste</p>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Nom de la liste"
                autoFocus
                className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-[13px] text-text-primary outline-none focus:border-text-secondary"
            />
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setIsPublic((v) => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${isPublic ? "bg-text-primary" : "bg-border-divider"}`}
                >
                    <span
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-background transition-all duration-200"
                        style={{ left: isPublic ? "18px" : "2px" }}
                    />
                </button>
                <span className="text-[12px] text-text-secondary">{isPublic ? "Publique" : "Privée"}</span>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleCreate}
                    disabled={!title.trim() || saving}
                    className="px-4 py-1.5 rounded-[8px] text-[13px] font-medium bg-text-primary text-background disabled:opacity-40"
                >
                    {saving ? "Création…" : "Créer"}
                </button>
                <button
                    onClick={onCreated}
                    className="px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                >
                    Annuler
                </button>
            </div>
        </div>
    );
}

function ListCardWithMenu({ list }: { list: UserList }) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState(list.title);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleRename = async () => {
        const t = newTitle.trim();
        if (!t || t === list.title) { setRenaming(false); return; }
        setSaving(true);
        try {
            await updateList(list.id, { title: t });
            showToast("Renommée", "success");
            router.refresh();
        } catch (err) {
            showToast(errorMessage(err, "Erreur"), "error");
        } finally {
            setSaving(false);
            setRenaming(false);
        }
    };

    const handleToggleVisibility = async () => {
        setMenuOpen(false);
        try {
            await updateList(list.id, { isPublic: !list.is_public });
            showToast(list.is_public ? "Liste rendue privée" : "Liste rendue publique", "success");
            router.refresh();
        } catch (err) {
            showToast(errorMessage(err, "Erreur"), "error");
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteList(list.id);
            showToast("Liste supprimée", "success");
            router.refresh();
        } catch (err) {
            showToast(errorMessage(err, "Erreur lors de la suppression"), "error");
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <div className="relative">
            <ListCard list={list} href={`/lists/${list.id}`} />

            {/* Menu kebab */}
            <div className="absolute top-1 right-1">
                <button
                    onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
                    className="w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="2" r="1" fill="currentColor" className="text-text-secondary" />
                        <circle cx="6" cy="6" r="1" fill="currentColor" className="text-text-secondary" />
                        <circle cx="6" cy="10" r="1" fill="currentColor" className="text-text-secondary" />
                    </svg>
                </button>

                {menuOpen && (
                    <div className="absolute top-7 right-0 w-44 bg-background border border-border rounded-[10px] shadow-lg z-20 overflow-hidden">
                        <button
                            onClick={() => { setMenuOpen(false); setRenaming(true); }}
                            className="w-full text-left px-3 py-2.5 text-[13px] text-text-primary hover:bg-background-secondary transition-colors"
                        >
                            Renommer
                        </button>
                        {!list.is_default && (
                            <button
                                onClick={handleToggleVisibility}
                                className="w-full text-left px-3 py-2.5 text-[13px] text-text-primary hover:bg-background-secondary transition-colors"
                            >
                                {list.is_public ? "Rendre privée" : "Rendre publique"}
                            </button>
                        )}
                        {!list.is_default && (
                            <>
                                <div className="border-t border-border-divider" />
                                <button
                                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                                    className="w-full text-left px-3 py-2.5 text-[13px] text-red-500 hover:bg-background-secondary transition-colors"
                                >
                                    Supprimer
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modal confirmation suppression */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-[12px] p-6 max-w-md w-full border border-border">
                        <h2 className="text-meta font-medium font-sans text-text-primary mb-2">Supprimer cette liste ?</h2>
                        <p className="text-label text-text-secondary mb-4">Cette action ne peut pas être annulée.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="flex-1 px-3 py-2.5 bg-background-secondary hover:bg-background-tertiary text-text-primary rounded-[8px] text-meta transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 px-3 py-2.5 bg-[#C86C6C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-meta disabled:opacity-50 transition-opacity"
                            >
                                {deleting ? "Suppression…" : "Supprimer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename inline */}
            {renaming && (
                <div className="mt-2 flex gap-1">
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                        autoFocus
                        className="flex-1 min-w-0 bg-background border border-border rounded-[6px] px-2 py-1 text-[12px] text-text-primary outline-none focus:border-text-secondary"
                    />
                    <button
                        onClick={handleRename}
                        disabled={saving}
                        className="px-2 py-1 rounded-[6px] text-[11px] font-medium bg-text-primary text-background disabled:opacity-40"
                    >
                        OK
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ListsTab({ lists, savedLists = [], isOwner = false, userId }: Props) {
    const [creating, setCreating] = useState(false);
    const [filter, setFilter] = useState<ListFilter>("all");

    const showFilter = isOwner && savedLists.length > 0;
    const displayed = !showFilter
        ? lists
        : filter === "mine"
            ? lists
            : filter === "saved"
                ? savedLists
                : [...lists, ...savedLists];

    const isEmpty = displayed.length === 0;

    return (
        <div>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                {isOwner ? (
                    creating ? (
                        <CreateListForm onCreated={() => setCreating(false)} />
                    ) : (
                        <button
                            onClick={() => setCreating(true)}
                            className="flex items-center gap-2 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            Nouvelle liste
                        </button>
                    )
                ) : <span />}

                {showFilter && !creating && (
                    <div className="flex gap-1.5">
                        {([
                            ["all", "Tout"],
                            ["mine", "Mes listes"],
                            ["saved", "Sauvegardées"],
                        ] as const).map(([id, label]) => (
                            <button
                                key={id}
                                onClick={() => setFilter(id)}
                                className={`px-3 py-1 rounded-full text-label font-medium transition-colors ${
                                    filter === id
                                        ? "bg-text-primary text-background"
                                        : "bg-background-secondary text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {isEmpty && !creating ? (
                <div className="py-8 text-center">
                    <p className="text-[14px] text-text-secondary mb-1">
                        {!isOwner
                            ? "Aucune liste publique."
                            : filter === "saved"
                                ? "Aucune liste sauvegardée."
                                : "Tu n'as pas encore de listes."}
                    </p>
                    {isOwner && filter !== "saved" && (
                        <p className="text-[13px] text-text-tertiary">
                            Crée une liste ou ajoute un album depuis sa page.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                    {displayed.map((list) =>
                        isOwner && list.user_id === userId
                            ? <ListCardWithMenu key={list.id} list={list} />
                            : <ListCard key={list.id} list={list} href={`/lists/${list.id}`} />
                    )}
                </div>
            )}
        </div>
    );
}
