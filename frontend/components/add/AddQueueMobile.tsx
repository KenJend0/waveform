"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import StarRating from "@/components/StarRating";
import { CoverImage } from "@/components/CoverImage";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzAlbums, searchMusicBrainzRecordings, importAlbumFromMusicBrainz, importTrackFromMusicBrainz } from "@/app/actions/musicbrainz";
import { mergeAndRank } from "@/lib/searchRanking";
import { upsertDiaryEntry } from "@/app/actions/diary";
import { upsertTrackDiaryEntry } from "@/app/actions/track-diary";
import { showToast } from "@/components/Toast";
import { type AddQueueItem, ADD_QUEUE_SOURCE_LABELS } from "@/lib/buildAddQueue";
import { ChevronDown, ChevronUp, ChevronRight, Search, X, Disc3, Music } from "lucide-react";

type Props = {
    initialQueue: AddQueueItem[];
};

type RatedCover = { key: string; coverUrl: string | null; title: string };
type PanelMode = "none" | "search" | "comment";

// Cartes derrière l'active, façon pile de fiches cartonnées posées droit (pas
// d'inclinaison, pas de transform) : chaque carte est positionnée avec des
// offsets top/left/right/bottom en px fixes et contigus, donc son bord bas
// est toujours calculable exactement — jamais plus loin que le bord du
// conteneur —, ce qui les empêche par construction de dépasser sous la
// bottom navbar (contrairement à des cartes inclinées dont les coins
// dépassent de façon difficile à calculer précisément).
// Pas constant (10px en hauteur, 5px en largeur) entre chaque carte de la
// pile — y compris entre la carte active et la première peek card — pour que
// l'emboîtement soit régulier d'un étage à l'autre, pas seulement entre la
// carte active et la première peek.
const PEEK_STYLES = [
    { bottomInset: 10, sideInset: 5 }, // la plus proche de la carte active
    { bottomInset: 0, sideInset: 10 }, // la plus en arrière, flush avec le bas
];
// Marge réservée sous la carte active = le même pas (10px) que celui utilisé
// entre les peek cards elles-mêmes.
const PEEK_RESERVE_PX = 20;

// Inclinaisons pour les pochettes éparpillées dans l'état de fin de file.
const FAN_STYLES = [
    { rotate: -9, translateX: -34, translateY: 6, z: 1 },
    { rotate: 4, translateX: 0, translateY: -6, z: 3 },
    { rotate: 12, translateX: 32, translateY: 10, z: 2 },
];

const SOFT_TRANSITION = { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const };
const LAYOUT_TRANSITION = { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const };
const SEARCH_LIMIT_INITIAL = 4;
const SEARCH_LIMIT_EXPANDED = 20;
// Hauteur max de la zone de résultats une fois "voir plus" déplié — au-delà,
// elle scrolle au lieu de continuer à grandir (~4 lignes de résultats).
const SEARCH_RESULTS_EXPANDED_MAX_PX = 220;
// Plafond de hauteur de la mini-carte (recherche) : elle peut grandir jusque
// là pour absorber l'espace libéré par une liste de résultats courte, mais
// jamais au-delà — sinon elle deviendrait une grande carte presque vide
// quand la recherche n'a que 0-1 résultat.
const SEARCH_MINI_CARD_MAX_PX = 220;

