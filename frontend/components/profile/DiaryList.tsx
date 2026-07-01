"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CoverImage } from "@/components/album/CoverImage";
import type { DiaryEntryUI, DiarySort } from "@/app/actions/diary";
import { getUserDiary } from "@/app/actions/diary";
import type { TrackDiaryEntryUI, TrackDiarySort } from "@/app/actions/track-diary";
import { getUserTrackDiary } from "@/app/actions/track-diary";
import { useRatingFilter } from "./RatingFilterContext";

type AlbumSort = DiarySort;
type TrackSort = TrackDiarySort;
type MediaFilter = "albums" | "titres";

const ALBUM_SORT_LABELS = (ratingLabel: string): Record<AlbumSort, string> => ({
  date_listened: "Date d'écoute",
  release_date: "Date de parution",
  personal_rating: ratingLabel,
});

const TRACK_SORT_LABELS = (ratingLabel: string): Record<TrackSort, string> => ({
  date_listened: "Date d'écoute",
  personal_rating: ratingLabel,
});

const PAGE_SIZE = 51;
// Quand un filtre par note est actif, on récupère tout en une seule requête
// (pas de pagination) — le nombre d'entrées partageant une note exacte reste
// toujours raisonnable, même pour un très gros journal.
const MAX_FILTERED_RESULTS = 1000;

function sortAlbums(list: DiaryEntryUI[], sort: AlbumSort): DiaryEntryUI[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case "personal_rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "release_date": {
        const dA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dB - dA;
      }
      default: {
        const diff = new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
        return diff !== 0 ? diff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    }
  });
}

