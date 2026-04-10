"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AlbumSearchForDiary from "@/components/AlbumSearchForDiary";
import StarRating from "@/components/StarRating";
import { CoverImage } from "@/components/CoverImage";
import { useAuth } from "@/lib/AuthContext";
import { upsertDiaryEntry, getLatestDiaryEntryForAlbum } from "@/app/actions/diary";
import { saveAlbumOnce } from "@/app/actions/saved-albums";
import { getUserSavedAlbums, type SavedAlbumUI } from "@/app/actions/saved-albums";
import { getForYouSuggestions, getDiscoveryAlbums, type ForYouAlbum, type DiscoveryAlbum } from "@/app/actions/explore";
import { showToast } from "@/components/Toast";

type Mode = "diary" | "save";

type SelectedAlbum = {
    id: string;
    title: string;
    artist_name: string;
    coverUrl?: string | null;
    year?: number | null;
};

type PreviousEntry = {
    rating: number | null;
    listenedAt: string;
};

function AlbumCard({
    title,
    artist,
    coverUrl,
    onClick,
    compact = false,
    className,
}: {
    title: string;
    artist: string;
    coverUrl: string | null;
    onClick: () => void;
    compact?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={compact
                ? `group flex w-full items-center gap-3 text-left transition-opacity duration-150 hover:opacity-75 ${className ?? ""}`
                : `flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition-colors duration-150 hover:bg-background-secondary -mx-2 ${className ?? ""}`}
        >
            <div className="relative w-12 h-12 rounded-[6px] overflow-hidden flex-shrink-0 bg-background-secondary">
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
            <div className="min-w-0">
                <p className={compact
                    ? "text-[13px] font-medium text-text-primary leading-snug line-clamp-2"
                    : "text-[13px] font-medium text-text-primary truncate"}
                >
                    {title}
                </p>
                <p className={compact
                    ? "mt-0.5 truncate text-[11px] text-text-secondary"
                    : "truncate text-[12px] text-text-secondary"}
                >
                    {artist}
                </p>
            </div>
        </button>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            {children}
        </h2>
    );
}

function getTwoColumnGridClass(itemCount: number) {
    return `grid gap-3 ${itemCount === 3 ? "grid-cols-1" : "grid-cols-2"}`;
}

function getGridItemClass(index: number, itemCount: number) {
    return itemCount !== 3 && itemCount % 2 !== 0 && index === itemCount - 1 ? "col-span-2" : "";
}

