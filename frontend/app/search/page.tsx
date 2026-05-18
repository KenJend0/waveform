// frontend/app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { searchMusicBrainzAlbums, searchMusicBrainzArtists, importAlbumFromMusicBrainz, searchMusicBrainzRecordings, importTrackFromMusicBrainz } from "@/app/actions/musicbrainz";
import { searchInternal, type SearchResultUI } from "@/app/actions/search";
import { computeRank } from "@/lib/searchRanking";
import { getArtistImagesByMbids } from "@/app/actions/artists";
import type { AlbumSearchResult, ArtistSearchResult } from "@/app/actions/musicbrainz";
import { Disc3, User, Music } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";
import BackButton from "@/components/BackButton";
import { showToast } from "@/components/Toast";

import { saveRecentSearch } from '@/lib/recentSearches';

type FilterType = "all" | "albums" | "artists" | "tracks" | "users";

// ---------------------------------------------------------------------------
// Ranking adapters (wrap computeRank for typed MB results)
// ---------------------------------------------------------------------------

function rankAlbums(albums: AlbumSearchResult[], query: string): AlbumSearchResult[] {
  return [...albums].sort((a, b) =>
    computeRank({ id: b.id, title: b.title, subtitle: b.artistName, kind: "album", source: "musicbrainz", score: b.score, releaseCount: b.releaseCount }, query) -
    computeRank({ id: a.id, title: a.title, subtitle: a.artistName, kind: "album", source: "musicbrainz", score: a.score, releaseCount: a.releaseCount }, query)
  );
}

function rankArtists(artists: ArtistSearchResult[], query: string): ArtistSearchResult[] {
  return [...artists].sort((a, b) =>
    computeRank({ id: b.id, title: b.name, subtitle: [b.type, b.country].filter(Boolean).join(" · "), kind: "artist", source: "musicbrainz", score: b.score }, query) -
    computeRank({ id: a.id, title: a.name, subtitle: [a.type, a.country].filter(Boolean).join(" · "), kind: "artist", source: "musicbrainz", score: a.score }, query)
  );
}

// ---------------------------------------------------------------------------
// Reusable components
// ---------------------------------------------------------------------------

function AlbumRow({
  album,
  onImport,
  importing,
  disabled,
}: {
  album: AlbumSearchResult;
  onImport: (id: string) => void;
  importing: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => onImport(album.releaseId || album.id)}
      disabled={disabled}
      className={`group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-150 hover:bg-background-secondary ${
        disabled && !importing ? "opacity-40" : ""
      }`}
    >
      <div className="w-11 h-11 rounded-[6px] bg-background-tertiary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {album.coverUrl ? (
          <CoverImage
            src={album.coverUrl}
            fallback={
              album.releaseId
                ? `https://coverartarchive.org/release/${album.releaseId}/front`
                : undefined
            }
            alt={album.title}
            width={44}
            height={44}
            className="w-full h-full object-cover"
            placeholder={<Disc3 size={16} className="text-text-disabled" />}
          />
        ) : (
          <Disc3 size={16} className="text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {importing ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E] flex-shrink-0" />
            <span className="text-[14px] text-text-secondary">Import en cours…</span>
          </div>
        ) : (
          <>
            <p className="font-medium text-text-primary truncate leading-snug group-hover:text-[#8E6F5E] transition-colors duration-150">
              {album.title}
            </p>
            <p className="text-[13px] text-text-secondary truncate mt-0.5 leading-snug">
              {album.artistName}
              {album.releaseDate && (
                <span className="text-text-disabled"> · {album.releaseDate.substring(0, 4)}</span>
              )}
            </p>
          </>
        )}
      </div>
    </button>
  );
}

