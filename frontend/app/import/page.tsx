// frontend/app/import/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import { searchMusicBrainz, previewAlbumFromMusicBrainz, importAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import { showToast } from "@/components/Toast";

type MusicBrainzAlbum = {
    id: string;
    title: string;
    artist: string;
    coverUrl?: string | null;
    releaseDate?: string;
};

type AlbumPreview = {
    mbid: string;
    title: string;
    artist: string;
    artistMbid: string;
    releaseDate?: string;
    coverUrl?: string | null;
    tracks: Array<{
        title: string;
        position: number;
        duration: number | null;
        mbid: string;
    }>;
};

export default function ImportPage() {
    const router = useRouter();

    const [q, setQ] = useState("");
    const [results, setResults] = useState<MusicBrainzAlbum[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAlbum, setSelectedAlbum] = useState<AlbumPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!q.trim()) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const t = setTimeout(async () => {
            try {
                setLoading(true);
                const response = await searchMusicBrainz(q, 10);

                if (response.success && response.results) {
                    const albums = response.results.map((r) => ({
                        id: r.id,
                        title: r.title,
                        artist: r.artistName,
                        coverUrl: r.coverUrl || null,
                        releaseDate: r.releaseDate,
                    }));
                    setResults(albums);
                    setIsOpen(true);
                } else {
                    setResults([]);
                    setIsOpen(false);
                }
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
                setIsOpen(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(t);
    }, [q]);

    const handleSelectAlbum = async (album: MusicBrainzAlbum) => {
        setPreviewLoading(true);
        try {
            const result = await previewAlbumFromMusicBrainz(album.id);

            if (result.success && result.preview) {
                setSelectedAlbum(result.preview);
                setIsOpen(false);
            } else {
                showToast("Erreur lors du chargement de l'aperÃ§u", "error");
            }
        } catch (error) {
            console.error("Preview error:", error);
            showToast("Erreur lors du chargement de l'aperçu", "error");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleImportAlbum = async () => {
        if (!selectedAlbum) return;

        setImporting(true);
        try {
            const result = await importAlbumFromMusicBrainz(selectedAlbum.mbid);

            if (result.success && 'albumId' in result && result.albumId) {
                const wasImported = (result as { imported?: boolean }).imported ?? true;
                if (wasImported) {
                    showToast("Album importe", "success");
                } else {
                    showToast("Deja dans la bibliotheque", "info");
                }
                const target = wasImported ? `/albums/${result.albumId}?addToDiary=1` : `/albums/${result.albumId}`;
                router.push(target);
            } else {
                const errorMessage = ('error' in result ? result.error : "Erreur lors de l'import") || "Erreur lors de l'import";
                showToast(errorMessage, "error");
            }
        } catch (error) {
            console.error("Import error:", error);
            showToast("Erreur lors de l'import", "error");
        } finally {
            setImporting(false);
        }
    };

    return (
        <>
            {/* Header section */}
            <div className="p-6 pb-0">
                <div className="max-w-page mx-auto mb-8">
                    <BackButton />
                </div>

                <div className="max-w-page mx-auto">
                    <h1 className="text-h1 text-text-primary">
                        Mettre de côté un album
                    </h1>
                    <p className="mt-1 text-[14px] text-text-secondary">
                        Pour y revenir plus tard.
                    </p>
                </div>
            </div>

            {/* Main content */}
            <main className="p-6 pb-20">
                <div className="max-w-page mx-auto">
                    {/* Search bar */}
                    <div className="relative w-full mb-8">
                        <input
                            type="text"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onFocus={() => q.trim() && setIsOpen(true)}
                            placeholder="Chercher un album à importer..."
                            className="w-full px-4 py-3 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] focus:ring-0 transition-colors duration-150"
                        />

                        {/* Dropdown results */}
                        {isOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-[12px] z-50 max-h-96 overflow-y-auto">
                                {loading && <div className="p-4 text-center text-text-secondary text-[14px]">Chargement...</div>}

                                {!loading && results.length === 0 && q.trim() && (
                                    <div className="p-4 text-center text-text-secondary text-[14px]">Aucun album trouvé</div>
                                )}

                                {results.map((album, index) => (
                                    <button
                                        key={album.id || index}
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
                                            <div className="font-medium text-text-primary truncate">{album.title}</div>
                                            <div className="text-[14px] text-text-secondary truncate">{album.artist}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Album preview */}
                    {previewLoading && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8E6F5E] mx-auto mb-4"></div>
                            <p className="text-text-secondary text-[14px]">Chargement de l'aperçu...</p>
                        </div>
                    )}

                    {selectedAlbum && !previewLoading && (
                        <div className="space-y-6">
                            {/* Album info */}
                            <div className="pb-6 border-b border-border-divider">
                                {selectedAlbum.coverUrl && (
                                    <img
                                        src={selectedAlbum.coverUrl}
                                        alt={selectedAlbum.title}
                                        className="w-32 h-32 rounded-[10px] object-cover mb-4"
                                    />
                                )}
                                <h2 className="text-[24px] font-medium text-text-primary mb-1">
                                    {selectedAlbum.title}
                                </h2>
                                <p className="text-text-secondary">
                                    {selectedAlbum.artist}
                                </p>
                            </div>

                            {/* Tracks */}
                            <div>
                                <h3 className="text-h2 text-text-primary mb-3">Pistes ({selectedAlbum.tracks.length})</h3>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {selectedAlbum.tracks.slice(0, 15).map((track) => (
                                        <div key={track.mbid} className="text-[14px] text-text-secondary flex justify-between">
                                            <span className="truncate">
                                                <span className="text-text-tertiary">{track.position}.</span> {track.title}
                                            </span>
                                            {track.duration != null && track.duration > 0 && (
                                                <span className="text-text-tertiary ml-2">
                                                    {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    {selectedAlbum.tracks.length > 15 && (
                                        <div className="text-[12px] text-text-tertiary">
                                            +{selectedAlbum.tracks.length - 15} autres pistes
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Import button */}
                            <button
                                onClick={handleImportAlbum}
                                disabled={importing}
                                className="w-full px-6 py-3 bg-[#1C1C1C] hover:opacity-85 disabled:bg-[#D8D3CB] disabled:text-text-disabled text-[#F5F3EF] font-medium rounded-[8px] transition-opacity disabled:cursor-not-allowed"
                            >
                                {importing ? "Import en cours..." : "Importer"}
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}