function sortTracks(list: TrackDiaryEntryUI[], sort: TrackSort): TrackDiaryEntryUI[] {
  return [...list].sort((a, b) => {
    if (sort === "personal_rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.listened_at).getTime() - new Date(a.listened_at).getTime();
  });
}

type Props = {
  entries: DiaryEntryUI[];
  isMe: boolean;
  trackEntries?: TrackDiaryEntryUI[];
  userId?: string;
  ratingLabel?: string;
};

export default function DiaryList({ entries, isMe, trackEntries, userId, ratingLabel = "Ma note" }: Props) {
  const showToggle = trackEntries !== undefined;
  const defaultMedia: MediaFilter = entries.length === 0 && (trackEntries?.length ?? 0) > 0 ? "titres" : "albums";
  const [media, setMedia] = useState<MediaFilter>(defaultMedia);

  // Album state (pagination normale, hors filtre)
  const [albumEntries, setAlbumEntries] = useState<DiaryEntryUI[]>(entries);
  const [albumHasMore, setAlbumHasMore] = useState(entries.length === PAGE_SIZE);
  const [albumLoadingMore, setAlbumLoadingMore] = useState(false);
  const [albumSort, setAlbumSort] = useState<AlbumSort>("date_listened");

  // Track state (pagination normale, hors filtre)
  const [trackList, setTrackList] = useState<TrackDiaryEntryUI[]>(trackEntries ?? []);
  const [trackHasMore, setTrackHasMore] = useState((trackEntries?.length ?? 0) === PAGE_SIZE);
  const [trackLoadingMore, setTrackLoadingMore] = useState(false);
  const [trackSort, setTrackSort] = useState<TrackSort>("date_listened");

  // Shared sort dropdown
  const [sortOpen, setSortOpen] = useState(false);

  // Filtre par note, piloté par l'histogramme dans la sidebar. La note 0..9
  // du contexte correspond à la note réelle (selectedRating + 1).
  const { selectedRating, selectedCount } = useRatingFilter();
  const ratingFilter = selectedRating !== null ? selectedRating + 1 : null;

  // Résultat complet du filtre — récupéré en une seule requête (pas de
  // pagination par 51), avec un affichage optimiste instantané dès le clic
  // sur l'histogramme (on filtre ce qui est déjà chargé en attendant la
  // réponse serveur, qui peut révéler des entrées non encore chargées).
  const [filteredAlbums, setFilteredAlbums] = useState<DiaryEntryUI[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<TrackDiaryEntryUI[]>([]);
  const [albumFilterLoading, setAlbumFilterLoading] = useState(false);
  const [trackFilterLoading, setTrackFilterLoading] = useState(false);
  const filterRequestRef = useRef(0);

  useEffect(() => {
    if (ratingFilter === null) {
      setAlbumFilterLoading(false);
      setTrackFilterLoading(false);
      return;
    }

    const optimisticAlbums = albumEntries.filter((e) => e.rating === ratingFilter);
    const optimisticTracks = trackList.filter((e) => e.rating === ratingFilter);
    setFilteredAlbums(optimisticAlbums);
    setFilteredTracks(optimisticTracks);

    // L'histogramme connaît le total exact d'albums pour cette note — si ce
    // qu'on a déjà chargé en contient déjà autant, le filtre est exhaustif,
    // pas besoin d'aller chercher plus loin. Pour les titres, pas de total
    // connu : on se base sur le fait que tout le journal a déjà été chargé.
    const albumsComplete = selectedCount !== null ? optimisticAlbums.length >= selectedCount : !albumHasMore;
    const tracksComplete = !trackHasMore;

    if (albumsComplete && tracksComplete) return;
    if (!userId) return;

    const requestId = ++filterRequestRef.current;
    if (!albumsComplete) setAlbumFilterLoading(true);
    if (!tracksComplete) setTrackFilterLoading(true);

    (async () => {
      const [albums, tracks] = await Promise.all([
        albumsComplete ? Promise.resolve(optimisticAlbums) : getUserDiary(userId, 0, MAX_FILTERED_RESULTS, "date_listened", ratingFilter),
        tracksComplete ? Promise.resolve(optimisticTracks) : getUserTrackDiary(userId, 0, MAX_FILTERED_RESULTS, "date_listened", ratingFilter),
      ]);
      if (filterRequestRef.current !== requestId) return; // une autre note a été sélectionnée depuis
      setFilteredAlbums(albums);
      setFilteredTracks(tracks);
      setAlbumFilterLoading(false);
      setTrackFilterLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter, selectedCount, userId]);

  const loadMoreAlbums = async () => {
    if (!userId) return;
    setAlbumLoadingMore(true);
    const more = await getUserDiary(userId, albumEntries.length, PAGE_SIZE, albumSort);
    setAlbumEntries((prev) => [...prev, ...more]);
    setAlbumHasMore(more.length === PAGE_SIZE);
    setAlbumLoadingMore(false);
  };

  const loadMoreTracks = async () => {
    if (!userId) return;
    setTrackLoadingMore(true);
    const more = await getUserTrackDiary(userId, trackList.length, PAGE_SIZE, trackSort);
    setTrackList((prev) => [...prev, ...more]);
    setTrackHasMore(more.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  // Le tri se fait côté serveur (sinon il ne porte que sur les entrées déjà
  // chargées, ce qui donne un classement faux pour les journaux > PAGE_SIZE).
  // Si un filtre est actif, l'ensemble filtré est déjà complet : un tri
  // client suffit, pas besoin de retourner au serveur.
  const changeAlbumSort = async (next: AlbumSort) => {
    setAlbumSort(next);
    setSortOpen(false);
    if (ratingFilter !== null || !userId) return;
    setAlbumLoadingMore(true);
    const fresh = await getUserDiary(userId, 0, PAGE_SIZE, next);
    setAlbumEntries(fresh);
    setAlbumHasMore(fresh.length === PAGE_SIZE);
    setAlbumLoadingMore(false);
  };

  const changeTrackSort = async (next: TrackSort) => {
    setTrackSort(next);
    setSortOpen(false);
    if (ratingFilter !== null || !userId) return;
    setTrackLoadingMore(true);
    const fresh = await getUserTrackDiary(userId, 0, PAGE_SIZE, next);
    setTrackList(fresh);
    setTrackHasMore(fresh.length === PAGE_SIZE);
    setTrackLoadingMore(false);
  };

  const sortedAlbums = ratingFilter !== null ? sortAlbums(filteredAlbums, albumSort) : albumEntries;
  const sortedTracks = ratingFilter !== null ? sortTracks(filteredTracks, trackSort) : trackList;

  const albumSortLabels = ALBUM_SORT_LABELS(ratingLabel);
  const trackSortLabels = TRACK_SORT_LABELS(ratingLabel);
  const currentSortLabel = media === "albums" ? albumSortLabels[albumSort] : trackSortLabels[trackSort];

  return (
    <div>
      {/* Toolbar: sort left, media toggle right */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative inline-block">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="text-label text-text-tertiary hover:text-text-primary transition-colors duration-150 flex items-center gap-1"
          >
            Trié par: <span className="font-medium text-text-primary">{currentSortLabel}</span>
            <span className="text-[10px]">▾</span>
          </button>
          {sortOpen && (
            <div className="absolute top-full mt-2 bg-background border border-border rounded-button z-10 min-w-max">
              {media === "albums"
                ? (Object.entries(albumSortLabels) as [AlbumSort, string][]).map(([opt, label]) => (
                    <button
                      key={opt}
                      onClick={() => changeAlbumSort(opt)}
                      className={`w-full text-left px-3 py-2 text-label transition-colors duration-150 ${
                        albumSort === opt ? "bg-background-secondary text-text-primary font-medium" : "text-text-tertiary hover:bg-background-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))
                : (Object.entries(trackSortLabels) as [TrackSort, string][]).map(([opt, label]) => (
                    <button
                      key={opt}
                      onClick={() => changeTrackSort(opt)}
                      className={`w-full text-left px-3 py-2 text-label transition-colors duration-150 ${
                        trackSort === opt ? "bg-background-secondary text-text-primary font-medium" : "text-text-tertiary hover:bg-background-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))
              }
            </div>
          )}
        </div>

        {showToggle && (
          <div className="flex items-center gap-1 text-label">
            <button
              onClick={() => { setMedia("albums"); setSortOpen(false); }}
              className={`transition-colors duration-150 ${
                media === "albums" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Albums
            </button>
            <span className="text-text-disabled select-none">·</span>
            <button
              onClick={() => { setMedia("titres"); setSortOpen(false); }}
              className={`transition-colors duration-150 ${
                media === "titres" ? "font-medium text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Titres
            </button>
          </div>
        )}
      </div>

      {((media === "albums" && albumFilterLoading) || (media === "titres" && trackFilterLoading)) && (
        <div className="mb-4 text-label text-text-tertiary animate-pulse">
          Recherche d'autres résultats…
        </div>
      )}

      {/* Albums */}
      {media === "albums" && (
        sortedAlbums.length === 0 ? (
          // L'histogramme sait qu'il y a des albums avec cette note (selectedCount > 0)
          // mais le filtre optimiste n'en a pas encore trouvé : la recherche serveur est
          // en cours, pas la peine d'afficher "aucune entrée" entre-temps.
          ratingFilter !== null && selectedCount !== null && selectedCount > 0 ? null : (
          <div className="text-center text-text-tertiary py-12">
            {ratingFilter !== null ? "Aucune entrée avec cette note" : "Aucune entrée dans le journal"}
          </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
              {sortedAlbums.map((entry) => (
                <div key={entry.id} className="flex flex-col">
                  <Link
                    href={`/diary/${entry.id}`}
                    className="group relative block aspect-square rounded-cover overflow-hidden"
                  >
                    {entry.cover_url ? (
                      <CoverImage
                        src={entry.cover_url}
                        alt={entry.album_title}
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                      />
                    ) : (
                      <div className="w-full h-full bg-background-tertiary" />
                    )}
                    {entry.rating && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-baseline gap-0.5 bg-paper-hi/90 border border-accent rounded-badge-sm px-1.5 py-0.5 text-accent font-display italic text-[13px] leading-none backdrop-blur-sm">
                        {Math.round(entry.rating)}
                        <span className="font-sans not-italic text-[8px] tracking-[0.14em] uppercase opacity-70">/10</span>
                      </span>
                    )}
                  </Link>
                  <div className="mt-2">
                    <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug">{entry.album_title}</p>
                    <p className="text-label text-text-tertiary truncate mt-0.5">{entry.artist_name}</p>
                  </div>
                </div>
              ))}
            </div>
            {ratingFilter === null && albumHasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMoreAlbums}
                  disabled={albumLoadingMore}
                  className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                >
                  {albumLoadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* Titres */}
      {media === "titres" && (
        sortedTracks.length === 0 ? (
          <div className="text-center text-text-tertiary py-12">
            {ratingFilter !== null ? "Aucun titre avec cette note" : "Aucun titre noté pour le moment"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
              {sortedTracks.map((entry) => (
                <Link key={entry.id} href={`/track-diary/${entry.id}`} className="group">
                  <div className="aspect-square rounded-cover overflow-hidden bg-background-secondary relative">
                    {entry.cover_url ? (
                      <Image src={entry.cover_url} alt={entry.track_title} fill className="object-cover" sizes="128px" unoptimized />
                    ) : (
                      <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                        <span className="text-text-disabled text-[20px]">♪</span>
                      </div>
                    )}
                    {entry.rating !== null && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-baseline gap-0.5 bg-paper-hi/90 border border-accent rounded-badge-sm px-1.5 py-0.5 text-accent font-display italic text-[13px] leading-none backdrop-blur-sm">
                        {Math.round(entry.rating)}
                        <span className="font-sans not-italic text-[8px] tracking-[0.14em] uppercase opacity-70">/10</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug">{entry.track_title}</p>
                    <p className="text-label text-text-tertiary truncate mt-0.5">{entry.artist_name}</p>
                  </div>
                </Link>
              ))}
            </div>
            {ratingFilter === null && trackHasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMoreTracks}
                  disabled={trackLoadingMore}
                  className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
                >
                  {trackLoadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