export default function AddQueueMobile({ initialQueue }: Props) {
    const today = new Date().toISOString().split("T")[0];

    const [queue, setQueue] = useState<AddQueueItem[]>(initialQueue);
    const [index, setIndex] = useState(0);
    const [rating, setRating] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [panelMode, setPanelMode] = useState<PanelMode>("none");
    const [ratedCovers, setRatedCovers] = useState<RatedCover[]>([]);
    const [transitioning, setTransitioning] = useState(false);

    const [searchEntityType, setSearchEntityType] = useState<"album" | "track">("album");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultUI[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchImportingId, setSearchImportingId] = useState<string | null>(null);
    const [searchExpanded, setSearchExpanded] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

    const current = queue[index] ?? null;
    const currentHref = current ? (current.kind === "album" ? `/albums/${current.id}` : `/tracks/${current.id}`) : "#";
    const currentSeeLabel = current?.kind === "album" ? "voir l'album" : "voir le titre";
    const upcoming = queue.slice(index + 1, index + 3);
    const remaining = queue.length - index;
    const peekCount = Math.min(upcoming.length, 2);

    // Deux sous-états distincts : le commentaire réorganise la carte (toujours pleine
    // hauteur), la recherche-avec-résultats la réduit à une mini-carte ancrée en bas.
    // En dessous de 3 résultats, la liste reste petite et on garde la carte normale
    // (juste réduite par l'espace pris par la barre + la liste) plutôt que de
    // basculer sur la mini-carte, qui n'a alors pas grand-chose à absorber.
    const commentOpen = panelMode === "comment";
    const searchHasResults = panelMode === "search" && searchQuery.trim() !== "" && searchResults.length >= 3;
    const cardView = commentOpen ? "comment" : searchHasResults ? "search" : "full";
    const visibleResults = searchExpanded ? searchResults : searchResults.slice(0, SEARCH_LIMIT_INITIAL);
    const hasMoreResults = !searchExpanded && searchResults.length > SEARCH_LIMIT_INITIAL;

    const resetCardForm = () => {
        setRating(null);
        setComment("");
    };

    const closePanel = () => {
        setPanelMode("none");
        setSearchQuery("");
        setSearchResults([]);
        setSearchExpanded(false);
    };

    const advance = () => {
        setIndex((i) => i + 1);
        resetCardForm();
        closePanel();
    };

    // Envoi en arrière-plan — ne bloque jamais la navigation dans la file.
    // L'utilisateur a déjà vu la carte passer à la suivante au moment où ça
    // résout ; une erreur ne peut donc être signalée qu'après coup via toast.
    const saveInBackground = (item: AddQueueItem, ratingValue: number, commentValue: string) => {
        const source = item.source === "foryou" ? "for_you" : undefined;
        const promise = item.kind === "album"
            ? upsertDiaryEntry({
                albumId: item.id,
                listenedAt: today,
                rating: ratingValue,
                reviewBody: commentValue.trim() || undefined,
                isPublic: true,
                source,
            })
            : upsertTrackDiaryEntry({
                trackId: item.id,
                albumId: item.albumId,
                artistId: item.artistId,
                listenedAt: today,
                rating: ratingValue,
                reviewBody: commentValue.trim() || undefined,
                isPublic: true,
                source,
            });

        promise
            .then((result) => {
                if (!result.success) {
                    showToast("error" in result && result.error ? result.error : `Erreur lors de l'enregistrement de « ${item.title} »`, "error");
                }
            })
            .catch(() => {
                showToast(`Erreur lors de l'enregistrement de « ${item.title} »`, "error");
            });
    };

    // Noter ne fait qu'une mise à jour locale — rien n'est envoyé au serveur
    // tant que l'utilisateur n'a pas swipé/cliqué "Suivant". Ça permet
    // d'annuler un misclick sans avoir à défaire une écriture déjà faite, et
    // ça libère le swipe immédiatement après avoir noté (plus d'attente réseau).
    const handleRate = (value: number) => {
        if (!current) return;
        setRating(value);
    };

    const clearRating = () => setRating(null);

    const handleNext = () => {
        if (!current) return;
        if (rating !== null) {
            saveInBackground(current, rating, comment);
            setRatedCovers((prev) => [...prev, { key: `${current.kind}-${current.id}`, coverUrl: current.coverUrl, title: current.title }]);
        }
        advance();
    };

    const insertItem = (item: AddQueueItem) => {
        setQueue((prev) => {
            const next = [...prev];
            next.splice(index, 0, item);
            return next;
        });
        closePanel();
        resetCardForm();
    };

    const handleTabClick = (tab: "album" | "track") => {
        if (panelMode === "search" && searchEntityType === tab) {
            closePanel();
        } else {
            setSearchEntityType(tab);
            setPanelMode("search");
            setSearchQuery("");
            setSearchResults([]);
            setSearchExpanded(false);
        }
    };

    const toggleComment = () => {
        setPanelMode((p) => (p === "comment" ? "none" : "comment"));
    };

    // Recherche compacte intégrée — la carte ne se réduit que lorsque des
    // résultats sont effectivement affichés (cf. searchHasResults).
    useEffect(() => {
        if (panelMode !== "search" || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        let aborted = false;

        const run = async () => {
            await new Promise((r) => setTimeout(r, 300));
            if (aborted) return;

            setSearchLoading(true);
            const isAlbum = searchEntityType === "album";
            const mbAlbumPromise = isAlbum ? searchMusicBrainzAlbums(searchQuery, 20).catch(() => null) : null;
            const mbTrackPromise = !isAlbum ? searchMusicBrainzRecordings(searchQuery, 20).catch(() => null) : null;

            let internal: SearchResultUI[] = [];
            try {
                internal = await searchInternal(searchQuery, isAlbum ? "albums" : "tracks");
            } catch {}
            if (aborted) return;

            setSearchResults(mergeAndRank(internal, [], searchQuery, SEARCH_LIMIT_EXPANDED));
            setSearchLoading(false);

            try {
                const mbList: SearchResultUI[] = [];
                if (isAlbum) {
                    const mbRes = await mbAlbumPromise;
                    if (aborted) return;
                    if (mbRes?.success && mbRes.results) {
                        mbRes.results.forEach((album) =>
                            mbList.push({
                                id: album.id,
                                releaseId: album.releaseId,
                                title: album.title,
                                subtitle: album.artistName,
                                kind: "album",
                                coverUrl: album.coverUrl || null,
                                releaseDate: album.releaseDate,
                                source: "musicbrainz",
                                score: album.score,
                                releaseCount: album.releaseCount,
                            })
                        );
                    }
                } else {
                    const mbRes = await mbTrackPromise;
                    if (aborted) return;
                    if (mbRes?.success && mbRes.results) {
                        mbRes.results.forEach((rec) =>
                            mbList.push({
                                id: rec.mbid,
                                recordingMbid: rec.mbid,
                                releaseId: rec.releaseId,
                                title: rec.title,
                                subtitle: `${rec.artistName} · ${rec.albumTitle}`,
                                kind: "track",
                                coverUrl: rec.coverUrl || null,
                                source: "musicbrainz",
                                score: rec.score,
                            })
                        );
                    }
                }

                if (!aborted) setSearchResults(mergeAndRank(internal, mbList, searchQuery, SEARCH_LIMIT_EXPANDED));
            } catch {}
        };

        run();
        return () => { aborted = true; };
    }, [searchQuery, searchEntityType, panelMode]);

    const handleSearchSelect = async (item: SearchResultUI) => {
        if (searchImportingId) return;

        if (item.source === "musicbrainz") {
            setSearchImportingId(item.id);
            try {
                if (searchEntityType === "album") {
                    const result = await importAlbumFromMusicBrainz(item.releaseId || item.id);
                    if (result.success && "albumId" in result && result.albumId) {
                        insertItem({
                            kind: "album",
                            id: result.albumId,
                            title: item.title,
                            artist: item.subtitle || "Unknown Artist",
                            coverUrl: item.coverUrl ?? null,
                            year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
                            source: "search",
                        });
                    } else {
                        showToast("Erreur lors de l'import", "error");
                    }
                } else {
                    const result = await importTrackFromMusicBrainz(item.recordingMbid || item.id, item.releaseId || "", item.title);
                    if (result.success && result.trackId) {
                        const parts = (item.subtitle || "").split(" · ");
                        insertItem({
                            kind: "track",
                            id: result.trackId,
                            title: item.title,
                            artist: parts[0] || "",
                            coverUrl: item.coverUrl ?? null,
                            albumId: result.albumId || "",
                            albumTitle: parts[1] || "",
                            artistId: result.artistId || "",
                            source: "search",
                        });
                    } else {
                        showToast("Erreur lors de l'import du titre", "error");
                    }
                }
            } catch {
                showToast("Erreur lors de l'import", "error");
            } finally {
                setSearchImportingId(null);
            }
            return;
        }

        if (searchEntityType === "album") {
            insertItem({
                kind: "album",
                id: item.id,
                title: item.title,
                artist: item.subtitle || "Unknown Artist",
                coverUrl: item.coverUrl ?? null,
                year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
                source: "search",
            });
        } else {
            const parts = (item.subtitle || "").split(" · ");
            insertItem({
                kind: "track",
                id: item.id,
                title: item.title,
                artist: parts[0] || "Unknown",
                coverUrl: item.coverUrl ?? null,
                albumId: item.trackAlbumId || "",
                albumTitle: parts[1] || "",
                artistId: item.trackArtistId || "",
                source: "search",
            });
        }
    };

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        if (Math.abs(info.offset.x) > 120) {
            handleNext();
        }
    };

    return (
        <div
            className="lg:hidden h-[100dvh] overflow-hidden flex flex-col px-6 pt-6"
            style={{ paddingBottom: "calc(var(--bottom-nav-clearance, 3.75rem) + 0.75rem)" }}
        >
            <h1 className="text-h1 text-text-primary mb-3 flex-shrink-0">
                Ajouter une <em className="italic text-accent-deep">écoute</em>
            </h1>

            <div className="flex gap-2 mb-3 flex-shrink-0">
                <button
                    onClick={() => handleTabClick("album")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-colors duration-200 ${
                        panelMode === "search" && searchEntityType === "album"
                            ? "bg-accent-deep text-paper-hi"
                            : "bg-background-secondary text-text-secondary"
                    }`}
                >
                    {panelMode === "search" && searchEntityType === "album" ? <X size={12} strokeWidth={2.5} /> : <Search size={12} strokeWidth={2} />}
                    Chercher un album
                </button>
                <button
                    onClick={() => handleTabClick("track")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-colors duration-200 ${
                        panelMode === "search" && searchEntityType === "track"
                            ? "bg-accent-deep text-paper-hi"
                            : "bg-background-secondary text-text-secondary"
                    }`}
                >
                    {panelMode === "search" && searchEntityType === "track" ? <X size={12} strokeWidth={2.5} /> : <Search size={12} strokeWidth={2} />}
                    Chercher un titre
                </button>
            </div>

            {current && (
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        À noter · {remaining} en attente
                    </span>
                    <span className="w-16 h-[3px] rounded-full overflow-hidden flex-shrink-0" style={{ background: "#D8D3CB" }}>
                        <span
                            className="h-full rounded-full block transition-[width] duration-300 ease-out"
                            style={{ width: `${queue.length > 0 ? (index / queue.length) * 100 : 0}%`, background: "#8E6F5E" }}
                        />
                    </span>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Barre de recherche — s'ouvre/se ferme indépendamment de la zone de
                    résultats, et reste accessible même quand la pile est vide (pour
                    pouvoir ajouter un album/titre une fois tout rattrapé). */}
                <AnimatePresence initial={false}>
                    {panelMode === "search" && (
                        <motion.div
                            key="search-bar"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={SOFT_TRANSITION}
                            onAnimationStart={() => setTransitioning(true)}
                            onAnimationComplete={() => {
                                setTransitioning(false);
                                if (panelMode === "search") searchInputRef.current?.focus();
                            }}
                            className="overflow-hidden flex-shrink-0 mb-3"
                        >
                            <div className="flex items-center gap-2 bg-paper-hi border border-accent rounded-input px-3 py-2.5" style={{ boxShadow: "0 0 0 3px rgba(142,111,94,0.08)" }}>
                                <Search size={15} className="text-accent flex-shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setSearchExpanded(false);
                                    }}
                                    placeholder={searchEntityType === "album" ? "Rechercher un album…" : "Rechercher un titre…"}
                                    className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary focus:outline-none"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Zone de résultats — reste compacte sans résultats, prend tout l'espace
                    libéré dès qu'il y a des résultats à montrer, s'arrête juste au-dessus
                    de la mini-carte (ou remplit tout l'espace si la pile est vide). */}
                {panelMode === "search" && searchQuery.trim() && (
                    <motion.div
                        layout
                        transition={{ layout: LAYOUT_TRANSITION }}
                        className="bg-paper-hi border border-border rounded-input overflow-hidden mb-3 flex flex-col flex-shrink-0"
                        style={searchExpanded ? { maxHeight: SEARCH_RESULTS_EXPANDED_MAX_PX } : undefined}
                    >
                        <div className={searchExpanded ? "flex-1 min-h-0 overflow-y-auto" : "overflow-hidden"}>
                            {searchLoading ? (
                                <div className="flex items-center gap-2 px-3 py-3 text-sm text-text-tertiary">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent" />
                                    Recherche…
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="px-3 py-3 text-sm text-text-tertiary">Aucun résultat</div>
                            ) : (
                                visibleResults.map((item) => (
                                    <button
                                        key={`${item.source}-${item.id}`}
                                        onClick={() => handleSearchSelect(item)}
                                        disabled={!!searchImportingId}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 border-b border-background-secondary last:border-b-0 text-left hover:bg-background-secondary transition-colors duration-150 disabled:opacity-50"
                                    >
                                        <div className="w-9 h-9 rounded-badge overflow-hidden flex-shrink-0 bg-background-tertiary flex items-center justify-center">
                                            {searchImportingId === item.id ? (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent" />
                                            ) : item.coverUrl ? (
                                                <CoverImage
                                                    key={item.coverUrl}
                                                    src={item.coverUrl}
                                                    alt={item.title}
                                                    width={36}
                                                    height={36}
                                                    className="w-full h-full object-cover"
                                                    placeholder={searchEntityType === "album" ? <Disc3 size={13} className="text-text-disabled" /> : <Music size={13} className="text-text-disabled" />}
                                                />
                                            ) : searchEntityType === "album" ? (
                                                <Disc3 size={13} className="text-text-disabled" />
                                            ) : (
                                                <Music size={13} className="text-text-disabled" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] text-text-primary truncate leading-snug">{item.title}</p>
                                            <p className="text-[11px] text-text-secondary truncate leading-snug">{item.subtitle}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        {hasMoreResults && (
                            <button
                                onClick={() => setSearchExpanded(true)}
                                className="flex-shrink-0 w-full flex items-center justify-center gap-1 px-3 py-2 text-[12px] font-medium text-accent border-t border-background-secondary hover:bg-background-secondary transition-colors duration-150"
                            >
                                Voir plus de résultats
                                <ChevronDown size={12} />
                            </button>
                        )}
                    </motion.div>
                )}

                {!current ? (
                    panelMode === "search" && searchQuery.trim() ? null : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        {ratedCovers.length > 0 ? (
                            <>
                                <div className="relative h-28 mb-8" style={{ width: 200, margin: "0 auto" }}>
                                    {ratedCovers.slice(-3).map((c, i, arr) => {
                                        const fan = FAN_STYLES[i + (3 - arr.length)];
                                        return (
                                            <div
                                                key={c.key}
                                                className="absolute left-1/2 top-0 w-24 h-24 rounded-cover-sm overflow-hidden border-2 border-paper-hi"
                                                style={{
                                                    marginLeft: -48 + fan.translateX,
                                                    marginTop: fan.translateY,
                                                    transform: `rotate(${fan.rotate}deg)`,
                                                    zIndex: fan.z,
                                                    boxShadow: "0 6px 16px -6px rgba(60,40,20,0.35)",
                                                }}
                                            >
                                                {c.coverUrl ? (
                                                    <CoverImage key={c.coverUrl} src={c.coverUrl} alt={c.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                                                ) : (
                                                    <div className="w-full h-full bg-background-tertiary" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="font-display italic text-[22px] text-text-warm mb-2">Tout est à jour</p>
                                <p className="text-meta text-text-secondary mb-1">
                                    Tu viens de noter <span className="text-accent-deep font-medium">{ratedCovers.length} écoute{ratedCovers.length > 1 ? "s" : ""}</span>.
                                </p>
                                <p className="text-meta text-text-tertiary mb-4">Ton journal a rattrapé son retard.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-display italic text-[17px] text-text-warm mb-2">Tout est à jour</p>
                                <p className="text-meta text-text-tertiary mb-4">Plus rien à noter pour le moment.</p>
                            </>
                        )}
                        <a href="/explore" className="font-display italic text-sm text-accent border-b border-accent pb-px">
                            Découvrir de nouveaux albums
                        </a>
                    </div>
                    )
                ) : (
                    <div className={`flex justify-center flex-1 min-h-0 ${searchHasResults ? "items-center" : ""}`}>
                            <div
                                className={`relative w-full max-w-sm flex flex-col justify-start ${searchHasResults ? "" : "h-full"}`}
                                style={searchHasResults ? { height: "100%", maxHeight: SEARCH_MINI_CARD_MAX_PX } : undefined}
                            >
                                {panelMode === "none" && Array.from({ length: peekCount }).map((_, i) => {
                                    const depth = peekCount - i; // 2 puis 1
                                    const peek = PEEK_STYLES[depth - 1];
                                    const peekItem = upcoming[depth - 1];
                                    return (
                                        <div
                                            key={`peek-${depth}`}
                                            className="absolute top-0 rounded-card-lg overflow-hidden bg-background-tertiary border border-border"
                                            style={{
                                                left: peek.sideInset,
                                                right: peek.sideInset,
                                                bottom: peek.bottomInset,
                                                zIndex: 10 - depth,
                                                boxShadow: "0 2px 6px rgba(60,40,20,0.10)",
                                            }}
                                        >
                                            {peekItem?.coverUrl && (
                                                <CoverImage
                                                    key={peekItem.coverUrl}
                                                    src={peekItem.coverUrl}
                                                    alt=""
                                                    fill
                                                    className="object-cover opacity-70"
                                                    placeholder={<div className="w-full h-full" />}
                                                />
                                            )}
                                            {/* Assombrissement progressif : même sans pochette, chaque carte plus
                                                au fond doit lire comme "plus loin/plus sombre" que celle devant elle. */}
                                            <div
                                                className="absolute inset-0"
                                                style={{ backgroundColor: `rgba(28,28,28,${0.05 * depth})` }}
                                            />
                                        </div>
                                    );
                                })}

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`${current.kind}-${current.id}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, x: -200, rotate: -8 }}
                                        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1], layout: LAYOUT_TRANSITION }}
                                        drag={panelMode === "none" && !transitioning ? "x" : false}
                                        dragElastic={0.6}
                                        dragSnapToOrigin
                                        onDragEnd={handleDragEnd}
                                        onLayoutAnimationStart={() => setTransitioning(true)}
                                        onLayoutAnimationComplete={() => setTransitioning(false)}
                                        className="relative z-10 bg-paper-hi border border-border rounded-card-lg overflow-hidden h-full flex flex-col"
                                        style={!searchHasResults && panelMode === "none" && peekCount > 0 ? { height: `calc(100% - ${PEEK_RESERVE_PX}px)` } : undefined}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                            key={cardView}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={SOFT_TRANSITION}
                                            onAnimationStart={() => setTransitioning(true)}
                                            onAnimationComplete={() => {
                                                setTransitioning(false);
                                                // Focus une fois la transition d'entrée réellement terminée
                                                // (pas une durée devinée à l'avance) — la carte ne bouge plus
                                                // quand le clavier pousse la mise en page.
                                                if (commentOpen) commentTextareaRef.current?.focus();
                                            }}
                                            className="h-full flex flex-col"
                                        >
                                        {commentOpen ? (
                                            <div className="h-full flex flex-col p-4">
                                                <div className="flex items-center gap-4 mb-3 flex-shrink-0 min-w-0">
                                                    <div className="relative w-20 h-20 rounded-cover-sm overflow-hidden flex-shrink-0 bg-background-tertiary">
                                                        {current.coverUrl ? (
                                                            <CoverImage key={current.coverUrl} src={current.coverUrl} alt={current.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                                                        ) : (
                                                            <div className="w-full h-full bg-background-tertiary" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-display text-[19px] text-text-warm leading-tight truncate">{current.title}</p>
                                                        <p className="text-meta text-text-secondary truncate">
                                                            {current.artist}
                                                            {current.kind === "album" && current.year ? ` · ${current.year}` : ""}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mb-3 flex-shrink-0 flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <StarRating value={rating} onChange={handleRate} compact />
                                                    </div>
                                                    {rating !== null && (
                                                        <button
                                                            onClick={clearRating}
                                                            aria-label="Annuler la note"
                                                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary hover:bg-background-secondary transition-colors duration-150"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
                                                    <button
                                                        onClick={toggleComment}
                                                        className="flex items-center gap-1 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                                                    >
                                                        <ChevronUp size={14} />
                                                        Écrire une critique…
                                                    </button>
                                                    <Link
                                                        href={currentHref}
                                                        className="flex-shrink-0 font-display italic lowercase text-[13px] text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                                                    >
                                                        {currentSeeLabel}
                                                    </Link>
                                                </div>

                                                <div className="flex-1 min-h-0 mb-3">
                                                    <textarea
                                                        ref={commentTextareaRef}
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                        placeholder="Ce que tu as ressenti, si tu en as envie."
                                                        className="w-full h-full min-w-0 box-border px-3 py-2 bg-background-secondary border border-border rounded-input text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-0 resize-none text-sm"
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleNext}
                                                    className="flex-shrink-0 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-button transition-colors duration-200"
                                                    style={{ backgroundColor: rating !== null ? "#5C4538" : "#ECE8E1", color: rating !== null ? "#FAF8F4" : "#1C1C1C" }}
                                                >
                                                    {rating !== null ? "Suivant" : "Passer"}
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        ) : searchHasResults ? (
                                            <div className="h-full flex flex-col justify-center p-3">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="relative w-12 h-12 rounded-cover-sm overflow-hidden flex-shrink-0 bg-background-tertiary">
                                                        {current.coverUrl ? (
                                                            <CoverImage key={current.coverUrl} src={current.coverUrl} alt={current.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                                                        ) : (
                                                            <div className="w-full h-full bg-background-tertiary" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-display text-[15px] text-text-warm leading-tight truncate">{current.title}</p>
                                                        <p className="text-label text-text-secondary truncate">
                                                            {current.artist}
                                                            {current.kind === "album" && current.year ? ` · ${current.year}` : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <StarRating value={rating} onChange={handleRate} compact />
                                                    </div>
                                                    {rating !== null && (
                                                        <button
                                                            onClick={clearRating}
                                                            aria-label="Annuler la note"
                                                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary hover:bg-background-secondary transition-colors duration-150"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative flex-1 min-h-0 bg-background-tertiary">
                                                    {current.coverUrl ? (
                                                        <CoverImage key={current.coverUrl} src={current.coverUrl} alt={current.title} fill className="object-cover" placeholder={<div className="w-full h-full bg-background-tertiary" />} />
                                                    ) : (
                                                        <div className="w-full h-full bg-background-tertiary" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#2C2018]/35 to-transparent" />
                                                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                                                        <span className="font-display italic text-[14px] text-accent-deep bg-paper-hi/90 backdrop-blur-sm border border-border/60 rounded-full px-3 py-1 whitespace-nowrap">
                                                            {ADD_QUEUE_SOURCE_LABELS[current.source]}
                                                        </span>
                                                        <span className="font-display italic text-[14px] text-text-secondary bg-paper-hi/90 backdrop-blur-sm border border-border/60 rounded-full px-2.5 py-1 whitespace-nowrap">
                                                            nº {String(index + 1).padStart(2, "0")}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-4 flex-shrink-0">
                                                    <h2 className="font-display font-normal text-h2 text-text-warm leading-tight mb-1">{current.title}</h2>
                                                    <p className="text-meta text-text-secondary mb-3">
                                                        {current.artist}
                                                        {current.kind === "album" && current.year ? ` · ${current.year}` : ""}
                                                        {current.kind === "track" && current.albumTitle ? <span className="text-text-tertiary"> · {current.albumTitle}</span> : ""}
                                                    </p>

                                                    <div className="mb-3 flex items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <StarRating value={rating} onChange={handleRate} compact />
                                                        </div>
                                                        {rating !== null && (
                                                            <button
                                                                onClick={clearRating}
                                                                aria-label="Annuler la note"
                                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary hover:bg-background-secondary transition-colors duration-150"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <button
                                                            onClick={toggleComment}
                                                            className="flex items-center gap-1 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                                                        >
                                                            <ChevronDown size={14} />
                                                            Écrire une critique
                                                        </button>
                                                        <Link
                                                            href={currentHref}
                                                            className="flex-shrink-0 font-display italic lowercase text-[13px] text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150"
                                                        >
                                                            {currentSeeLabel}
                                                        </Link>
                                                    </div>

                                                    <button
                                                        onClick={handleNext}
                                                        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-button transition-colors duration-200"
                                                        style={{ backgroundColor: rating !== null ? "#5C4538" : "#ECE8E1", color: rating !== null ? "#FAF8F4" : "#1C1C1C" }}
                                                    >
                                                        {rating !== null ? "Suivant" : "Passer"}
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        </motion.div>
                                        </AnimatePresence>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                    </div>
                )}
            </div>
        </div>
    );
}
