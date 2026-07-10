"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AlbumSearchForDiary from "@/components/album/AlbumSearchForDiary";
import TrackSearchForDiary, { type TrackUI } from "@/components/track/TrackSearchForDiary";
import StarRating from "@/components/ui/StarRating";
import { CoverImage } from "@/components/album/CoverImage";
import ListSwitcher from "@/components/lists/ListSwitcher";
import AddQueueMobile from "@/components/add/AddQueueMobile";
import { upsertDiaryEntry, getLatestDiaryEntryForAlbum } from "@/app/actions/diary";
import { upsertTrackDiaryEntry, getLatestTrackDiaryEntry } from "@/app/actions/track-diary";
import { type ListAlbumItem, type ListTrackItem, type UserList, getListContents } from "@/app/actions/lists";
import { type ForYouAlbum, type ForYouTrack, type DiscoveryAlbum } from "@/app/actions/explore";
import { type AddQueueItem, ADD_QUEUE_SOURCE_LABELS } from "@/lib/buildAddQueue";
import { CLASSIC_ALBUMS } from "@/lib/classicAlbums";
import { showToast } from "@/components/ui/Toast";
import { Disc3, Music, RefreshCw } from "lucide-react";

type EntityType = "album" | "track";

type SelectedAlbum = {
    id: string;
    title: string;
    artist_name: string;
    coverUrl?: string | null;
    year?: number | null;
    source?: string;
};

type SelectedTrack = {
    id: string;
    title: string;
    artist_name: string;
    album_id: string;
    album_title: string;
    artist_id: string;
    coverUrl?: string | null;
    source?: string;
};

type PreviousEntry = {
    rating: number | null;
    listenedAt: string;
};

type Props = {
    defaultListItems: ListAlbumItem[];
    defaultListTracks: ListTrackItem[];
    initialSuggestions: ForYouAlbum[];
    initialDiscovery: DiscoveryAlbum[];
    initialForYouTracks: ForYouTrack[];
    userLists: UserList[];
    initialQueue: AddQueueItem[];
};

type SuggestionTile = {
    key: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    onSelect: () => void;
};

function CoverTile({
    title,
    artist,
    coverUrl,
    onClick,
}: {
    title: string;
    artist: string;
    coverUrl: string | null;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group block w-full text-left transition-opacity duration-150 hover:opacity-75"
        >
            <div className="relative aspect-square rounded-cover overflow-hidden bg-background-secondary mb-2">
                {coverUrl ? (
                    <CoverImage
                        src={coverUrl}
                        alt={title}
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                    />
                ) : (
                    <div className="w-full h-full bg-background-tertiary" />
                )}
            </div>
            <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">{title}</p>
            <p className="mt-0.5 truncate text-label text-text-tertiary">{artist}</p>
        </button>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-display italic text-[15px] text-text-warm mb-3">
            {children}
        </p>
    );
}

