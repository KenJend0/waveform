"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzRecordings, importTrackFromMusicBrainz } from "@/app/actions/musicbrainz";
import { mergeAndRank } from "@/lib/searchRanking";
import { showToast } from "@/components/Toast";
import { CoverImage } from "@/components/CoverImage";
import { Music, Search } from "lucide-react";

const LIMIT = 6;
const MAX_LIMIT = 20;

export type TrackUI = {
    id: string;
    title: string;
    artist_name: string;
    album_id: string;
    album_title: string;
    artist_id: string;
    coverUrl?: string | null;
    source?: string;
};

type Props = {
    onSelectTrack: (track: TrackUI) => void;
};

export default function TrackSearchForDiary({ onSelectTrack }: Props) {
    const [q, setQ] = useState("");
    const [internalResults, setInternalResults] = useState<SearchResultUI[]>([]);
    const [mbResults, setMbResults] = useState<SearchResultUI[]>([]);
    const [displayLimit, setDisplayLimit] = useState(LIMIT);
    const [loading, setLoading] = useState(false);
    const [loadingExtended, setLoadingExtended] = useState(false);
    const [importingId, setImportingId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const results = useMemo(
        () => mergeAndRank(internalResults, mbResults, q, displayLimit),
        [internalResults, mbResults, q, displayLimit]
    );
    const totalAvailable = useMemo(
        () => mergeAndRank(internalResults, mbResults, q, MAX_LIMIT).length,
        [internalResults, mbResults, q]
    );

    useEffect(() => {
        if (!q.trim()) {
            setInternalResults([]);
            setMbResults([]);
            setDisplayLimit(LIMIT);
            setLoading(false);
            setLoadingExtended(false);
            return;
        }

        let aborted = false;
        setDisplayLimit(LIMIT);

        const run = async () => {
            await new Promise((r) => setTimeout(r, 300));
            if (aborted) return;

            setLoading(true);
            setInternalResults([]);
            setMbResults([]);

            // Phase 2 — MB en parallèle
            const mbPromise = searchMusicBrainzRecordings(q, 20).catch(() => null);
            setLoadingExtended(true);

            // Phase 1 — interne
            let internal: SearchResultUI[] = [];
            try {
                internal = await searchInternal(q, "tracks");
            } catch {}
            if (aborted) return;

            setInternalResults(internal);
            setLoading(false);

            // Phase 2 — merge MB
            try {
                const mbRes = await mbPromise;
                if (aborted) return;

                const mbList: SearchResultUI[] = [];
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

                setMbResults(mbList);
            } catch {
            } finally {
                if (!aborted) setLoadingExtended(false);
            }
        };

        run();
        return () => { aborted = true; };
    }, [q]);

    const handleSelect = async (item: SearchResultUI) => {
        if (importingId) return;

        if (item.source === "musicbrainz") {
            setImportingId(item.id);
            try {
                const result = await importTrackFromMusicBrainz(
                    item.recordingMbid || item.id,
                    item.releaseId || "",
                    item.title
                );
                if (result.success && result.trackId) {
                    const parts = (item.subtitle || "").split(" · ");
                    onSelectTrack({
                        id: result.trackId,
                        title: item.title,
                        artist_name: parts[0] || "",
                        album_id: result.albumId || "",
                        album_title: parts[1] || "",
                        artist_id: result.artistId || "",
                        coverUrl: item.coverUrl || null,
                    });
                    setQ("");
                } else {
                    showToast("Erreur lors de l'import du titre", "error");
                }
            } catch {
                showToast("Erreur lors de l'import du titre", "error");
            } finally {
                setImportingId(null);
            }
        } else {
            const parts = (item.subtitle || "").split(" · ");
            onSelectTrack({
                id: item.id,
                title: item.title,
                artist_name: parts[0] || "Unknown",
                album_id: item.trackAlbumId || "",
                album_title: parts[1] || "",
                artist_id: item.trackArtistId || "",
                coverUrl: item.coverUrl || null,
            });
            setQ("");
        }
    };

    const showDropdown = q.trim() !== "" && (loading || results.length > 0 || loadingExtended);

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent pointer-events-none flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher un titre…"
                    className="w-full pl-11 pr-4 py-3 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] focus:ring-0 transition-colors duration-150"
                />
            </div>

            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[14px] z-50 overflow-hidden shadow-[0_8px_24px_-4px_rgba(42,37,32,0.12)]">
                    {loading ? (
                        <div className="flex items-center gap-2 px-4 py-4 text-[14px] text-text-tertiary">
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent flex-shrink-0" />
                            Chargement…
                        </div>
                    ) : results.length === 0 && !loadingExtended ? (
                        <div className="px-4 py-4 text-[14px] text-text-tertiary">Aucun résultat</div>
                    ) : (
                        <div>
                            {results.map((item) => (
                                <button
                                    key={`${item.source}-${item.id}`}
                                    onClick={() => handleSelect(item)}
                                    disabled={!!importingId}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-[#ECE8E1] last:border-b-0 text-left transition-colors duration-150 ${
                                        importingId === item.id
                                            ? "cursor-wait bg-[#ECE8E1]"
                                            : importingId
                                            ? "opacity-40 cursor-default"
                                            : "hover:bg-[#ECE8E1] cursor-pointer"
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-[6px] overflow-hidden flex-shrink-0 bg-[#E4DFD6] flex items-center justify-center">
                                        {importingId === item.id ? (
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />
                                        ) : item.coverUrl ? (
                                            <CoverImage
                                                src={item.coverUrl}
                                                alt={item.title}
                                                width={40}
                                                height={40}
                                                className="w-full h-full object-cover"
                                                placeholder={<Music size={14} className="text-text-disabled" />}
                                            />
                                        ) : (
                                            <Music size={14} className="text-text-disabled" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] text-text-primary truncate leading-snug">
                                            {importingId === item.id ? "Import en cours…" : item.title}
                                        </p>
                                        {importingId !== item.id && item.subtitle && (
                                            <p className="text-[12px] text-text-secondary truncate mt-0.5 leading-snug">
                                                {item.subtitle}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {loadingExtended && (
                                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-[#ECE8E1]">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent opacity-40" />
                                    <span className="text-[11px] text-text-disabled">Recherche étendue…</span>
                                </div>
                            )}
                            {!loadingExtended && displayLimit < MAX_LIMIT && totalAvailable > results.length && (
                                <button
                                    onClick={() => setDisplayLimit(MAX_LIMIT)}
                                    className="w-full px-3 py-2 border-t border-[#ECE8E1] text-[12px] text-accent hover:text-accent-deep transition-colors duration-150 text-left"
                                >
                                    Voir plus de résultats
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
