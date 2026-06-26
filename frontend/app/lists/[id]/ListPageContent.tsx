"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoverImage } from "@/components/CoverImage";
import { updateList, deleteList, toggleListLike, removeListItem } from "@/app/actions/lists";
import { showToast } from "@/components/Toast";
import { toastErrorMessage } from "@/lib/toastErrors";
import type { ListItem, UserList } from "@/app/actions/lists";

type Tab = "tous" | "albums" | "titres";

type Props = {
    list: UserList & { creator_username: string; creator_avatar: string | null };
    items: ListItem[];
    isOwner: boolean;
    isAuthenticated: boolean;
};

function RemoveButton({ onRemove }: { onRemove: () => void }) {
    return (
        <button
            type="button"
            onClick={(e) => { e.preventDefault(); onRemove(); }}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/90 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors z-10"
            title="Retirer de la liste"
        >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-secondary" />
            </svg>
        </button>
    );
}

function AlbumCard({ item, onRemove }: { item: ListItem; onRemove?: () => void }) {
    const album = item.album!;
    return (
        <div className="relative group">
            {onRemove && <RemoveButton onRemove={onRemove} />}
            <Link href={`/albums/${album.id}`} className="block">
                <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative mb-2">
                    {album.cover_url ? (
                        <CoverImage
                            src={album.cover_url}
                            alt={album.title}
                            fill
                            className="object-cover group-hover:opacity-80 transition-opacity"
                            placeholder={<div className="w-full h-full bg-background-tertiary" />}
                        />
                    ) : (
                        <div className="w-full h-full bg-background-tertiary" />
                    )}
                </div>
                <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2 group-hover:text-[#8E6F5E] transition-colors">
                    {album.title}
                </p>
                <p className="text-label text-text-tertiary truncate mt-0.5">{album.artist}</p>
            </Link>
        </div>
    );
}

function TrackCard({ item, onRemove }: { item: ListItem; onRemove?: () => void }) {
    const track = item.track!;
    return (
        <div className="relative group">
            {onRemove && <RemoveButton onRemove={onRemove} />}
            <Link href={`/tracks/${track.id}`} className="block">
                <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative mb-2">
                    {track.cover_url ? (
                        <CoverImage
                            src={track.cover_url}
                            alt={track.title}
                            fill
                            className="object-cover group-hover:opacity-80 transition-opacity"
                            placeholder={<div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                                <span className="text-text-disabled text-2xl">♪</span>
                            </div>}
                        />
                    ) : (
                        <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                            <span className="text-text-disabled text-2xl">♪</span>
                        </div>
                    )}
                </div>
                <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2 group-hover:text-[#8E6F5E] transition-colors">
                    {track.title}
                </p>
                <p className="text-label text-text-tertiary truncate mt-0.5">{track.artist}</p>
                <p className="text-[10px] text-text-disabled truncate">Titre</p>
            </Link>
        </div>
    );
}

function EditListForm({
    list,
    onClose,
}: {
    list: UserList & { creator_username: string; creator_avatar: string | null };
    onClose: () => void;
}) {
    const router = useRouter();
    const [title, setTitle] = useState(list.title);
    const [description, setDescription] = useState(list.description ?? "");
    const [isPublic, setIsPublic] = useState(list.is_public);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            await updateList(list.id, { title, description, isPublic });
            showToast("Liste mise à jour", "success");
            router.refresh();
            onClose();
        } catch (err) {
            showToast(toastErrorMessage(err, "Erreur lors de la mise à jour"), "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteList(list.id);
            showToast("Liste supprimée", "success");
            router.push("/me?tab=lists");
        } catch (err) {
            showToast(toastErrorMessage(err, "Erreur lors de la suppression"), "error");
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <div className="mt-4 p-4 bg-background-secondary rounded-[12px] space-y-4">
            <div>
                <label className="block text-label text-text-tertiary mb-1">Titre</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm text-text-primary outline-none focus:border-text-secondary"
                />
            </div>
            <div>
                <label className="block text-label text-text-tertiary mb-1">Description (optionnelle)</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm text-text-primary outline-none focus:border-text-secondary resize-none"
                />
            </div>
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
                <span className="text-sm text-text-secondary">{isPublic ? "Publique" : "Privée"}</span>
            </div>
            <div className="flex items-center gap-3 pt-1">
                <button
                    onClick={handleSave}
                    disabled={saving || !title.trim()}
                    className="px-4 py-1.5 rounded-[8px] text-sm font-medium bg-text-primary text-background disabled:opacity-40"
                >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-[8px] text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                    Annuler
                </button>
                {!list.is_default && (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="ml-auto text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                        Supprimer
                    </button>
                )}

                {confirmDelete && (
                    <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
                        <div className="bg-background rounded-[12px] p-6 max-w-md w-full border border-border">
                            <h2 className="text-meta font-medium text-text-primary mb-2">Supprimer cette liste ?</h2>
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
            </div>
        </div>
    );
}

function LikeButton({ listId, initialLiked, initialCount }: { listId: string; initialLiked: boolean; initialCount: number }) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        setLoading(true);
        setLiked((v) => !v);
        setCount((v) => liked ? v - 1 : v + 1);
        try {
            await toggleListLike(listId);
        } catch (err) {
            setLiked((v) => !v);
            setCount((v) => liked ? v + 1 : v - 1);
            showToast(toastErrorMessage(err, "Erreur"), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors duration-150 ${
                liked
                    ? "border-text-primary text-text-primary bg-transparent"
                    : "border-border text-text-secondary hover:border-text-secondary"
            }`}
        >
            <svg width="14" height="14" viewBox="0 0 14 14" fill={liked ? "currentColor" : "none"} className="shrink-0">
                <path d="M7 12s-5.5-3.5-5.5-7a3.5 3.5 0 0 1 5.5-2.87A3.5 3.5 0 0 1 12.5 5c0 3.5-5.5 7-5.5 7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            {count > 0 && <span>{count}</span>}
        </button>
    );
}

export default function ListPageContent({ list, items, isOwner, isAuthenticated }: Props) {
    const [tab, setTab] = useState<Tab>("tous");
    const [editing, setEditing] = useState(false);
    const [localItems, setLocalItems] = useState<ListItem[]>(items);

    const handleRemove = async (itemId: string) => {
        // Optimistic update
        setLocalItems((prev) => prev.filter((i) => i.id !== itemId));
        try {
            await removeListItem(itemId);
        } catch (err) {
            setLocalItems(items); // revert
            showToast(toastErrorMessage(err, "Erreur lors de la suppression"), "error");
        }
    };

    const albumItems = localItems.filter((i) => i.album_id && i.album);
    const trackItems = localItems.filter((i) => i.track_id && i.track);
    const hasAlbums = albumItems.length > 0;
    const hasTracks = trackItems.length > 0;
    const showFilter = hasAlbums && hasTracks;

    const displayed =
        tab === "albums" ? albumItems :
        tab === "titres" ? trackItems :
        localItems.filter((i) => (i.album_id && i.album) || (i.track_id && i.track));

    return (
        <>
            {/* Owner actions */}
            {isOwner && (
                <div className="mb-2">
                    <button
                        onClick={() => setEditing((v) => !v)}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                        {editing ? "Annuler" : "Modifier la liste"}
                    </button>
                    {editing && (
                        <EditListForm list={list} onClose={() => setEditing(false)} />
                    )}
                </div>
            )}

            {/* Like — visible pour les listes publiques non-propriétaires connectés */}
            {!isOwner && list.is_public && isAuthenticated && (
                <div className="mb-6">
                    <LikeButton
                        listId={list.id}
                        initialLiked={list.is_liked ?? false}
                        initialCount={list.likes_count}
                    />
                </div>
            )}

            {/* Compteur de likes — visible owner ou visiteur non connecté */}
            {(isOwner || !isAuthenticated) && list.likes_count > 0 && (
                <p className="text-label text-text-tertiary mb-6">
                    ♥ {list.likes_count} {list.likes_count === 1 ? "personne aime cette liste" : "personnes aiment cette liste"}
                </p>
            )}

            {/* Filter tabs — only shown when there are both albums and tracks */}
            {showFilter && (
                <div className="flex gap-1.5 mb-6">
                    {(["tous", "albums", "titres"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1 rounded-full text-label font-medium capitalize transition-colors ${
                                tab === t
                                    ? "bg-text-primary text-background"
                                    : "bg-background-secondary text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            {t === "tous" ? "Tout" : t === "albums" ? "Albums" : "Titres"}
                        </button>
                    ))}
                </div>
            )}

            {displayed.length === 0 ? (
                <p className="text-meta text-text-tertiary">Cette liste est vide.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                    {displayed.map((item) =>
                        item.album_id && item.album
                            ? <AlbumCard key={item.id} item={item} onRemove={isOwner ? () => handleRemove(item.id) : undefined} />
                            : item.track_id && item.track
                            ? <TrackCard key={item.id} item={item} onRemove={isOwner ? () => handleRemove(item.id) : undefined} />
                            : null
                    )}
                </div>
            )}
        </>
    );
}