function QueueCover({ item }: { item: AddQueueItem }) {
    const Icon = item.kind === "album" ? Disc3 : Music;

    return (
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-cover-sm bg-background-secondary">
            {item.coverUrl ? (
                <CoverImage
                    src={item.coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    placeholder={<div className="h-full w-full bg-background-tertiary" />}
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center">
                    <Icon size={17} className="text-text-disabled" />
                </div>
            )}
        </div>
    );
}

// Nombre d'éléments affichés dans la file — volontairement limité (au lieu
// de tout afficher) pour que la sidebar s'arrête à peu près à la même
// hauteur que le conteneur de sélection à côté, plutôt que de le dépasser.
const QUEUE_VISIBLE_COUNT = 6;

function shuffleQueue(items: AddQueueItem[]): AddQueueItem[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function AddQueueDesktop({
    items,
    activeKey,
    onSelect,
}: {
    items: AddQueueItem[];
    activeKey: string | null;
    onSelect: (item: AddQueueItem) => void;
}) {
    const [order, setOrder] = useState<AddQueueItem[]>(items);
    const visible = order.slice(0, QUEUE_VISIBLE_COUNT);

    return (
        // flex-col + mt-auto sur la carte : la carte reste collée en bas de la
        // colonne (qui est étirée à la hauteur de la ligne de grille par le
        // parent), pour que son bord bas s'aligne avec celui du conteneur de
        // sélection à côté, quelle que soit la hauteur du titre au-dessus.
        <aside className="sticky top-24 flex h-full flex-col">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-h2 text-text-primary">
                        File <em className="italic text-accent-deep">à noter</em>
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                        {items.length} écoute{items.length > 1 ? "s" : ""} prêtes.
                    </p>
                </div>
                {items.length > QUEUE_VISIBLE_COUNT && (
                    <button
                        type="button"
                        onClick={() => setOrder(shuffleQueue(items))}
                        title="Voir d'autres suggestions"
                        aria-label="Voir d'autres suggestions"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border text-text-tertiary transition-colors duration-150 hover:border-accent hover:text-accent"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
            </div>

            <div className="mt-auto rounded-card-lg border border-border bg-paper-hi p-2 shadow-sidebar">
                {visible.length > 0 ? (
                    <div className="space-y-1">
                        {visible.map((item, index) => {
                            const key = `${item.kind}-${item.id}`;
                            const active = key === activeKey;

                            return (
                                <button
                                    key={`${key}-${index}`}
                                    type="button"
                                    onClick={() => onSelect(item)}
                                    className={`group flex w-full items-center gap-3 rounded-[9px] px-2 py-2 text-left transition-colors duration-150 ${
                                        active
                                            ? "bg-background-secondary"
                                            : "hover:bg-background-secondary/70"
                                    }`}
                                >
                                    <QueueCover item={item} />
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 flex items-center gap-1.5">
                                            <span className="font-display italic text-[13px] leading-none text-accent">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="truncate text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                                                {ADD_QUEUE_SOURCE_LABELS[item.source]}
                                            </span>
                                        </div>
                                        <p className="truncate font-display text-[15px] leading-tight text-text-warm group-hover:text-accent">
                                            {item.title}
                                        </p>
                                        <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                                            {item.artist}
                                            {item.kind === "track" && item.albumTitle ? ` · ${item.albumTitle}` : ""}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="px-3 py-8 text-center text-meta text-text-tertiary">
                        Rien à noter pour le moment.
                    </p>
                )}
            </div>
        </aside>
    );
}

function DesktopSearchPanel({
    entityType,
    onEntityTypeChange,
    selectedAlbumId,
    selectedTrackId,
    onSelectAlbum,
    onSelectTrack,
}: {
    entityType: EntityType;
    onEntityTypeChange: (type: EntityType) => void;
    selectedAlbumId?: string | null;
    selectedTrackId?: string | null;
    onSelectAlbum: (album: SelectedAlbum) => void;
    onSelectTrack: (track: TrackUI) => void;
}) {
    return (
        <div className="rounded-card-lg border border-border bg-paper-hi p-4 shadow-sidebar">
            <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-h2 text-text-primary">
                        Chercher une <em className="italic text-accent-deep">écoute</em>
                    </h2>
                </div>
                <div className="flex rounded-full border border-border bg-background p-1">
                    <button
                        type="button"
                        onClick={() => onEntityTypeChange("album")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                            entityType === "album"
                                ? "bg-text-warm text-paper-hi"
                                : "text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                        }`}
                    >
                        Album
                    </button>
                    <button
                        type="button"
                        onClick={() => onEntityTypeChange("track")}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                            entityType === "track"
                                ? "bg-text-warm text-paper-hi"
                                : "text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                        }`}
                    >
                        Titre
                    </button>
                </div>
            </div>

            {entityType === "album" ? (
                <AlbumSearchForDiary key={selectedAlbumId ?? "none"} onSelectAlbum={onSelectAlbum} />
            ) : (
                <TrackSearchForDiary key={selectedTrackId ?? "none"} onSelectTrack={onSelectTrack} />
            )}
        </div>
    );
}

export default function AddPageClient({
    defaultListItems,
    defaultListTracks,
    initialSuggestions,
    initialDiscovery,
    initialForYouTracks,
    userLists,
    initialQueue,
}: Props) {
    const router = useRouter();
    const today = new Date().toISOString().split("T")[0];

    const [entityType, setEntityType] = useState<EntityType>("album");
    const [step, setStep] = useState<"select" | "form">("select");
    const [selectedAlbum, setSelectedAlbum] = useState<SelectedAlbum | null>(null);
    const [selectedTrack, setSelectedTrack] = useState<SelectedTrack | null>(null);
    const [previousEntry, setPreviousEntry] = useState<PreviousEntry | null>(null);
    const [rating, setRating] = useState<number | null>(null);
    const [listenedAt, setListenedAt] = useState(today);
    const [comment, setComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const defaultList = userLists.find((l) => l.is_default) ?? userLists[0] ?? null;
    const [selectedListId, setSelectedListId] = useState<string | null>(defaultList?.id ?? null);
    const [listItems, setListItems] = useState<{ albums: ListAlbumItem[]; tracks: ListTrackItem[] }>({
        albums: defaultListItems,
        tracks: defaultListTracks,
    });
    const [listLoading, setListLoading] = useState(false);

    const handleListChange = async (listId: string) => {
        setSelectedListId(listId);
        setListLoading(true);
        try {
            const result = await getListContents(listId, 8);
            setListItems(result);
        } catch {
            showToast("Erreur lors du chargement de la liste", "error");
        } finally {
            setListLoading(false);
        }
    };

    const selectedListTitle = userLists.find((l) => l.id === selectedListId)?.title ?? null;
    const activeQueueKey = selectedAlbum
        ? `album-${selectedAlbum.id}`
        : selectedTrack
            ? `track-${selectedTrack.id}`
            : null;

    const albumGrid = useMemo<SuggestionTile[]>(() => {
        const tiles: SuggestionTile[] = [];
        const seen = new Set<string>();

        const push = (id: string, title: string, artist: string, coverUrl: string | null, year?: number | null, source?: string) => {
            if (!id || seen.has(id) || tiles.length >= 8) return;
            seen.add(id);
            tiles.push({
                key: id,
                title,
                artist,
                coverUrl,
                onSelect: () => handleAlbumSelect({ id, title, artist_name: artist, coverUrl, year, source }),
            });
        };

        for (const item of listItems.albums) push(item.album_id, item.album_title, item.artist_name, item.cover_url);
        for (const item of initialSuggestions) push(item.album_id, item.title, item.artist, item.cover_url, undefined, "for_you");
        for (const item of initialDiscovery) push(item.album_id, item.title, item.artist, item.cover_url);
        if (tiles.length === 0) {
            for (const album of CLASSIC_ALBUMS) push(album.id, album.title, album.artist, album.coverUrl);
        }
        return tiles;
    }, [listItems.albums, initialSuggestions, initialDiscovery]);

    const trackGrid = useMemo<SuggestionTile[]>(() => {
        const tiles: SuggestionTile[] = [];
        const seen = new Set<string>();

        const push = (id: string, title: string, artist: string, coverUrl: string | null, albumId: string, albumTitle: string, artistId: string, source?: string) => {
            if (!id || seen.has(id) || tiles.length >= 8) return;
            seen.add(id);
            tiles.push({
                key: id,
                title,
                artist,
                coverUrl,
                onSelect: () =>
                    handleTrackSelect({
                        id,
                        title,
                        artist_name: artist,
                        album_id: albumId,
                        album_title: albumTitle,
                        artist_id: artistId,
                        coverUrl,
                        source,
                    }),
            });
        };

        for (const item of listItems.tracks) push(item.track_id, item.track_title, item.artist_name, item.cover_url, item.album_id, item.album_title, item.artist_id);
        for (const item of initialForYouTracks) push(item.track_id, item.track_title, item.artist, item.cover_url, item.album_id, "", item.artist_id, "for_you");
        return tiles;
    }, [listItems.tracks, initialForYouTracks]);

    const albumGridTitle = listItems.albums.length > 0
        ? `À noter depuis « ${selectedListTitle ?? "ta liste"} »`
        : albumGrid.length > 0
            ? "Suggestions pour toi"
            : "Par où commencer ?";

    const trackGridTitle = listItems.tracks.length > 0
        ? `À noter depuis « ${selectedListTitle ?? "ta liste"} »`
        : "Suggestions pour toi";

    const resetForm = () => {
        setStep("select");
        setSelectedAlbum(null);
        setSelectedTrack(null);
        setPreviousEntry(null);
        setRating(null);
        setListenedAt(today);
        setComment("");
    };

    const handleEntityTypeChange = (newType: EntityType) => {
        setEntityType(newType);
        resetForm();
    };

    const handleAlbumSelect = async (album: SelectedAlbum) => {
        const prev = await getLatestDiaryEntryForAlbum(album.id);
        setPreviousEntry(prev);
        setSelectedAlbum(album);
        setStep("form");
    };

    const handleTrackSelect = async (track: TrackUI) => {
        const prev = await getLatestTrackDiaryEntry(track.id);
        setPreviousEntry(prev ? { rating: prev.rating, listenedAt: prev.listenedAt } : null);
        setSelectedTrack({
            id: track.id,
            title: track.title,
            artist_name: track.artist_name,
            album_id: track.album_id,
            album_title: track.album_title,
            artist_id: track.artist_id,
            coverUrl: track.coverUrl,
            source: track.source,
        });
        setStep("form");
    };

    const handleQueueSelect = async (item: AddQueueItem) => {
        if (item.kind === "album") {
            setEntityType("album");
            await handleAlbumSelect({
                id: item.id,
                title: item.title,
                artist_name: item.artist,
                coverUrl: item.coverUrl,
                year: item.year,
                source: item.source === "foryou" ? "for_you" : undefined,
            });
            return;
        }

        setEntityType("track");
        await handleTrackSelect({
            id: item.id,
            title: item.title,
            artist_name: item.artist,
            album_id: item.albumId,
            album_title: item.albumTitle,
            artist_id: item.artistId,
            coverUrl: item.coverUrl,
            source: item.source === "foryou" ? "for_you" : undefined,
        });
    };

    const handleSubmitDiary = async () => {
        if (!selectedAlbum || !listenedAt) return;
        setIsLoading(true);
        try {
            const result = await upsertDiaryEntry({
                albumId: selectedAlbum.id,
                listenedAt,
                rating: rating ?? undefined,
                reviewBody: comment.trim() || undefined,
                isPublic: true,
                relisten: previousEntry !== null,
                source: selectedAlbum.source,
            });

            if (result.success) {
                showToast("Écoute enregistrée", "success");
                if (result.data?.id) router.replace(`/diary/${result.data.id}`);
            } else {
                showToast(result.error || "Erreur lors de l'enregistrement", "error");
                setIsLoading(false);
            }
        } catch {
            showToast("Erreur lors de l'enregistrement", "error");
            setIsLoading(false);
        }
    };

    const handleSubmitTrackDiary = async () => {
        if (!selectedTrack || !listenedAt) return;
        setIsLoading(true);
        try {
            const result = await upsertTrackDiaryEntry({
                trackId: selectedTrack.id,
                albumId: selectedTrack.album_id,
                artistId: selectedTrack.artist_id,
                listenedAt,
                rating: rating ?? undefined,
                reviewBody: comment.trim() || undefined,
                isPublic: true,
                source: selectedTrack.source,
            });

            if (result.success) {
                showToast("Écoute enregistrée", "success");
                router.replace(`/track-diary/${result.data!.id}`);
            } else {
                showToast(result.error || "Erreur lors de l'enregistrement", "error");
                setIsLoading(false);
            }
        } catch {
            showToast("Erreur lors de l'enregistrement", "error");
            setIsLoading(false);
        }
    };

    const renderDesktopForm = () => {
        const bookShadow = "0 1px 2px rgba(0,0,0,0.04), 0 10px 26px rgba(60,40,20,0.06)";

        if (step !== "form") {
            return (
                <div
                    className="relative flex min-h-[400px] flex-1 items-center justify-center overflow-hidden rounded-card-lg border border-border bg-paper-hi"
                    style={{ boxShadow: bookShadow }}
                >
                    <div className="absolute inset-y-0 left-0 w-4 bg-text-warm" />
                    <div
                        className="absolute left-16 top-0 h-[92px] w-[34px] bg-accent-deep"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)", boxShadow: "0 2px 4px rgba(0,0,0,0.12)" }}
                    />
                    <div className="flex flex-col items-center gap-5 px-10 pb-10 pt-10 pl-[70px] text-center">
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden="true">
                            <circle cx="30" cy="30" r="28" stroke="#D8D3CB" strokeWidth="1.5" strokeDasharray="3 5" />
                            <circle cx="30" cy="30" r="18" stroke="#8E6F5E" strokeWidth="1.5" />
                            <circle cx="30" cy="30" r="3" fill="#8E6F5E" />
                        </svg>
                        <h2 className="font-display italic text-[26px] leading-none text-text-warm">
                            Choisis une écoute à noter.
                        </h2>
                        <p className="max-w-[360px] text-[13.5px] leading-relaxed text-text-secondary">
                            Cherche un album ou un titre, pioche dans tes suggestions, ou reprends un élément de ta file d&apos;attente.
                        </p>
                    </div>
                </div>
            );
        }

        const isAlbum = entityType === "album" && selectedAlbum;
        const isTrack = entityType === "track" && selectedTrack;
        if (!isAlbum && !isTrack) return null;

        const title = selectedAlbum?.title ?? selectedTrack?.title ?? "";
        const artist = selectedAlbum?.artist_name ?? selectedTrack?.artist_name ?? "";
        const coverUrl = selectedAlbum?.coverUrl ?? selectedTrack?.coverUrl ?? null;
        const meta = isAlbum
            ? [selectedAlbum?.year].filter(Boolean).join(" · ")
            : selectedTrack?.album_title ?? "";
        const submit = isAlbum ? handleSubmitDiary : handleSubmitTrackDiary;
        const resetSelection = () => {
            setStep("select");
            setSelectedAlbum(null);
            setSelectedTrack(null);
            setPreviousEntry(null);
        };
        const seeHref = isAlbum ? `/albums/${selectedAlbum!.id}` : `/tracks/${selectedTrack!.id}`;
        const seeLabel = isAlbum ? "voir la fiche" : "voir le titre";

        return (
            // Le conteneur comme un carnet ouvert : la cover "scotchée" sur la page de
            // gauche, la note et le commentaire écrits sur la page de droite (papier
            // ligné) — cliquer sur la cover reste le raccourci pour changer d'écoute,
            // comme cliquer sur une autre cover ailleurs sur la page.
            <div
                className="relative flex flex-1 overflow-hidden rounded-card-lg border border-border bg-paper-hi"
                style={{ boxShadow: bookShadow }}
            >
                <div className="absolute inset-y-0 left-0 w-4 bg-text-warm" />

                {/* Page gauche — identité */}
                <div className="flex w-[262px] flex-shrink-0 flex-col items-center bg-background-secondary px-6 py-8 pl-9 text-center">
                    <button
                        type="button"
                        onClick={resetSelection}
                        title="Changer d'écoute"
                        className="group relative mb-4 h-[150px] w-[150px] flex-shrink-0 overflow-hidden border-[6px] border-paper-hi transition-transform duration-200 hover:-rotate-1"
                        style={{ borderRadius: "4px", boxShadow: "0 3px 10px rgba(60,40,20,0.18)" }}
                    >
                        {coverUrl ? (
                            <CoverImage
                                key={coverUrl}
                                src={coverUrl}
                                alt={title}
                                fill
                                className="object-cover"
                                placeholder={<div className="h-full w-full bg-background-tertiary" />}
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-background-tertiary">
                                {(isAlbum ? <Disc3 size={28} /> : <Music size={28} />)}
                            </div>
                        )}
                    </button>

                    <h2 className="font-display text-[24px] leading-tight text-text-warm">
                        {title}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] text-text-secondary">
                        {artist}
                        {meta ? <span className="text-text-tertiary"> · {meta}</span> : null}
                    </p>
                    {previousEntry !== null && (
                        <p className="mt-1 font-display italic text-[12.5px] text-text-tertiary">
                            Ré-écoute{previousEntry.rating !== null ? <> · <span className="text-accent">{previousEntry.rating}/10</span></> : ""}
                        </p>
                    )}
                    <Link
                        href={seeHref}
                        className="mt-3 inline-block border-b border-rule pb-px font-display italic text-[15px] text-accent-deep transition-colors duration-150 hover:border-text-tertiary hover:text-text-primary"
                    >
                        {seeLabel}
                    </Link>

                    <div className="mt-auto flex items-baseline gap-1.5 pt-4">
                        <span className="font-display italic text-[13.5px] text-text-tertiary">écouté le</span>
                        <input
                            type="date"
                            value={listenedAt}
                            max={today}
                            onChange={(e) => setListenedAt(e.target.value)}
                            className="border-0 border-b border-rule bg-transparent font-display italic text-[13.5px] text-text-warm focus:outline-none focus:border-accent"
                        />
                    </div>
                </div>

                {/* Gouttière de reliure */}
                <div
                    className="relative flex w-5 flex-shrink-0 flex-col items-center justify-center gap-6"
                    style={{ background: "linear-gradient(to right, rgba(0,0,0,0.05), transparent 8px, transparent calc(100% - 8px), rgba(0,0,0,0.05))" }}
                >
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[7px] w-[7px] rounded-full bg-[#EDE9E2]" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)" }} />
                    ))}
                </div>

                {/* Page droite — note + commentaire, papier ligné */}
                <div
                    className="flex min-w-0 flex-1 flex-col bg-background px-8 pb-6 pt-8"
                    style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #DDD7CF 28px)", backgroundPosition: "0 84px" }}
                >
                    <div className="mb-6">
                        <div className="mb-3 flex items-baseline justify-between">
                            <span className="text-label uppercase tracking-[0.2em] text-text-tertiary">Ta note</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`font-display italic text-[24px] leading-none ${rating !== null ? "text-text-primary" : "text-text-disabled"}`}>
                                    {rating !== null ? rating : "–"}
                                </span>
                                <span className="text-[12px] text-text-tertiary">/10</span>
                                {rating !== null && (
                                    <button
                                        type="button"
                                        onClick={() => setRating(null)}
                                        className="ml-1 text-[11px] text-text-tertiary underline decoration-rule underline-offset-2 hover:text-text-primary"
                                    >
                                        annuler
                                    </button>
                                )}
                            </div>
                        </div>
                        <StarRating value={rating} onChange={setRating} />
                    </div>

                    <div className="mb-5 flex flex-1 flex-col">
                        <p className="mb-2 text-label uppercase tracking-[0.2em] text-text-tertiary">Quelques mots</p>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Ce que tu as ressenti, si tu en as envie."
                            className="min-h-[112px] w-full flex-1 resize-none border-none bg-transparent text-[14.5px] leading-[28px] text-text-primary placeholder:font-display placeholder:text-[15px] placeholder:italic placeholder:text-text-tertiary focus:outline-none"
                        />
                    </div>

                    <div className="mt-auto flex justify-end">
                        <button
                            onClick={submit}
                            disabled={isLoading}
                            className="rounded-pill bg-text-warm px-9 py-3 text-[14.5px] font-medium text-background transition-colors duration-150 hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text-disabled"
                        >
                            {isLoading ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <AddQueueMobile initialQueue={initialQueue} />

            <div className="hidden lg:block">
                <div className="mx-auto max-w-6xl px-8 pt-8 pb-5">
                    <div>
                        <div>
                            <h1 className="text-h1 text-text-primary mb-2">
                                Ajouter une <em className="italic text-accent-deep">écoute</em>
                            </h1>
                            <p className="text-meta text-text-secondary">
                                Cherche, pioche dans ta file, note sans quitter le flux.
                            </p>
                        </div>
                    </div>
                </div>

                <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_320px] gap-8 px-8 pb-12">
                    <section className="flex min-w-0 flex-col gap-6">
                        <DesktopSearchPanel
                            entityType={entityType}
                            onEntityTypeChange={handleEntityTypeChange}
                            selectedAlbumId={selectedAlbum?.id}
                            selectedTrackId={selectedTrack?.id}
                            onSelectAlbum={handleAlbumSelect}
                            onSelectTrack={handleTrackSelect}
                        />
                        {!isLoading && renderDesktopForm()}
                    </section>

                    <AddQueueDesktop
                        items={initialQueue}
                        activeKey={activeQueueKey}
                        onSelect={handleQueueSelect}
                    />
                </main>
            </div>

            {false && (
            <div className="hidden">
            <div className="p-6 lg:px-8 pb-0">
                <div>
                    <h1 className="text-h1 text-text-primary mb-2">
                        Ajouter une <em className="italic text-accent-deep">écoute</em>
                    </h1>

                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => handleEntityTypeChange("album")}
                            className={`text-sm font-medium pb-1 border-b-2 transition-colors duration-150 ${
                                entityType === "album"
                                    ? "text-text-primary border-accent"
                                    : "text-text-tertiary border-transparent hover:text-text-secondary"
                            }`}
                        >
                            Album
                        </button>
                        <button
                            onClick={() => handleEntityTypeChange("track")}
                            className={`text-sm font-medium pb-1 border-b-2 transition-colors duration-150 ${
                                entityType === "track"
                                    ? "text-text-primary border-accent"
                                    : "text-text-tertiary border-transparent hover:text-text-secondary"
                            }`}
                        >
                            Titre
                        </button>
                    </div>
                </div>
            </div>

            <main className="p-6 lg:px-8 pb-28 lg:pb-12">
                <div>
                    {!isLoading && (
                        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
                            {/* Colonne gauche : search + form */}
                            <div>
                                {entityType === "album" && (
                                    <AlbumSearchForDiary key={selectedAlbum?.id ?? "none"} onSelectAlbum={handleAlbumSelect} />
                                )}
                                {entityType === "track" && (
                                    <TrackSearchForDiary key={selectedTrack?.id ?? "none"} onSelectTrack={handleTrackSelect} />
                                )}

                                {step === "form" && selectedAlbum && entityType === "album" && (
                                    <div className="space-y-section-md mt-8 lg:mt-6">
                                        <div className="pb-6 border-b border-border">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="relative w-20 h-20 rounded-cover-sm overflow-hidden flex-shrink-0 bg-background-secondary">
                                                    {selectedAlbum!.coverUrl ? (
                                                        <CoverImage
                                                            key={selectedAlbum!.coverUrl}
                                                            src={selectedAlbum!.coverUrl as string}
                                                            alt={selectedAlbum!.title}
                                                            fill
                                                            className="object-cover"
                                                            placeholder={<div className="w-full h-full bg-background-tertiary" />}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-background-tertiary" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 pt-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h2 className="font-display font-normal text-h2 text-text-warm leading-tight">
                                                            {selectedAlbum!.title}
                                                        </h2>
                                                        {previousEntry !== null && (
                                                            <span className="font-display italic text-[13px] text-text-secondary whitespace-nowrap">
                                                                · Ré-écoute{previousEntry!.rating !== null ? <> · <span className="text-accent">{previousEntry!.rating}/10</span></> : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-meta text-text-secondary">
                                                        {selectedAlbum!.artist_name}
                                                        {selectedAlbum!.year ? ` · ${selectedAlbum!.year}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setStep("select"); setSelectedAlbum(null); setPreviousEntry(null); }}
                                                className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                                            >
                                                changer
                                            </button>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-meta text-text-secondary">Note</label>
                                                <span className="font-display italic text-[15px] leading-none text-accent">{rating ?? 0} / 10</span>
                                            </div>
                                            <StarRating value={rating} onChange={setRating} />
                                        </div>

                                        <div>
                                            <label className="block text-meta text-text-secondary mb-2">Date d'écoute</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={listenedAt}
                                                    max={today}
                                                    onChange={(e) => setListenedAt(e.target.value)}
                                                    className="w-full px-4 py-3 pr-10 bg-paper-hi border border-border rounded-input text-text-primary focus:outline-none focus:border-accent focus:ring-0 appearance-none"
                                                />
                                                <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none">
                                                    <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z" />
                                                </svg>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-meta text-text-secondary mb-2">Quelques mots</label>
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Ce que tu as ressenti, si tu en as envie."
                                                className="w-full px-4 py-3 bg-paper-hi border border-border rounded-input text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-0 resize-none h-32"
                                            />
                                        </div>

                                        <button
                                            onClick={handleSubmitDiary}
                                            disabled={isLoading}
                                            className="w-full px-6 py-3 bg-text-warm hover:opacity-85 disabled:bg-border disabled:text-text-disabled text-paper-hi font-medium rounded-button transition-opacity disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? "Enregistrement..." : "Enregistrer"}
                                        </button>
                                    </div>
                                )}

                                {step === "form" && selectedTrack && entityType === "track" && (
                                    <div className="space-y-section-md mt-8 lg:mt-6">
                                        <div className="pb-6 border-b border-border">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="relative w-20 h-20 rounded-cover-sm overflow-hidden flex-shrink-0 bg-background-secondary">
                                                    {selectedTrack!.coverUrl ? (
                                                        <CoverImage
                                                            key={selectedTrack!.coverUrl}
                                                            src={selectedTrack!.coverUrl as string}
                                                            alt={selectedTrack!.title}
                                                            fill
                                                            className="object-cover"
                                                            placeholder={<div className="w-full h-full bg-background-tertiary" />}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-background-tertiary" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 pt-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h2 className="font-display font-normal text-h2 text-text-warm leading-tight">
                                                            {selectedTrack!.title}
                                                        </h2>
                                                        {previousEntry !== null && (
                                                            <span className="font-display italic text-[13px] text-text-secondary whitespace-nowrap">
                                                                · Ré-écoute{previousEntry!.rating !== null ? <> · <span className="text-accent">{previousEntry!.rating}/10</span></> : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-meta text-text-secondary">
                                                        {selectedTrack!.artist_name}
                                                        {selectedTrack!.album_title && <span className="text-text-tertiary"> · {selectedTrack!.album_title}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setStep("select"); setSelectedTrack(null); setPreviousEntry(null); }}
                                                className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                                            >
                                                changer
                                            </button>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-meta text-text-secondary">Note</label>
                                                <span className="font-display italic text-[15px] leading-none text-accent">{rating !== null ? `${rating} / 10` : "–"}</span>
                                            </div>
                                            <StarRating value={rating} onChange={setRating} />
                                        </div>

                                        <div>
                                            <label className="block text-meta text-text-secondary mb-2">Date d'écoute</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={listenedAt}
                                                    max={today}
                                                    onChange={(e) => setListenedAt(e.target.value)}
                                                    className="w-full px-4 py-3 pr-10 bg-paper-hi border border-border rounded-input text-text-primary focus:outline-none focus:border-accent focus:ring-0 appearance-none"
                                                />
                                                <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none">
                                                    <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z" />
                                                </svg>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-meta text-text-secondary mb-2">Quelques mots</label>
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Ce que tu as ressenti, si tu en as envie."
                                                className="w-full px-4 py-3 bg-paper-hi border border-border rounded-input text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-0 resize-none h-32"
                                            />
                                        </div>

                                        <button
                                            onClick={handleSubmitTrackDiary}
                                            disabled={isLoading}
                                            className="w-full px-6 py-3 bg-text-warm hover:opacity-85 disabled:bg-border disabled:text-text-disabled text-paper-hi font-medium rounded-button transition-opacity disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? "Enregistrement..." : "Enregistrer"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Colonne droite : suggestions — toujours visibles sur desktop */}
                            <div className={`mt-6 lg:mt-0 ${step === "form" ? "hidden lg:block" : ""}`}>
                                {userLists.length > 1 && (
                                    <ListSwitcher
                                        lists={userLists}
                                        selectedListId={selectedListId}
                                        onSelect={handleListChange}
                                        isLoading={listLoading}
                                    />
                                )}
                                {entityType === "album" && albumGrid.length > 0 && (
                                    <>
                                        <SectionTitle>{albumGridTitle}</SectionTitle>
                                        <div className="grid gap-4 grid-cols-3">
                                            {albumGrid.map((tile) => (
                                                <CoverTile key={tile.key} title={tile.title} artist={tile.artist} coverUrl={tile.coverUrl} onClick={tile.onSelect} />
                                            ))}
                                        </div>
                                    </>
                                )}
                                {entityType === "track" && trackGrid.length > 0 && (
                                    <>
                                        <SectionTitle>{trackGridTitle}</SectionTitle>
                                        <div className="grid gap-4 grid-cols-3">
                                            {trackGrid.map((tile) => (
                                                <CoverTile key={tile.key} title={tile.title} artist={tile.artist} coverUrl={tile.coverUrl} onClick={tile.onSelect} />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
            </div>
            )}
        </>
    );
}
