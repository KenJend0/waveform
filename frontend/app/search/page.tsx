// frontend/app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists } from "@/app/actions/musicbrainz";
import { getArtistImagesByMbids } from "@/app/actions/artists";
import type { AlbumSearchResult, ArtistSearchResult } from "@/app/actions/musicbrainz";
import { Disc3, User, Search, Clock, X } from "lucide-react";
import BackButton from "@/components/BackButton";

type SortOption = "relevance" | "date-new" | "date-old" | "alphabetical";
type FilterType = "all" | "albums" | "artists";

import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '@/lib/recentSearches';

export default function SearchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const q = searchParams.get("q") || "";
    const filter = (searchParams.get("filter") as FilterType) || "all";

    const [searchInput, setSearchInput] = useState(q);
    const [albums, setAlbums] = useState<AlbumSearchResult[]>([]);
    const [artists, setArtists] = useState<ArtistSearchResult[]>([]);
    const [allAlbums, setAllAlbums] = useState<AlbumSearchResult[]>([]);
    const [allArtists, setAllArtists] = useState<ArtistSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>("relevance");
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [albumsLimit, setAlbumsLimit] = useState(6);
    const [artistsLimit, setArtistsLimit] = useState(6);
    const [searchError, setSearchError] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(false);
    const [artistImages, setArtistImages] = useState<Record<string, string | null>>({});

    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches());
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setSortDropdownOpen(false);
        if (sortDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [sortDropdownOpen]);

    // Save search when query changes
    useEffect(() => {
        if (q.trim()) {
            saveRecentSearch(q.trim());
            setRecentSearches(getRecentSearches());
        }
    }, [q]);

    // Sync search input with URL query
    useEffect(() => {
        setSearchInput(q);
    }, [q]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchInput.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchInput.trim())}&filter=${filter}`);
        }
    };

    const handleRecentSearchClick = (query: string) => {
        router.push(`/search?q=${encodeURIComponent(query)}&filter=${filter}`);
    };

    const handleRemoveRecentSearch = (e: React.MouseEvent, query: string) => {
        e.stopPropagation();
        const updated = removeRecentSearch(query);
        setRecentSearches(updated);
    };

    const handleClearAllRecent = () => {
        clearRecentSearches();
        setRecentSearches([]);
    };

    useEffect(() => {
        if (!q.trim()) {
            setAlbums([]);
            setArtists([]);
            setSearchError(false);
            setSearchTimeout(false);
            return;
        }

        let isMounted = true;
        let timeoutId: NodeJS.Timeout;
        const currentQuery = q;
        const currentFilter = filter;

        const fetchResults = async () => {
            setLoading(true);
            setSearchError(false);
            setSearchTimeout(false);

            // Start timeout warning after 5 seconds
            timeoutId = setTimeout(() => {
                if (isMounted) {
                    setSearchTimeout(true);
                }
            }, 5000);

            try {
                if (currentFilter === "albums") {
                    const response = await searchMusicBrainzAlbums(currentQuery, 30);
                    if (isMounted && q === currentQuery && filter === currentFilter) {
                        if (response.success && response.results) {
                            setAllAlbums(response.results);
                            setAlbums(response.results.slice(0, 6));
                            setAlbumsLimit(6);
                            setArtists([]);
                            setSearchError(false);
                        } else {
                            setSearchError(true);
                        }
                    }
                } else if (currentFilter === "artists") {
                    const response = await searchMusicBrainzArtists(currentQuery, 30);
                    if (isMounted && q === currentQuery && filter === currentFilter) {
                        if (response.success && response.results) {
                            setAllArtists(response.results);
                            setArtists(response.results.slice(0, 6));
                            setArtistsLimit(6);
                            setAlbums([]);
                            setSearchError(false);
                            getArtistImagesByMbids(response.results.map(a => a.id)).then(setArtistImages);
                        } else {
                            setSearchError(true);
                        }
                    }
                } else {
                    const [albumsRes, artistsRes] = await Promise.all([
                        searchMusicBrainzAlbums(currentQuery, 30),
                        searchMusicBrainzArtists(currentQuery, 30),
                    ]);
                    if (isMounted && q === currentQuery && filter === currentFilter) {
                        const albumsResults = albumsRes.success && albumsRes.results ? albumsRes.results : [];
                        const artistsResults = artistsRes.success && artistsRes.results ? artistsRes.results : [];
                        setAllAlbums(albumsResults);
                        setAllArtists(artistsResults);
                        setAlbums(albumsResults.slice(0, 6));
                        setArtists(artistsResults.slice(0, 6));
                        setAlbumsLimit(6);
                        setArtistsLimit(6);
                        setSearchError(!albumsRes.success && !artistsRes.success);
                        if (artistsResults.length > 0) {
                            getArtistImagesByMbids(artistsResults.map(a => a.id)).then(setArtistImages);
                        }
                    }
                }
            } catch (err) {
                console.error("Search error:", err);
                if (isMounted) {
                    setAlbums([]);
                    setArtists([]);
                    setSearchError(true);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setSearchTimeout(false);
                    clearTimeout(timeoutId);
                }
            }
        };

        fetchResults();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [q, filter]);

    const handleShowMoreAlbums = () => {
        const newLimit = albumsLimit + 6;
        setAlbumsLimit(newLimit);
        setAlbums(allAlbums.slice(0, newLimit));
    };

    const handleShowMoreArtists = () => {
        const newLimit = artistsLimit + 6;
        setArtistsLimit(newLimit);
        setArtists(allArtists.slice(0, newLimit));
    };

    const sortedAlbums = [...albums].sort((a, b) => {
        switch (sortBy) {
            case "date-new":
                return (b.releaseDate || "").localeCompare(a.releaseDate || "");
            case "date-old":
                return (a.releaseDate || "").localeCompare(b.releaseDate || "");
            case "alphabetical":
                return a.title.localeCompare(b.title);
            case "relevance":
            default:
                return 0;
        }
    });

    const sortedArtists = [...artists].sort((a, b) => {
        if (sortBy === "alphabetical") {
            return a.name.localeCompare(b.name);
        }
        return 0;
    });

    const getFilterTitle = () => {
        if (filter === "albums") return "Albums";
        if (filter === "artists") return "Artistes";
        return "Résultats";
    };

    const hasResults = albums.length > 0 || artists.length > 0;

    // Sort dropdown component (reused in both album sections)
    const SortDropdown = () => (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setSortDropdownOpen(!sortDropdownOpen); }}
                className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
            >
                Trié par: <span className="font-medium text-text-primary">
                    {sortBy === "relevance" && "Pertinence"}
                    {sortBy === "date-new" && "Plus récents"}
                    {sortBy === "date-old" && "Plus anciens"}
                    {sortBy === "alphabetical" && "Alphabétique"}
                </span>
                <span className="text-[10px]">▾</span>
            </button>

            {sortDropdownOpen && (
                <div
                    className="absolute top-full right-0 mt-2 bg-background border border-border rounded-[8px] z-10 min-w-max"
                    onClick={(e) => e.stopPropagation()}
                >
                    {[
                        { value: "relevance" as SortOption, label: "Pertinence" },
                        { value: "date-new" as SortOption, label: "Plus récents" },
                        { value: "date-old" as SortOption, label: "Plus anciens" },
                        { value: "alphabetical" as SortOption, label: "Alphabétique" },
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => { setSortBy(value); setSortDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-150 ${
                                sortBy === value
                                    ? "bg-background-secondary text-text-primary font-medium"
                                    : "text-text-tertiary hover:bg-background-secondary"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <main className="p-6 pb-20 max-w-page mx-auto">
            {/* Header with back button and title */}
            <div className="mb-6">
                <BackButton className="mb-4 flex items-center gap-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150" />
                <h1 className="text-h2 text-text-primary">
                    {q ? `Résultats pour « ${q} »` : `Recherche ${getFilterTitle()}`}
                </h1>
            </div>

            {/* Search input */}
            <form onSubmit={handleSearch} className="mb-6">
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Rechercher un album, un artiste…"
                        className="w-full bg-background-secondary border border-border rounded-[10px] pl-11 pr-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150"
                    />
                </div>
            </form>

            {loading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8E6F5E]"></div>
                    {searchTimeout && (
                        <p className="text-[12px] text-text-tertiary">
                            La recherche prend du temps, merci de patienter...
                        </p>
                    )}
                </div>
            )}

            {!loading && searchError && q && (
                <div className="text-center py-12 space-y-3">
                    <p className="text-[14px] text-text-tertiary">
                        Une erreur s'est produite lors de la recherche.
                    </p>
                    <p className="text-[12px] text-text-tertiary">
                        Vérifiez votre connexion internet et réessayez.
                    </p>
                </div>
            )}

            {!loading && !searchError && q && !hasResults && (
                <div className="text-center text-text-tertiary py-12 text-[14px]">
                    Aucun résultat trouvé pour <span className="font-medium text-text-primary">« {q} »</span>
                </div>
            )}

            {!loading && !searchError && q && hasResults && (
                <div className="space-y-10">
                    {/* Albums Section */}
                    {(filter === "all" || filter === "albums") && albums.length > 0 && (
                        <section className="mb-12">
                            <div className="flex items-center justify-between gap-2 mb-6 pb-2 border-b border-border-divider">
                                <div className="flex items-center gap-2">
                                    {filter === "all" ? (
                                        <>    
                                            <h2 className="text-[16px] font-medium text-text-primary">Albums</h2>
                                        </>
                                    ) : (
                                        <span className="text-[14px] text-text-tertiary">{allAlbums.length} albums trouvés</span>
                                    )}
                                </div>
                                <SortDropdown />
                            </div>
                            <div className="space-y-1">
                                {sortedAlbums.map((album) => (
                                    <Link
                                        key={album.id}
                                        href={`/albums/preview/${album.id}`}
                                        className="group block p-4 hover:bg-background-secondary rounded-[10px] transition-colors duration-150"
                                    >
                                        <div className="flex items-start gap-4">
                                            {album.coverUrl && (
                                                <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-background-tertiary flex-shrink-0">
                                                    <Image
                                                        src={album.coverUrl}
                                                        alt={album.title}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-text-primary truncate group-hover:text-[#8E6F5E] transition-colors duration-150">
                                                    {album.title}
                                                </h3>
                                                <p className="text-[14px] text-text-secondary truncate">
                                                    {album.artistName}
                                                    {album.releaseDate && (
                                                        <span className="text-text-tertiary"> - {album.releaseDate.substring(0, 4)}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            {allAlbums.length > albumsLimit && (
                                <div className="mt-6 text-center">
                                    <button
                                        onClick={handleShowMoreAlbums}
                                        className="px-6 py-2 text-text-secondary border border-border rounded-[8px] hover:text-text-primary hover:border-[#8E6F5E] transition-colors duration-150 text-[14px]"
                                    >
                                        Afficher plus de résultats ({allAlbums.length - albumsLimit} restants)
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Artists Section */}
                    {(filter === "all" || filter === "artists") && artists.length > 0 && (
                        <section>
                            {filter === "all" && (
                                <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border-divider">
                                    <h2 className="text-[16px] font-medium text-text-primary">Artistes</h2>
                                </div>
                            )}
                            <div className="space-y-1">
                                {sortedArtists.map((artist) => {
                                    const img = artistImages[artist.id];
                                    return (
                                    <Link
                                        key={artist.id}
                                        href={`/artists/preview/${artist.id}`}
                                        className="group block p-4 hover:bg-background-secondary rounded-[10px] transition-colors duration-150"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-background-tertiary flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {img ? (
                                                    <img
                                                        src={img}
                                                        alt={artist.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <User size={20} className="text-text-tertiary" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-text-primary truncate group-hover:text-[#8E6F5E] transition-colors duration-150">
                                                    {artist.name}
                                                </h3>
                                                {(artist.type || artist.country) && (
                                                    <p className="text-[14px] text-text-secondary">
                                                        {[artist.type, artist.country].filter(Boolean).join(" · ")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    );
                                })}
                            </div>
                            {allArtists.length > artistsLimit && (
                                <div className="mt-6 text-center">
                                    <button
                                        onClick={handleShowMoreArtists}
                                        className="px-6 py-2 text-text-secondary border border-border rounded-[8px] hover:text-text-primary hover:border-[#8E6F5E] transition-colors duration-150 text-[14px]"
                                    >
                                        Afficher plus de résultats ({allArtists.length - artistsLimit} restants)
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}

            {/* Recent searches when no query */}
            {!q && (
                <div className="py-4">
                    {recentSearches.length > 0 ? (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-h2 text-text-secondary">Recherches récentes</h2>
                                <button
                                    onClick={handleClearAllRecent}
                                    className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                >
                                    Tout effacer
                                </button>
                            </div>
                            <div className="space-y-2">
                                {recentSearches.map((search) => (
                                    <div
                                        key={search}
                                        onClick={() => handleRecentSearchClick(search)}
                                        className="flex items-center justify-between p-3 bg-background-secondary hover:bg-background-tertiary rounded-[10px] cursor-pointer transition-colors duration-150 group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Clock size={16} className="text-text-tertiary" />
                                            <span className="text-text-primary text-[14px]">{search}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveRecentSearch(e, search)}
                                            className="p-1 text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-text-tertiary py-8 text-[14px]">
                            Saisissez un terme de recherche pour trouver des albums et artistes
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}

