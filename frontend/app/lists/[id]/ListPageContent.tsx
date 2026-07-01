"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ArrowUpDown, Info, Trash2 } from "lucide-react";
import { CoverImage } from "@/components/album/CoverImage";
import BottomSheet from "@/components/ui/BottomSheet";
import { updateList, deleteList, removeListItem, toggleListItem, reorderListItems } from "@/app/actions/lists";
import { uploadListCover, removeListCover } from "@/app/actions/listCoverActions";
import { showToast } from "@/components/ui/Toast";
import { toastErrorMessage } from "@/lib/toastErrors";
import { useDismissOnOutsideOrScroll } from "@/lib/useDismissOnOutsideOrScroll";
import { useListSave } from "@/lib/useListSave";
import AlbumSearchForDiary, { type AlbumUI } from "@/components/album/AlbumSearchForDiary";
import TrackSearchForDiary, { type TrackUI } from "@/components/track/TrackSearchForDiary";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ListViewToggle from "@/components/lists/ListViewToggle";
import { CoverCollage, BookmarkIcon } from "@/components/lists/ListCard";
import type { ListItem, UserList } from "@/app/actions/lists";

type Tab = "tous" | "albums" | "titres";

type Props = {
    list: UserList & { creator_username: string; creator_avatar: string | null };
    items: ListItem[];
    isOwner: boolean;
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
    isOpen,
    onClose,
    customCoverUrl,
    onCoverRemoved,
}: {
    list: UserList & { creator_username: string; creator_avatar: string | null };
    isOpen: boolean;
    onClose: () => void;
    customCoverUrl: string | null;
    onCoverRemoved: () => void;
}) {
    const router = useRouter();
    const [title, setTitle] = useState(list.title);
    const [description, setDescription] = useState(list.description ?? "");
    const [isPublic, setIsPublic] = useState(list.is_public);
    const [saving, setSaving] = useState(false);
    const [removingCover, setRemovingCover] = useState(false);

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

    const handleRemoveCover = async () => {
        setRemovingCover(true);
        try {
            const result = await removeListCover(list.id);
            if (!result.ok) throw new Error(result.error);
            onCoverRemoved();
            showToast("Couverture supprimée", "success");
        } catch (err) {
            showToast(toastErrorMessage(err, "Erreur lors de la suppression"), "error");
        } finally {
            setRemovingCover(false);
        }
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="Infos">
        <div className="px-6 py-4 space-y-4">
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
            <div className="flex items-center justify-between pt-1">
                <button
                    onClick={handleSave}
                    disabled={saving || !title.trim()}
                    className="px-4 py-1.5 rounded-[8px] text-sm font-medium bg-text-primary text-background disabled:opacity-40"
                >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                {customCoverUrl && (
                    <button
                        onClick={handleRemoveCover}
                        disabled={removingCover}
                        className="text-[12px] text-red-500 hover:opacity-75 disabled:opacity-40 transition-opacity"
                    >
                        {removingCover ? "Suppression…" : "Supprimer la couverture"}
                    </button>
                )}
            </div>
        </div>
        </BottomSheet>
    );
}