function ArtistRow({ artist, imageUrl }: { artist: ArtistSearchResult; imageUrl?: string | null }) {
  return (
    <Link
      href={`/artists/preview/${artist.id}`}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-background-secondary transition-colors duration-150"
    >
      <div className="w-11 h-11 rounded-full bg-background-tertiary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {imageUrl ? (
          <Image src={imageUrl} alt={artist.name} width={44} height={44} className="w-full h-full object-cover" unoptimized />
        ) : (
          <User size={16} className="text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary truncate leading-snug group-hover:text-[#8E6F5E] transition-colors duration-150">
          {artist.name}
        </p>
        {(artist.type || artist.country) && (
          <p className="text-[13px] text-text-secondary truncate mt-0.5 leading-snug">
            {[artist.type, artist.country].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );
}

function UserRow({ user }: { user: SearchResultUI }) {
  return (
    <Link
      href={`/u/${user.slug ?? user.title}`}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-background-secondary transition-colors duration-150"
    >
      <div className="w-11 h-11 rounded-full bg-background-tertiary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {user.coverUrl ? (
          <Image src={user.coverUrl} alt={user.title} width={44} height={44} className="w-full h-full object-cover" unoptimized />
        ) : (
          <User size={16} className="text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary truncate leading-snug group-hover:text-[#8E6F5E] transition-colors duration-150">
          {user.title}
        </p>
        {user.subtitle && (
          <p className="text-[13px] text-text-tertiary truncate mt-0.5 leading-snug">{user.subtitle}</p>
        )}
      </div>
    </Link>
  );
}

function TrackRow({
  track,
  onImport,
  importing,
  disabled,
}: {
  track: SearchResultUI;
  onImport: (track: SearchResultUI) => void;
  importing: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onImport(track)}
      disabled={disabled}
      className={`group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-150 hover:bg-background-secondary ${
        disabled && !importing ? "opacity-40" : ""
      }`}
    >
      <div className="w-11 h-11 rounded-[6px] bg-background-tertiary overflow-hidden flex-shrink-0 flex items-center justify-center">
        {track.coverUrl ? (
          <CoverImage
            src={track.coverUrl}
            alt={track.title}
            width={44}
            height={44}
            className="w-full h-full object-cover"
            placeholder={<Music size={16} className="text-text-disabled" />}
          />
        ) : (
          <Music size={16} className="text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {importing ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E] flex-shrink-0" />
            <span className="text-[14px] text-text-secondary">Import en cours…</span>
          </div>
        ) : (
          <>
            <p className="font-medium text-text-primary truncate leading-snug group-hover:text-[#8E6F5E] transition-colors duration-150">
              {track.title}
            </p>
            {track.subtitle && (
              <p className="text-[13px] text-text-secondary truncate mt-0.5 leading-snug">
                {track.subtitle}
              </p>
            )}
          </>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const filter = (searchParams.get("filter") as FilterType) || "albums";

  const [albums, setAlbums] = useState<AlbumSearchResult[]>([]);
  const [artists, setArtists] = useState<ArtistSearchResult[]>([]);
  const [users, setUsers] = useState<SearchResultUI[]>([]);
  const [tracks, setTracks] = useState<SearchResultUI[]>([]);
  const [allAlbums, setAllAlbums] = useState<AlbumSearchResult[]>([]);
  const [allArtists, setAllArtists] = useState<ArtistSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<SearchResultUI[]>([]);
  const [allTracks, setAllTracks] = useState<SearchResultUI[]>([]);
  const [albumsLimit, setAlbumsLimit] = useState(8);
  const [artistsLimit, setArtistsLimit] = useState(8);
  const [usersLimit, setUsersLimit] = useState(8);
  const [tracksLimit, setTracksLimit] = useState(8);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(false);
  const [artistImages, setArtistImages] = useState<Record<string, string | null>>({});
  const [importingId, setImportingId] = useState<string | null>(null);

  // Save search for the overlay's recent searches list
  useEffect(() => {
    if (q.trim()) saveRecentSearch(q.trim());
  }, [q]);

  // Main search effect
  useEffect(() => {
    if (!q.trim()) {
      setAlbums([]); setArtists([]); setUsers([]); setTracks([]);
      setAllAlbums([]); setAllArtists([]); setAllUsers([]); setAllTracks([]);
      setSearchError(false); setSearchTimeout(false);
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetch = async () => {
      setLoading(true);
      setSearchError(false);
      setSearchTimeout(false);
      setAlbumsLimit(8); setArtistsLimit(8); setUsersLimit(8); setTracksLimit(8);

      timeoutId = setTimeout(() => {
        if (isMounted) setSearchTimeout(true);
      }, 5000);

      try {
        if (filter === "users") {
          const internal = await searchInternal(q, "users");
          if (!isMounted) return;
          const usersRes = internal.filter((r) => r.kind === "user");
          setAllUsers(usersRes);
          setUsers(usersRes.slice(0, 8));
          setAlbums([]); setArtists([]);
          setSearchError(false);
        } else if (filter === "albums") {
          const res = await searchMusicBrainzAlbums(q, 30);
          if (!isMounted) return;
          if (res.success && res.results) {
            const ranked = rankAlbums(res.results, q);
            setAllAlbums(ranked);
            setAlbums(ranked.slice(0, 8));
            setArtists([]); setUsers([]);
            setSearchError(false);
          } else {
            setSearchError(true);
          }
        } else if (filter === "artists") {
          const res = await searchMusicBrainzArtists(q, 30);
          if (!isMounted) return;
          if (res.success && res.results) {
            const ranked = rankArtists(res.results, q);
            setAllArtists(ranked);
            setArtists(ranked.slice(0, 8));
            setAlbums([]); setUsers([]);
            setSearchError(false);
            getArtistImagesByMbids(ranked.map((a) => a.id)).then(setArtistImages);
          } else {
            setSearchError(true);
          }
        } else if (filter === "tracks") {
          const [internalRes, mbRes] = await Promise.all([
            searchInternal(q, "tracks"),
            searchMusicBrainzRecordings(q, 20),
          ]);
          if (!isMounted) return;

          const internalTracks = internalRes.filter((r) => r.kind === "track");
          const mbTracks: SearchResultUI[] = [];
          if (mbRes.success && mbRes.results) {
            const internalKeys = new Set(
              internalTracks.map((r) => {
                const artist = (r.subtitle || "").split(" · ")[0].toLowerCase().trim();
                return `${r.title.toLowerCase().trim()}|||${artist}`;
              })
            );
            mbRes.results.forEach((rec) => {
              const artist = rec.artistName.toLowerCase().trim();
              const key = `${rec.title.toLowerCase().trim()}|||${artist}`;
              if (!internalKeys.has(key)) {
                mbTracks.push({
                  id: rec.mbid,
                  recordingMbid: rec.mbid,
                  releaseId: rec.releaseId,
                  title: rec.title,
                  subtitle: `${rec.artistName} · ${rec.albumTitle}`,
                  kind: "track",
                  coverUrl: rec.coverUrl || null,
                  source: "musicbrainz",
                  score: rec.score,
                });
              }
            });
          }

          const allTracksRes = [...internalTracks, ...mbTracks];
          setAllTracks(allTracksRes);
          setTracks(allTracksRes.slice(0, 8));
          setAlbums([]); setArtists([]); setUsers([]);
          setSearchError(false);
        } else {
          // "all" fallback (direct URL navigation without filter param)
          const [albumsRes, artistsRes, internalRes] = await Promise.all([
            searchMusicBrainzAlbums(q, 30),
            searchMusicBrainzArtists(q, 30),
            searchInternal(q, "users"),
          ]);
          if (!isMounted) return;

          const albumsResults = albumsRes.success && albumsRes.results ? rankAlbums(albumsRes.results, q) : [];
          const artistsResults = artistsRes.success && artistsRes.results ? rankArtists(artistsRes.results, q) : [];
          const usersResults = internalRes.filter((r) => r.kind === "user");

          setAllAlbums(albumsResults);
          setAllArtists(artistsResults);
          setAllUsers(usersResults);
          setAlbums(albumsResults.slice(0, 8));
          setArtists(artistsResults.slice(0, 8));
          setUsers(usersResults.slice(0, 4));
          setSearchError(!albumsRes.success && !artistsRes.success);

          if (artistsResults.length > 0) {
            getArtistImagesByMbids(artistsResults.map((a) => a.id)).then(setArtistImages);
          }
        }
      } catch {
        if (isMounted) {
          setAlbums([]); setArtists([]); setUsers([]);
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

    fetch();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [q, filter]);

  const handleAlbumImport = async (mbid: string) => {
    if (importingId) return;
    setImportingId(mbid);
    try {
      const result = await importAlbumFromMusicBrainz(mbid);
      if (result.success && 'albumId' in result && result.albumId) {
        if ('mbid' in result && result.mbid && 'title' in result && 'artist' in result) {
          fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ albumId: result.albumId, mbid: result.mbid, title: result.title, artist: result.artist }),
          }).catch(() => {});
        }
        router.push(`/albums/${result.albumId}`);
      } else {
        showToast("Erreur lors de l'import", "error");
        setImportingId(null);
      }
    } catch {
      showToast("Erreur lors de l'import", "error");
      setImportingId(null);
    }
  };

  const handleTrackSelect = async (track: SearchResultUI) => {
    if (importingId) return;
    if (track.source === "musicbrainz") {
      setImportingId(track.id);
      try {
        const result = await importTrackFromMusicBrainz(
          track.recordingMbid || track.id,
          track.releaseId || "",
          track.title
        );
        if (result.success && result.trackId) {
          router.push(`/tracks/${result.trackId}`);
        } else {
          showToast("Erreur lors de l'import du titre", "error");
          setImportingId(null);
        }
      } catch {
        showToast("Erreur lors de l'import du titre", "error");
        setImportingId(null);
      }
    } else {
      router.push(`/tracks/${track.id}`);
    }
  };

  const hasResults = albums.length > 0 || artists.length > 0 || users.length > 0 || tracks.length > 0;

  const filterLabel: Record<FilterType, string> = {
    all: "Tout",
    albums: "Albums",
    tracks: "Titres",
    artists: "Artistes",
    users: "Profils",
  };

  return (
    <main className="pb-20 max-w-page mx-auto">
      <div className="px-6 pt-6 pb-0">
        <BackButton className="mb-4 flex items-center gap-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150" />
        {q ? (
          <>
            <h1 className="text-h2 text-text-primary">« {q} »</h1>
            <p className="text-[13px] text-text-tertiary mt-1 mb-6">{filterLabel[filter]}</p>
          </>
        ) : (
          <p className="text-[14px] text-text-tertiary py-12 text-center">
            Utilisez la recherche (Cmd+K) pour trouver des albums, artistes ou profils.
          </p>
        )}
      </div>

      <div className="px-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#8E6F5E]" />
            {searchTimeout && (
              <p className="text-[12px] text-text-tertiary">La recherche prend du temps, merci de patienter…</p>
            )}
          </div>
        )}

        {/* Error */}
        {!loading && searchError && q && (
          <div className="text-center py-16 space-y-2">
            <p className="text-[14px] text-text-tertiary">Une erreur s'est produite lors de la recherche.</p>
            <p className="text-[12px] text-text-disabled">Vérifiez votre connexion et réessayez.</p>
          </div>
        )}

        {/* No results */}
        {!loading && !searchError && q && !hasResults && (
          <div className="text-center py-16 text-[14px] text-text-tertiary">
            Aucun résultat pour{" "}
            <span className="font-medium text-text-primary">« {q} »</span>
          </div>
        )}

        {/* Results */}
        {!loading && !searchError && q && hasResults && (
          <div className="space-y-10">
            {/* Albums */}
            {(filter === "all" || filter === "albums") && albums.length > 0 && (
              <section>
                {filter === "all" && (
                  <h2 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.07em] mb-3">Albums</h2>
                )}
                {filter === "albums" && (
                  <p className="text-[13px] text-text-tertiary mb-3">{allAlbums.length} albums trouvés</p>
                )}
                <div className="space-y-0.5">
                  {albums.map((album) => (
                    <AlbumRow
                      key={album.id}
                      album={album}
                      onImport={handleAlbumImport}
                      importing={importingId === album.id}
                      disabled={!!importingId}
                    />
                  ))}
                </div>
                {allAlbums.length > albumsLimit && (
                  <button
                    onClick={() => { const next = albumsLimit + 8; setAlbumsLimit(next); setAlbums(allAlbums.slice(0, next)); }}
                    className="mt-4 w-full py-2.5 text-[13px] text-text-secondary border border-border rounded-[8px] hover:border-[#8E6F5E] hover:text-text-primary transition-colors duration-150"
                  >
                    Afficher plus ({allAlbums.length - albumsLimit} restants)
                  </button>
                )}
              </section>
            )}

            {/* Artists */}
            {(filter === "all" || filter === "artists") && artists.length > 0 && (
              <section>
                {filter === "all" && (
                  <h2 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.07em] mb-3">Artistes</h2>
                )}
                {filter === "artists" && (
                  <p className="text-[13px] text-text-tertiary mb-3">{allArtists.length} artistes trouvés</p>
                )}
                <div className="space-y-0.5">
                  {artists.map((artist) => (
                    <ArtistRow key={artist.id} artist={artist} imageUrl={artistImages[artist.id]} />
                  ))}
                </div>
                {allArtists.length > artistsLimit && (
                  <button
                    onClick={() => { const next = artistsLimit + 8; setArtistsLimit(next); setArtists(allArtists.slice(0, next)); }}
                    className="mt-4 w-full py-2.5 text-[13px] text-text-secondary border border-border rounded-[8px] hover:border-[#8E6F5E] hover:text-text-primary transition-colors duration-150"
                  >
                    Afficher plus ({allArtists.length - artistsLimit} restants)
                  </button>
                )}
              </section>
            )}

            {/* Tracks */}
            {filter === "tracks" && tracks.length > 0 && (
              <section>
                <p className="text-[13px] text-text-tertiary mb-3">{allTracks.length} titres trouvés</p>
                <div className="space-y-0.5">
                  {tracks.map((track) => (
                    <TrackRow
                      key={`${track.source}-${track.id}`}
                      track={track}
                      onImport={handleTrackSelect}
                      importing={importingId === track.id}
                      disabled={!!importingId}
                    />
                  ))}
                </div>
                {allTracks.length > tracksLimit && (
                  <button
                    onClick={() => { const next = tracksLimit + 8; setTracksLimit(next); setTracks(allTracks.slice(0, next)); }}
                    className="mt-4 w-full py-2.5 text-[13px] text-text-secondary border border-border rounded-[8px] hover:border-[#8E6F5E] hover:text-text-primary transition-colors duration-150"
                  >
                    Afficher plus ({allTracks.length - tracksLimit} restants)
                  </button>
                )}
              </section>
            )}

            {/* Users */}
            {(filter === "all" || filter === "users") && users.length > 0 && (
              <section>
                {filter === "all" && (
                  <h2 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.07em] mb-3">Profils</h2>
                )}
                {filter === "users" && (
                  <p className="text-[13px] text-text-tertiary mb-3">{allUsers.length} profils trouvés</p>
                )}
                <div className="space-y-0.5">
                  {users.map((user) => (
                    <UserRow key={user.id} user={user} />
                  ))}
                </div>
                {allUsers.length > usersLimit && (
                  <button
                    onClick={() => { const next = usersLimit + 8; setUsersLimit(next); setUsers(allUsers.slice(0, next)); }}
                    className="mt-4 w-full py-2.5 text-[13px] text-text-secondary border border-border rounded-[8px] hover:border-[#8E6F5E] hover:text-text-primary transition-colors duration-150"
                  >
                    Afficher plus ({allUsers.length - usersLimit} restants)
                  </button>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}