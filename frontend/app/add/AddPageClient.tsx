"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AlbumSearchForDiary from "@/components/AlbumSearchForDiary";
import TrackSearchForDiary, { type TrackUI } from "@/components/TrackSearchForDiary";
import StarRating from "@/components/StarRating";
import { CoverImage } from "@/components/CoverImage";
import ListSwitcher from "@/components/ListSwitcher";
import AddQueueMobile from "@/components/add/AddQueueMobile";
import { upsertDiaryEntry, getLatestDiaryEntryForAlbum } from "@/app/actions/diary";
import { upsertTrackDiaryEntry, getLatestTrackDiaryEntry } from "@/app/actions/track-diary";
import { type ListAlbumItem, type ListTrackItem, type UserList, getListContents } from "@/app/actions/lists";
import { type ForYouAlbum, type ForYouTrack, type DiscoveryAlbum } from "@/app/actions/explore";
import { type AddQueueItem } from "@/lib/buildAddQueue";
import { CLASSIC_ALBUMS } from "@/lib/classicAlbums";
import { showToast } from "@/components/Toast";

type EntityType = "album" | "track";

type SelectedAlbum = {
    id: string;
    title: string;
    artist_name: string;
    coverUrl?: string | null;
    year?: number | null;
};

type SelectedTrack = {
    id: string;
    title: string;
    artist_name: string;
    album_id: string;
    album_title: string;
    artist_id: string;
    coverUrl?: string | null;
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

    const albumGrid = useMemo<SuggestionTile[]>(() => {
        const tiles: SuggestionTile[] = [];
        const seen = new Set<string>();

        const push = (id: string, title: string, artist: string, coverUrl: string | null, year?: number | null) => {
            if (!id || seen.has(id) || tiles.length >= 8) return;
            seen.add(id);
            tiles.push({
                key: id,
                title,
                artist,
                coverUrl,
                onSelect: () => handleAlbumSelect({ id, title, artist_name: artist, coverUrl, year }),
            });
        };

        for (const item of listItems.albums) push(item.album_id, item.album_title, item.artist_name, item.cover_url);
        for (const item of initialSuggestions) push(item.album_id, item.title, item.artist, item.cover_url);
        for (const item of initialDiscovery) push(item.album_id, item.title, item.artist, item.cover_url);
        if (tiles.length === 0) {
            for (const album of CLASSIC_ALBUMS) push(album.id, album.title, album.artist, album.coverUrl);
        }
        return tiles;
    }, [listItems.albums, initialSuggestions, initialDiscovery]);

    const trackGrid = useMemo<SuggestionTile[]>(() => {
        const tiles: SuggestionTile[] = [];
        const seen = new Set<string>();

        const push = (id: string, title: string, artist: string, coverUrl: string | null, albumId: string, albumTitle: string, artistId: string) => {
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
                    }),
            });
        };

        for (const item of listItems.tracks) push(item.track_id, item.track_title, item.artist_name, item.cover_url, item.album_id, item.album_title, item.artist_id);
        for (const item of initialForYouTracks) push(item.track_id, item.track_title, item.artist, item.cover_url, item.album_id, "", item.artist_id);
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
        });
        setStep("form");
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

    return (
        <>
            <AddQueueMobile initialQueue={initialQueue} />

            <div className="hidden lg:block">
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
                                                    {selectedAlbum.coverUrl ? (
                                                        <CoverImage
                                                            key={selectedAlbum.coverUrl}
                                                            src={selectedAlbum.coverUrl}
                                                            alt={selectedAlbum.title}
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
                                                            {selectedAlbum.title}
                                                        </h2>
                                                        {previousEntry !== null && (
                                                            <span className="font-display italic text-[13px] text-text-secondary whitespace-nowrap">
                                                                · Ré-écoute{previousEntry.rating !== null ? <> · <span className="text-accent">{previousEntry.rating}/10</span></> : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-meta text-text-secondary">
                                                        {selectedAlbum.artist_name}
                                                        {selectedAlbum.year ? ` · ${selectedAlbum.year}` : ""}
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
                                                    {selectedTrack.coverUrl ? (
                                                        <CoverImage
                                                            key={selectedTrack.coverUrl}
                                                            src={selectedTrack.coverUrl}
                                                            alt={selectedTrack.title}
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
                                                            {selectedTrack.title}
                                                        </h2>
                                                        {previousEntry !== null && (
                                                            <span className="font-display italic text-[13px] text-text-secondary whitespace-nowrap">
                                                                · Ré-écoute{previousEntry.rating !== null ? <> · <span className="text-accent">{previousEntry.rating}/10</span></> : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-meta text-text-secondary">
                                                        {selectedTrack.artist_name}
                                                        {selectedTrack.album_title && <span className="text-text-tertiary"> · {selectedTrack.album_title}</span>}
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
        </>
    );
}
