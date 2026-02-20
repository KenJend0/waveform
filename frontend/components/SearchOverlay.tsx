"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists } from "@/app/actions/musicbrainz";
import { Clock, X } from "lucide-react";

type SearchTab = "all" | "albums" | "artists" | "users";

import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
} from '@/lib/recentSearches';

export default function SearchOverlay() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [q, setQ] = useState("");
    const [activeTab, setActiveTab] = useState<SearchTab>("all");
    const [internalResults, setInternalResults] = useState<SearchResultUI[]>([]);
    const [mbResults, setMbResults] = useState<SearchResultUI[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMB, setLoadingMB] = useState(false);
    const [showExtendButton, setShowExtendButton] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [searchTimeout, setSearchTimeout] = useState(false);
    const [mbError, setMbError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setRecentSearches(getRecentSearches());
            inputRef.current?.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!q.trim()) {
            setInternalResults([]);
            setMbResults([]);
            setShowExtendButton(false);
            setSearchTimeout(false);
            setMbError(false);
            return;
        }

        let timeoutId: NodeJS.Timeout;
        let searchAborted = false;

        const searchFlow = async () => {
            try {
                setLoading(true);
                setMbResults([]);
                setSearchTimeout(false);
                setMbError(false);

                // 1. Search internal first (debounced)
                await new Promise(resolve => setTimeout(resolve, 200));
                
                if (searchAborted) return;

                const results = await searchInternal(q, activeTab);
                
                if (searchAborted) return;
                
                setInternalResults(results);
                setLoading(false);

                // 2. If insufficient results and not searching users, trigger MusicBrainz
                const shouldSearchMB = results.length < 3 && activeTab !== "users";
                setShowExtendButton(shouldSearchMB);

                if (shouldSearchMB) {
                    // Start timeout warning after 3 seconds
                    timeoutId = setTimeout(() => {
                        if (!searchAborted) {
                            setSearchTimeout(true);
                        }
                    }, 3000);

                    setLoadingMB(true);
                    
                    try {
                        const mbResultsList: SearchResultUI[] = [];

                        if (activeTab === "all" || activeTab === "albums") {
                            const albumsRes = await searchMusicBrainzAlbums(q, 5);
                            if (albumsRes.success && albumsRes.results) {
                                albumsRes.results.slice(0, 5).forEach(album => {
                                    mbResultsList.push({
                                        id: album.id,
                                        title: album.title,
                                        subtitle: album.artistName,
                                        kind: "album",
                                        coverUrl: album.coverUrl,
                                        releaseDate: album.releaseDate,
                                        source: "musicbrainz",
                                    });
                                });
                            }
                        }

                        if (activeTab === "all" || activeTab === "artists") {
                            const artistsRes = await searchMusicBrainzArtists(q, 5);
                            if (artistsRes.success && artistsRes.results) {
                                artistsRes.results.slice(0, 5).forEach(artist => {
                                    mbResultsList.push({
                                        id: artist.id,
                                        title: artist.name,
                                        subtitle: [artist.type, artist.country].filter(Boolean).join(" · "),
                                        kind: "artist",
                                        source: "musicbrainz",
                                    });
                                });
                            }
                        }

                        if (!searchAborted) {
                            setMbResults(mbResultsList);
                            setSearchTimeout(false);
                        }
                    } catch (error) {
                        console.error("MusicBrainz search error:", error);
                        if (!searchAborted) {
                            setMbError(true);
                            setSearchTimeout(false);
                        }
                    } finally {
                        if (!searchAborted) {
                            setLoadingMB(false);
                        }
                    }
                }
            } catch {
                if (!searchAborted) {
                    setInternalResults([]);
                    setLoading(false);
                }
            }
        };

        searchFlow();

        return () => {
            searchAborted = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [q, activeTab]);

    const handleSelect = (item: SearchResultUI) => {
        if (q.trim()) {
            saveRecentSearch(q.trim());
        }

        setIsOpen(false);
        setInternalResults([]);
        setQ("");
        if (item.kind === "album") {
            const route = item.source === "musicbrainz" ? `/albums/preview/${item.id}` : `/albums/${item.id}`;
            router.push(route);
        } else if (item.kind === "artist") {
            const route = item.source === "musicbrainz" ? `/artists/preview/${item.id}` : `/artists/${item.id}`;
            router.push(route);
        } else if (item.kind === "user") {
            router.push(`/u/${item.title}`);
        }
    };

    const handleRecentSearchClick = (search: string) => {
        setQ(search);
    };

    const handleRemoveRecentSearch = (search: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = removeRecentSearch(search);
        setRecentSearches(updated);
    };

    const handleExtendedSearch = () => {
        const filter = activeTab === "users" ? "all" : activeTab;
        setIsOpen(false);
        setQ("");
        router.push(`/search?q=${encodeURIComponent(q)}&filter=${filter}`);
    };

    const canExtendSearch = activeTab !== "users";

    const tabLabels: Record<SearchTab, string> = {
        all: 'Tout',
        albums: 'Albums',
        artists: 'Artistes',
        users: 'Profils',
    };

    return (
        <>
            <div
                onClick={() => setIsOpen(true)}
                className="w-full max-w-2xl mx-auto"
            >
                <div className="bg-background-secondary hover:bg-background-tertiary rounded-[10px] px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors duration-150">
                    <span className={`text-[14px] ${q ? "text-text-primary font-medium" : "text-text-tertiary"}`}>
                        {q ? q : "Rechercher un album, un artiste, ou un profil"}
                    </span>
                </div>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-[#1C1C1C]/20 z-50 flex items-start justify-center pt-0"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="bg-background w-full max-w-2xl rounded-b-[12px] mt-0 max-h-[90vh] overflow-hidden flex flex-col border border-border border-t-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 pt-6 border-b border-border-divider">
                            <div className="flex items-center gap-3 mb-4">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Rechercher un album, un artiste..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    className="flex-1 bg-background-secondary border border-border rounded-[10px] px-3 py-2 text-[16px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
                                />
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-text-tertiary hover:text-text-primary transition-colors duration-150 flex-shrink-0"
                                    title="Fermer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex gap-6 border-b border-border-divider -mx-6 px-6 pb-4">
                                {(["all", "albums", "artists", "users"] as SearchTab[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`text-[14px] font-medium pb-3 border-b-2 transition-colors duration-150 ${
                                            activeTab === tab
                                                ? "text-text-primary border-[#1C1C1C]"
                                                : "text-text-secondary border-transparent hover:text-text-primary"
                                        }`}
                                    >
                                        {tabLabels[tab]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {!q.trim() ? (
                                recentSearches.length > 0 ? (
                                    <div>
                                        <p className="text-[12px] text-text-secondary font-medium mb-3 uppercase tracking-[0.08em]">
                                            Recherches récentes
                                        </p>
                                        <div className="space-y-1">
                                            {recentSearches.map((search, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => handleRecentSearchClick(search)}
                                                    className="flex items-center justify-between p-3 hover:bg-background-secondary rounded-[8px] transition-colors duration-150 cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Clock className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                                                        <span className="text-text-primary text-[14px] truncate">
                                                            {search}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleRemoveRecentSearch(search, e)}
                                                        className="text-text-disabled hover:text-text-primary transition-colors duration-150 flex-shrink-0 ml-2"
                                                        title="Supprimer"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-text-tertiary text-[14px]">Commencez à taper pour rechercher</p>
                                )
                            ) : loading ? (
                                <p className="text-text-tertiary text-[14px]">Chargement...</p>
                            ) : (
                                <>
                                    {/* Internal Results */}
                                    {internalResults.length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-[12px] text-text-secondary font-medium mb-3 uppercase tracking-[0.08em]">
                                                Dans Waveform
                                            </p>
                                            <div className="space-y-1">
                                                {internalResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        className="p-3 hover:bg-background-secondary rounded-[8px] transition-colors duration-150 cursor-pointer"
                                                    >
                                                        <p className="text-text-primary font-medium text-[14px]">{item.title}</p>
                                                        {item.subtitle && (
                                                            <p className="text-text-secondary text-[12px] mt-1">{item.subtitle}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* MusicBrainz Results */}
                                    {mbResults.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[12px] text-text-secondary font-medium mb-3 uppercase tracking-[0.08em]">
                                                Recherche étendue
                                            </p>
                                            <div className="space-y-1">
                                                {mbResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        className="p-3 hover:bg-background-secondary rounded-[8px] transition-colors duration-150 cursor-pointer"
                                                    >
                                                        <p className="text-text-primary font-medium text-[14px]">{item.title}</p>
                                                        {item.subtitle && (
                                                            <p className="text-text-secondary text-[12px] mt-1">{item.subtitle}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Loading MB state */}
                                    {loadingMB && (
                                        <div className="mb-4">
                                            <p className="text-[12px] text-text-tertiary">
                                                {searchTimeout 
                                                    ? "La recherche étendue prend du temps..." 
                                                    : "Recherche étendue en cours..."}
                                            </p>
                                        </div>
                                    )}

                                    {/* Error state */}
                                    {mbError && (
                                        <div className="mb-4">
                                            <p className="text-[12px] text-text-tertiary">
                                                La recherche étendue a échoué. Vérifiez votre connexion.
                                            </p>
                                        </div>
                                    )}

                                    {/* No results */}
                                    {internalResults.length === 0 && mbResults.length === 0 && !loadingMB && (
                                        <p className="text-text-tertiary text-[14px]">Aucun résultat trouvé</p>
                                    )}

                                    {/* Extended search button */}
                                    {showExtendButton && !loadingMB && q.trim() && canExtendSearch && (
                                        <button
                                            onClick={handleExtendedSearch}
                                            className="mt-4 px-4 py-2 bg-transparent text-text-secondary border border-border rounded-[8px] text-[14px] hover:text-text-primary hover:border-[#8E6F5E] transition-colors duration-150"
                                        >
                                            Voir tous les résultats
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

