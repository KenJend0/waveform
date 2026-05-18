"use client";

import { useState, useEffect, useRef } from "react";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzRecordings, importTrackFromMusicBrainz } from "@/app/actions/musicbrainz";
import { mergeAndRank } from "@/lib/searchRanking";
import { showToast } from "@/components/Toast";
import { CoverImage } from "@/components/CoverImage";
import { Music } from "lucide-react";

const LIMIT = 6;

export type TrackUI = {
    id: string;
    title: string;
    artist_name: string;
    album_id: string;
    album_title: string;
    artist_id: string;
    coverUrl?: string | null;
};

type Props = {
    onSelectTrack: (track: TrackUI) => void;
};

export default function TrackSearchForDiary({ onSelectTrack }: Props) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<SearchResultUI[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingExtended, setLoadingExtended] = useState(false);
    const [importingId, setImportingId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!q.trim()) {
            setResults([]);
            setLoading(false);
            setLoadingExtended(false);
            return;
        }

        let aborted = false;

        const run = async () => {
            await new Promise((r) => setTimeout(r, 300));
            if (aborted) return;

            setLoading(true);
            setResults([]);

            // Phase 2 — MB en parallèle
            const mbPromise = searchMusicBrainzRecordings(q, 20).catch(() => null);
            setLoadingExtended(true);

            // Phase 1 — interne
            let internal: SearchResultUI[] = [];
            try {
                internal = await searchInternal(q, "tracks");
            } catch {}
            if (aborted) return;

            setResults(mergeAndRank(internal, [], q, LIMIT));
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

                setResults(mergeAndRank(internal, mbList, q, LIMIT));
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
                    setResults([]);
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
            setResults([]);
        }
    };

    const showDropdown = q.trim() !== "" && (loading || results.length > 0 || loadingExtended);

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un titre..."
                className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] focus:ring-0"
            />

            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-[12px] z-50 overflow-hidden shadow-lg">
                    {loading ? (
                        <div className="p-4 text-center text-[14px] text-text-tertiary">Chargement…</div>
                    ) : results.length === 0 && !loadingExtended ? (
                        <div className="p-4 text-center text-[14px] text-text-tertiary">Aucun résultat</div>
                    ) : (
                        <div>
                            {results.map((item) => (
                                <button
                                    key={`${item.source}-${item.id}`}
                                    onClick={() => handleSelect(item)}
                                    disabled={!!importingId}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 text-left transition-colors duration-150 ${
                                        importingId === item.id
                                            ? "cursor-wait bg-background-secondary"
                                            : importingId
                                            ? "opacity-40 cursor-default"
                                            : "hover:bg-background-secondary cursor-pointer"
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-[6px] overflow-hidden flex-shrink-0 bg-background-tertiary flex items-center justify-center">
                                        {importingId === item.id ? (
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E]" />
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
                                        <p className="font-medium text-[14px] text-text-primary truncate leading-snug">
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
                                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#8E6F5E] opacity-50" />
                                    <span className="text-[11px] text-text-disabled">Recherche étendue…</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
