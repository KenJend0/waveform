"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { searchInternal } from "@/app/actions/search";

type AlbumUI = {
    id: string;
    title: string;
    artist_name: string;
    coverUrl?: string | null;
    year?: number | null;
};

type AlbumSearchForDiaryProps = {
    onSelectAlbum: (album: AlbumUI) => void;
};

export default function AlbumSearchForDiary({ onSelectAlbum }: AlbumSearchForDiaryProps) {
    const [q, setQ] = useState("");
    const [suggestions, setSuggestions] = useState<AlbumUI[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!q.trim()) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const t = setTimeout(async () => {
            try {
                setLoading(true);
                const results = await searchInternal(q, "albums");

                const albums = results
                    .filter(r => r.kind === "album")
                    .map((item) => ({
                        id: item.id,
                        title: item.title,
                        artist_name: item.subtitle || "Unknown Artist",
                        coverUrl: item.coverUrl || null,
                        year: item.releaseDate
                            ? new Date(item.releaseDate).getFullYear()
                            : undefined,
                    }));

                setSuggestions(albums);
                setIsOpen(true);
            } catch (error) {
                console.error("Search error:", error);
                setSuggestions([]);
                setIsOpen(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(t);
    }, [q]);

    const handleSelectAlbum = (album: AlbumUI) => {
        onSelectAlbum(album);
        setQ("");
        setSuggestions([]);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => q.trim() && setIsOpen(true)}
                placeholder="Rechercher un album..."
                className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] focus:ring-0"
            />

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-[12px] z-50 max-h-96 overflow-y-auto">
                    {loading && <div className="p-4 text-center text-[14px] text-text-tertiary">Chargement...</div>}

                    {!loading && suggestions.length === 0 && q.trim() && (
                        <div className="p-4 text-center text-[14px] text-text-tertiary space-y-2">
                            <div>Aucun album trouvé</div>
                            <Link
                                href="/import"
                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-[8px] border border-border text-text-secondary hover:text-text-primary hover:border-[#8E6F5E] transition-colors duration-150"
                            >
                                Importer un album
                            </Link>
                        </div>
                    )}

                    {suggestions.map((album) => (
                        <button
                            key={album.id}
                            onClick={() => handleSelectAlbum(album)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors duration-150 border-b border-border-divider last:border-b-0 text-left"
                        >
                            {album.coverUrl && (
                                <img
                                    src={album.coverUrl}
                                    alt={album.title}
                                    className="w-12 h-12 rounded-[8px] object-cover flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-[14px] text-text-primary truncate">{album.title}</div>
                                <div className="text-[12px] text-text-secondary truncate">{album.artist_name}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