export default function AddPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push("/auth");
    }, [loading, user, router]);

    const today = new Date().toISOString().split("T")[0];

    const [mode, setMode] = useState<Mode>("diary");
    const [step, setStep] = useState<"select" | "form">("select");
    const [selectedAlbum, setSelectedAlbum] = useState<SelectedAlbum | null>(null);
    const [previousEntry, setPreviousEntry] = useState<PreviousEntry | null>(null);
    const [rating, setRating] = useState<number | null>(null);
    const [listenedAt, setListenedAt] = useState(today);
    const [comment, setComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Empty state data
    const [savedAlbums, setSavedAlbums] = useState<SavedAlbumUI[]>([]);
    const [suggestions, setSuggestions] = useState<ForYouAlbum[]>([]);
    const [discovery, setDiscovery] = useState<DiscoveryAlbum[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    useEffect(() => {
        if (!user || dataLoaded) return;
        setDataLoaded(true);
        Promise.all([
            getUserSavedAlbums(user.id, 8),
            getForYouSuggestions(),
            getDiscoveryAlbums(),
        ]).then(([saved, forYou, disco]) => {
            setSavedAlbums(saved);
            setSuggestions(forYou);
            setDiscovery(disco);
        });
    }, [user, dataLoaded]);

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        setStep("select");
        setSelectedAlbum(null);
        setPreviousEntry(null);
        setRating(null);
        setListenedAt(today);
        setComment("");
    };

    const handleAlbumSelect = async (album: SelectedAlbum) => {
        if (mode === "save") {
            setIsLoading(true);
            try {
                await saveAlbumOnce(album.id);
                showToast("Album mis de côté", "success");
                router.push("/me?tab=saved");
            } catch {
                showToast("Erreur lors de la sauvegarde", "error");
                setIsLoading(false);
            }
        } else {
            // Check for existing entry (re-listen detection)
            const prev = await getLatestDiaryEntryForAlbum(album.id);
            setPreviousEntry(prev);
            setSelectedAlbum(album);
            setStep("form");
        }
    };

    const handleSubmitDiary = async () => {
        if (!selectedAlbum || !listenedAt) return;

        setIsLoading(true);
        try {
            const result = await upsertDiaryEntry({
                albumId: selectedAlbum.id,
                listenedAt,
                rating: rating ?? 0,
                reviewBody: comment.trim() || undefined,
                isPublic: true,
                relisten: previousEntry !== null,
            });

            if (result.success) {
                showToast("Écoute enregistrée", "success");
                if (result.data?.id) {
                    router.replace(`/diary/${result.data.id}`);
                }
            } else {
                showToast(result.error || "Erreur lors de l'enregistrement", "error");
                setIsLoading(false);
            }
        } catch {
            showToast("Erreur lors de l'enregistrement", "error");
            setIsLoading(false);
        }
    };

    if (loading) {
        return (
            <main className="p-6 pb-20 max-w-page mx-auto text-center pt-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8E6F5E] mx-auto" />
            </main>
        );
    }

    if (!user) return null;

    const hasSaved = savedAlbums.length > 0;
    const hasSuggestions = suggestions.length > 0;
    const hasDiscovery = discovery.length > 0;
    const showDiaryEmptyState = !hasSaved && !hasSuggestions;

    return (
        <>
            <div className="p-6 pb-0">
                <div className="max-w-page mx-auto">
                    <h1 className="text-h1 text-text-primary mb-2">Ajouter</h1>
                    <p className="text-[14px] text-text-secondary mb-6">
                        {mode === "diary"
                            ? "Cherche un album que tu as écouté pour l'ajouter à ton journal."
                            : "Garde un album de côté pour l'écouter plus tard."}
                    </p>

                    {/* Toggle */}
                    <div className="flex bg-background-secondary rounded-[10px] p-1 mb-8">
                        <button
                            onClick={() => handleModeChange("diary")}
                            className={`flex-1 py-2 text-[14px] font-medium rounded-[8px] transition-colors duration-150 ${
                                mode === "diary"
                                    ? "bg-background text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            J'ai écouté
                        </button>
                        <button
                            onClick={() => handleModeChange("save")}
                            className={`flex-1 py-2 text-[14px] font-medium rounded-[8px] transition-colors duration-150 ${
                                mode === "save"
                                    ? "bg-background text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            Je veux écouter
                        </button>
                    </div>
                </div>
            </div>

            <main className="p-6 pb-20">
                <div className="max-w-page mx-auto">
                    {isLoading && mode === "save" && (
                        <div className="text-center pt-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8E6F5E] mx-auto" />
                        </div>
                    )}

                    {/* ── MODE DIARY ── */}
                    {mode === "diary" && !isLoading && (
                        <>
                            {step === "select" && (
                                <>
                                    <AlbumSearchForDiary onSelectAlbum={handleAlbumSelect} />

                                    {/* Empty state: saved albums list */}
                                    {hasSaved && (
                                        <div className="mt-8">
                                            <SectionTitle>Dans ta liste</SectionTitle>
                                            <div className={getTwoColumnGridClass(savedAlbums.length)}>
                                                {savedAlbums.map((s, idx) => (
                                                    <AlbumCard
                                                        key={s.id}
                                                        title={s.album_title}
                                                        artist={s.artist_name}
                                                        coverUrl={s.cover_url}
                                                        compact
                                                        className={getGridItemClass(idx, savedAlbums.length)}
                                                        onClick={() =>
                                                            handleAlbumSelect({
                                                                id: s.album_id,
                                                                title: s.album_title,
                                                                artist_name: s.artist_name,
                                                                coverUrl: s.cover_url,
                                                            })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Suggestions CF */}
                                    {hasSuggestions && (
                                        <div className="mt-8">
                                            <SectionTitle>Pour toi</SectionTitle>
                                            <div className={getTwoColumnGridClass(suggestions.length)}>
                                                {suggestions.map((s, idx) => (
                                                    <AlbumCard
                                                        key={s.album_id}
                                                        title={s.title}
                                                        artist={s.artist}
                                                        coverUrl={s.cover_url}
                                                        compact
                                                        className={getGridItemClass(idx, suggestions.length)}
                                                        onClick={() =>
                                                            handleAlbumSelect({
                                                                id: s.album_id,
                                                                title: s.title,
                                                                artist_name: s.artist,
                                                                coverUrl: s.cover_url,
                                                            })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {step === "form" && selectedAlbum && (
                                <div className="space-y-section-md">
                                    {/* Pochette + infos album */}
                                    <div className="pb-6 border-b border-border">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="relative w-20 h-20 rounded-[8px] overflow-hidden flex-shrink-0 bg-background-secondary">
                                                {selectedAlbum.coverUrl ? (
                                                    <CoverImage
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
                                                    <h2 className="text-h2 font-medium text-text-primary leading-tight">
                                                        {selectedAlbum.title}
                                                    </h2>
                                                    {previousEntry !== null && (
                                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-background-secondary text-text-secondary whitespace-nowrap">
                                                            Ré-écoute
                                                            {previousEntry.rating !== null
                                                                ? ` · ${previousEntry.rating}/10`
                                                                : ""}
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
                                            onClick={() => {
                                                setStep("select");
                                                setSelectedAlbum(null);
                                                setPreviousEntry(null);
                                            }}
                                            className="text-label text-text-tertiary underline hover:text-text-primary transition-colors duration-150"
                                        >
                                            Changer
                                        </button>
                                    </div>

                                    {/* Note */}
                                    <div>
                                        <label className="block text-meta text-text-secondary mb-4">Note</label>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <StarRating value={rating} onChange={setRating} />
                                            </div>
                                            <span className="flex-shrink-0 text-text-primary font-medium whitespace-nowrap">
                                                {rating ?? 0} / 10
                                            </span>
                                        </div>
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
                                                className="w-full px-4 py-3 pr-10 bg-background-secondary border border-border rounded-[10px] text-text-primary focus:outline-none focus:border-[#8E6F5E] focus:ring-0 appearance-none"
                                            />
                                            <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none">
                                                <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Commentaire */}
                                    <div>
                                        <label className="block text-meta text-text-secondary mb-2">Quelques mots</label>
                                        <textarea
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="Ce que tu as ressenti, si tu en as envie."
                                            className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] focus:ring-0 resize-none h-32"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSubmitDiary}
                                        disabled={isLoading}
                                        className="w-full px-6 py-3 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#D8D3CB] disabled:text-text-disabled text-[#F5F3EF] font-medium rounded-[8px] transition-opacity disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? "Enregistrement..." : "Enregistrer"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── MODE SAVE ── */}
                    {mode === "save" && !isLoading && (
                        <>
                            <AlbumSearchForDiary onSelectAlbum={handleAlbumSelect} />

                            {/* Suggestions CF */}
                            {hasSuggestions && (
                                <div className="mt-8">
                                    <SectionTitle>Pour toi</SectionTitle>
                                    <div className={getTwoColumnGridClass(suggestions.length)}>
                                        {suggestions.map((s, idx) => (
                                            <AlbumCard
                                                key={s.album_id}
                                                title={s.title}
                                                artist={s.artist}
                                                coverUrl={s.cover_url}
                                                compact
                                                className={getGridItemClass(idx, suggestions.length)}
                                                onClick={() =>
                                                    handleAlbumSelect({
                                                        id: s.album_id,
                                                        title: s.title,
                                                        artist_name: s.artist,
                                                        coverUrl: s.cover_url,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Découverte */}
                            {hasDiscovery && (
                                <div className="mt-8">
                                    <SectionTitle>Découverte</SectionTitle>
                                    <div className={getTwoColumnGridClass(Math.min(discovery.length, 6))}>
                                        {discovery.slice(0, 6).map((d, idx) => (
                                            <AlbumCard
                                                key={d.album_id}
                                                title={d.title}
                                                artist={d.artist}
                                                coverUrl={d.cover_url}
                                                compact
                                                className={getGridItemClass(idx, Math.min(discovery.length, 6))}
                                                onClick={() =>
                                                    handleAlbumSelect({
                                                        id: d.album_id,
                                                        title: d.title,
                                                        artist_name: d.artist,
                                                        coverUrl: d.cover_url,
                                                    })
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