function AddItemsForm({
    listId,
    onAdded,
    itemView,
    onItemViewChange,
}: {
    listId: string;
    onAdded: () => void;
    itemView?: "grid" | "list";
    onItemViewChange?: (view: "grid" | "list") => void;
}) {
    const [activePanel, setActivePanel] = useState<"album" | "track" | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleAddAlbum = async (album: AlbumUI) => {
        setSubmitting(true);
        try {
            await toggleListItem(listId, { albumId: album.id });
            showToast(`"${album.title}" ajouté à la liste`, "success");
            onAdded();
        } catch (err) {
            showToast(toastErrorMessage(err, "Impossible d'ajouter cet album"), "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddTrack = async (track: TrackUI) => {
        setSubmitting(true);
        try {
            await toggleListItem(listId, { trackId: track.id });
            showToast(`"${track.title}" ajouté à la liste`, "success");
            onAdded();
        } catch (err) {
            showToast(toastErrorMessage(err, "Impossible d'ajouter ce titre"), "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleTabClick = (tab: "album" | "track") => {
        setActivePanel((current) => (current === tab ? null : tab));
    };

    return (
        <div>
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => handleTabClick("album")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-colors duration-200 ${
                            activePanel === "album" ? "bg-accent-deep text-paper-hi" : "bg-background-secondary text-text-secondary"
                        }`}
                    >
                        {activePanel === "album" ? <X size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                        Album
                    </button>
                    <button
                        onClick={() => handleTabClick("track")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-colors duration-200 ${
                            activePanel === "track" ? "bg-accent-deep text-paper-hi" : "bg-background-secondary text-text-secondary"
                        }`}
                    >
                        {activePanel === "track" ? <X size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                        Titre
                    </button>
                </div>
                {itemView && onItemViewChange && <ListViewToggle view={itemView} onChange={onItemViewChange} />}
            </div>

            <AnimatePresence initial={false} mode="wait">
                {activePanel === "album" && (
                    <motion.div
                        key="album"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <AlbumSearchForDiary onSelectAlbum={handleAddAlbum} />
                    </motion.div>
                )}
                {activePanel === "track" && (
                    <motion.div
                        key="track"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <TrackSearchForDiary onSelectTrack={handleAddTrack} />
                    </motion.div>
                )}
            </AnimatePresence>
            {submitting && <p className="text-label text-text-tertiary mt-2">Ajout en cours…</p>}
        </div>
    );
}

function SortableRow({ item }: { item: ListItem }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const title = item.album?.title ?? item.track?.title ?? "";
    const artist = item.album?.artist ?? item.track?.artist ?? "";
    const coverUrl = item.album?.cover_url ?? item.track?.cover_url ?? null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-2.5 bg-background-secondary rounded-[10px] transition-opacity duration-150 ${isDragging ? "opacity-50" : ""}`}
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="4" cy="2.5" r="1.2" /><circle cx="10" cy="2.5" r="1.2" />
                    <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
                    <circle cx="4" cy="11.5" r="1.2" /><circle cx="10" cy="11.5" r="1.2" />
                </svg>
            </button>
            <div className="w-10 h-10 rounded-[6px] overflow-hidden bg-background-tertiary relative flex-shrink-0">
                {coverUrl ? (
                    <CoverImage src={coverUrl} alt={title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                ) : (
                    <div className="w-full h-full bg-background-tertiary" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary font-medium truncate">{title}</p>
                <p className="text-label text-text-tertiary truncate">{artist}</p>
            </div>
        </div>
    );
}

function ItemRow({ item, onRemove }: { item: ListItem; onRemove?: () => void }) {
    const href = item.album_id && item.album ? `/albums/${item.album.id}` : item.track_id && item.track ? `/tracks/${item.track.id}` : "#";
    const title = item.album?.title ?? item.track?.title ?? "";
    const artist = item.album?.artist ?? item.track?.artist ?? "";
    const coverUrl = item.album?.cover_url ?? item.track?.cover_url ?? null;
    const isTrack = !!item.track_id && !!item.track;

    return (
        <Link href={href} className="group flex items-center gap-3 py-2.5 border-b border-border-divider last:border-b-0">
            <div className="w-11 h-11 rounded-[6px] overflow-hidden bg-background-secondary relative flex-shrink-0">
                {coverUrl ? (
                    <CoverImage src={coverUrl} alt={title} fill className="object-cover group-hover:opacity-80 transition-opacity" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                ) : (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                        {isTrack && <span className="text-text-disabled text-lg">♪</span>}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary font-medium truncate group-hover:text-[#8E6F5E] transition-colors">{title}</p>
                <p className="text-label text-text-tertiary truncate">{artist}</p>
            </div>
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onRemove(); }}
                    className="p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors flex-shrink-0"
                    title="Retirer de la liste"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            )}
        </Link>
    );
}

function KebabIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="2" r="1" fill="currentColor" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5l2.8 2.8 5.2-5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function ListPageContent({ list, items, isOwner }: Props) {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("tous");
    const [editing, setEditing] = useState(false);
    const [reordering, setReordering] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [itemView, setItemView] = useState<"grid" | "list">("grid");
    const [localItems, setLocalItems] = useState<ListItem[]>(items);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [localCustomCover, setLocalCustomCover] = useState(list.custom_cover_url ?? null);
    const [coverUploading, setCoverUploading] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const menuRef = useRef<HTMLDivElement>(null);
    useDismissOnOutsideOrScroll(menuRef, menuOpen, () => setMenuOpen(false));
    const { saved, toggleSave } = useListSave(list);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const handleDeleteList = async () => {
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

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = "";
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast("Image trop lourde — max 5 MB", "error");
            return;
        }
        setCoverUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await uploadListCover(list.id, formData);
            if (!result.ok) throw new Error(result.error);
            setLocalCustomCover(result.coverUrl ?? null);
            showToast("Couverture mise à jour", "success");
        } catch (err) {
            showToast(toastErrorMessage(err, "Erreur lors de l'upload"), "error");
        } finally {
            setCoverUploading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = localItems.findIndex((i) => i.id === active.id);
        const newIndex = localItems.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(localItems, oldIndex, newIndex);
        setLocalItems(reordered);
        setSavingOrder(true);
        try {
            await reorderListItems(list.id, reordered.map((i) => i.id));
        } catch (err) {
            setLocalItems(items); // revert
            showToast(toastErrorMessage(err, "Erreur lors de la réorganisation"), "error");
        } finally {
            setSavingOrder(false);
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
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-start gap-4">
                    <div className={`w-20 sm:w-24 flex-shrink-0 relative ${isOwner ? "group" : ""}`}>
                        <CoverCollage urls={list.cover_urls} customCoverUrl={localCustomCover} />
                        {isOwner && (
                            <label className={`absolute inset-0 flex items-center justify-center rounded-[8px] cursor-pointer transition-colors z-10 ${coverUploading ? "bg-black/40" : "bg-black/0 group-hover:bg-black/35"}`}>
                                <span className={`transition-opacity text-white ${coverUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                    {coverUploading ? (
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                            <circle cx="12" cy="13" r="4"/>
                                        </svg>
                                    )}
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleCoverChange}
                                    disabled={coverUploading}
                                />
                            </label>
                        )}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="text-h1 text-text-primary leading-tight line-clamp-2">{list.title}</h1>
                            <div className="flex items-center gap-2 shrink-0">
                                {!list.is_public && (
                                    <span className="text-[11px] text-text-tertiary border border-border rounded-full px-2 py-0.5">
                                        Privée
                                    </span>
                                )}
                                {isOwner && reordering && (
                                    <button
                                        onClick={() => setReordering(false)}
                                        disabled={savingOrder}
                                        aria-label="Terminer la réorganisation"
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-paper-hi bg-accent-deep hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        <CheckIcon />
                                    </button>
                                )}
                                {!isOwner && list.is_public && (
                                    <button
                                        onClick={toggleSave}
                                        aria-label={saved ? "Retirer des sauvegardes" : "Sauvegarder cette liste"}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${saved ? "text-accent-deep bg-accent-deep/10" : "text-text-tertiary hover:text-accent hover:bg-background-secondary"}`}
                                    >
                                        <BookmarkIcon filled={saved} size={18} />
                                    </button>
                                )}
                                {isOwner && !reordering && (
                                    <div className="relative" ref={menuRef}>
                                        <button
                                            onClick={() => setMenuOpen((v) => !v)}
                                            aria-label="Menu de la liste"
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-background-secondary transition-colors"
                                        >
                                            <KebabIcon />
                                        </button>
                                        {menuOpen && (
                                            <div className="absolute top-9 right-0 w-48 bg-background border border-border rounded-[10px] shadow-lg z-20 overflow-hidden">
                                                {localItems.length > 1 && (
                                                    <button
                                                        onClick={() => { setMenuOpen(false); setReordering(true); }}
                                                        className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[13px] text-text-primary hover:bg-background-secondary transition-colors"
                                                    >
                                                        <ArrowUpDown size={14} className="text-text-tertiary" />
                                                        Réorganiser
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setMenuOpen(false); setEditing((v) => !v); }}
                                                    className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[13px] text-text-primary hover:bg-background-secondary transition-colors"
                                                >
                                                    <Info size={14} className="text-text-tertiary" />
                                                    Infos
                                                </button>
                                                {!list.is_default && (
                                                    <>
                                                        <div className="border-t border-border-divider" />
                                                        <button
                                                            onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                                                            className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[13px] text-red-500 hover:bg-background-secondary transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                            Supprimer la liste
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Link
                            href={`/u/${list.creator_username}`}
                            className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                        >
                            @{list.creator_username}
                        </Link>

                        <p className="text-[12px] text-text-tertiary">
                            {list.item_count} {list.item_count === 1 ? "item" : "items"}
                            {" · "}
                            {list.saves_count} {list.saves_count === 1 ? "sauvegarde" : "sauvegardes"}
                        </p>
                    </div>
                </div>

                {list.description && (
                    <p className="mt-3 text-[14px] text-text-secondary leading-relaxed max-w-xl">
                        {list.description}
                    </p>
                )}
            </div>

            {/* Owner actions — masquées pendant la réorganisation pour ne pas interférer avec le drag */}
            {isOwner && (
                <div className="mb-2">
                    {!reordering && (
                        <AddItemsForm
                            listId={list.id}
                            onAdded={() => router.refresh()}
                            itemView={localItems.length > 1 ? itemView : undefined}
                            onItemViewChange={setItemView}
                        />
                    )}
                    <EditListForm
                        list={list}
                        isOpen={editing}
                        onClose={() => setEditing(false)}
                        customCoverUrl={localCustomCover}
                        onCoverRemoved={() => setLocalCustomCover(null)}
                    />
                </div>
            )}

            {reordering && (
                <p className="text-label text-text-tertiary mb-2">
                    Glisse les éléments pour les réordonner, puis valide avec ✓.
                </p>
            )}


            {/* Filter tabs + toggle vue grille/liste (toggle déjà affiché plus haut pour le propriétaire) */}
            {!reordering && displayed.length > 0 && (showFilter || (!isOwner && displayed.length > 1)) && (
                <div className="flex items-center justify-between gap-2 mb-6">
                    {showFilter ? (
                        <div className="flex gap-1.5">
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
                    ) : <span />}
                    {!isOwner && displayed.length > 1 && <ListViewToggle view={itemView} onChange={setItemView} />}
                </div>
            )}

            {displayed.length === 0 ? (
                <p className="text-meta text-text-tertiary">Cette liste est vide.</p>
            ) : reordering ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {localItems.map((item) => <SortableRow key={item.id} item={item} />)}
                        </div>
                    </SortableContext>
                    {savingOrder && <p className="text-label text-text-tertiary mt-2">Enregistrement de l&apos;ordre…</p>}
                </DndContext>
            ) : itemView === "list" ? (
                <div>
                    {displayed.map((item) => (
                        <ItemRow key={item.id} item={item} onRemove={isOwner ? () => handleRemove(item.id) : undefined} />
                    ))}
                </div>
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

            {confirmDelete && (
                <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-[70] p-4">
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
                                onClick={handleDeleteList}
                                disabled={deleting}
                                className="flex-1 px-3 py-2.5 bg-[#C86C6C] hover:opacity-85 text-[#F5F3EF] rounded-[8px] text-meta disabled:opacity-50 transition-opacity"
                            >
                                {deleting ? "Suppression…" : "Supprimer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
