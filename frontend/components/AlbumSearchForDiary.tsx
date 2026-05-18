"use client";

import { useState, useEffect, useRef } from "react";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzAlbums, importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { mergeAndRank } from "@/lib/searchRanking";
import { showToast } from "@/components/Toast";
import { CoverImage } from "@/components/CoverImage";
import { Disc3 } from "lucide-react";

const LIMIT = 6;

export type AlbumUI = {
    id: string;
    title: string;
    artist_name: string;
    coverUrl?: string | null;
    year?: number | null;
};

type Props = {
    onSelectAlbum: (album: AlbumUI) => void;
};

export default function AlbumSearchForDiary({ onSelectAlbum }: Props) {
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

            // Phase 2 — MB en parallèle (démarre avant d'attendre l'interne)
            const mbPromise = searchMusicBrainzAlbums(q, 20).catch(() => null);
            setLoadingExtended(true);

            // Phase 1 — interne (rapide, premier paint)
            let internal: SearchResultUI[] = [];
            try {
                internal = await searchInternal(q, "albums");
            } catch {}
            if (aborted) return;

            const phase1 = mergeAndRank(internal, [], q, LIMIT);
            setResults(phase1);
            setLoading(false);

            // Phase 2 — merge MB
            try {
                const mbRes = await mbPromise;
                if (aborted) return;

                const mbList: SearchResultUI[] = [];
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
                const result = await importAlbumFromMusicBrainz(item.releaseId || item.id);
                if (result.success && "albumId" in result && result.albumId) {
                    if ("mbid" in result && result.mbid && "title" in result && "artist" in result) {
                        fetch("/api/enrich", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ albumId: result.albumId, mbid: result.mbid, title: result.title, artist: result.artist }),
                        }).catch(() => {});
                    }
                    onSelectAlbum({
                        id: result.albumId,
                        title: item.title,
                        artist_name: item.subtitle || "Unknown Artist",
                        coverUrl: item.coverUrl,
                        year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
                    });
                    setQ("");
                    setResults([]);
                } else {
                    showToast("Erreur lors de l'import", "error");
                }
            } catch {
                showToast("Erreur lors de l'import", "error");
            } finally {
                setImportingId(null);
            }
        } else {
            onSelectAlbum({
                id: item.id,
                title: item.title,
                artist_name: item.subtitle || "Unknown Artist",
                coverUrl: item.coverUrl,
                year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
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
                placeholder="Rechercher un album..."
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
                                                placeholder={<Disc3 size={14} className="text-text-disabled" />}
                                            />
                                        ) : (
                                            <Disc3 size={14} className="text-text-disabled" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[14px] text-text-primary truncate leading-snug">
                                            {importingId === item.id ? "Import en cours…" : item.title}
                                        </p>
                                        {importingId !== item.id && (
                                            <p className="text-[12px] text-text-secondary truncate mt-0.5 leading-snug">
                                                {item.subtitle}
                                                {item.releaseDate && (
                                                    <span className="text-text-disabled"> · {item.releaseDate.substring(0, 4)}</span>
                                                )}
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
