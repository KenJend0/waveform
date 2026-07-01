"use client";

import { useState } from "react";
import Link from "next/link";
import { type ForYouAlbum, type ForYouTrack, dismissRecommendation, dismissTrackRecommendation } from "@/app/actions/explore";
import { CoverImage } from "@/components/album/CoverImage";

function AlbumCard({ album, onDismiss, onDismissFailed }: { album: ForYouAlbum; onDismiss: (albumId: string) => void; onDismissFailed: (albumId: string) => void }) {
    async function handleDismiss(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onDismiss(album.album_id);
        try {
            const { success } = await dismissRecommendation(album.album_id);
            if (!success) onDismissFailed(album.album_id);
        } catch {
            onDismissFailed(album.album_id);
        }
    }

    return (
        <Link href={`/albums/${album.album_id}?source=for_you`} className="block group">
            <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-2 aspect-square relative">
                {album.cover_url ? (
                    <CoverImage
                        src={album.cover_url}
                        alt={album.title}
                        fill
                        className="object-cover"
                        placeholder={<div className="w-full h-full bg-background-tertiary" />}
                    />
                ) : (
                    <div className="w-full h-full bg-background-tertiary" />
                )}
                <button
                    onClick={handleDismiss}
                    title="Pas pour moi"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-text-primary/45 text-background flex items-center justify-center text-sm leading-none hover:bg-text-primary/70 transition-colors duration-150"
                >
                    ×
                </button>
            </div>
            <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                {album.title}
            </p>
            <p className="text-label text-text-tertiary truncate mt-0.5">
                {album.artist}
            </p>
        </Link>
    );
}

function TrackCard({ track, onDismiss, onDismissFailed }: { track: ForYouTrack; onDismiss: (trackId: string) => void; onDismissFailed: (trackId: string) => void }) {
    async function handleDismiss(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onDismiss(track.track_id);
        try {
            const { success } = await dismissTrackRecommendation(track.track_id);
            if (!success) onDismissFailed(track.track_id);
        } catch {
            onDismissFailed(track.track_id);
        }
    }

    return (
        <Link href={`/tracks/${track.track_id}?source=for_you`} className="block group">
            <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-2 aspect-square relative">
                {track.cover_url ? (
                    <CoverImage
                        src={track.cover_url}
                        alt={track.track_title}
                        fill
                        className="object-cover"
                        placeholder={
                            <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                                <span className="text-text-disabled text-2xl">♪</span>
                            </div>
                        }
                    />
                ) : (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                        <span className="text-text-disabled text-2xl">♪</span>
                    </div>
                )}
                <button
                    onClick={handleDismiss}
                    title="Pas pour moi"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-text-primary/45 text-background flex items-center justify-center text-sm leading-none hover:bg-text-primary/70 transition-colors duration-150"
                >
                    ×
                </button>
            </div>
            <p className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                {track.track_title}
            </p>
            <p className="text-label text-text-tertiary truncate mt-0.5">
                {track.artist}
            </p>
        </Link>
    );
}

type Props = {
    albums: ForYouAlbum[];
    tracks: ForYouTrack[];
};

export default function PourToiSection({ albums, tracks }: Props) {
    const [tab, setTab] = useState<"albums" | "titres">("albums");
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [dismissedTrackIds, setDismissedTrackIds] = useState<Set<string>>(new Set());

    const visibleAlbums = albums.filter((a) => !dismissedIds.has(a.album_id)).slice(0, 3);
    const allDismissed = albums.length > 0 && visibleAlbums.length === 0;

    const visibleTracks = tracks.filter((t) => !dismissedTrackIds.has(t.track_id)).slice(0, 3);
    const allTracksDismissed = tracks.length > 0 && visibleTracks.length === 0;

    function handleDismiss(albumId: string) {
        setDismissedIds((prev) => new Set(prev).add(albumId));
    }

    function handleDismissFailed(albumId: string) {
        setDismissedIds((prev) => {
            const next = new Set(prev);
            next.delete(albumId);
            return next;
        });
    }

    function handleDismissTrack(trackId: string) {
        setDismissedTrackIds((prev) => new Set(prev).add(trackId));
    }

    function handleDismissTrackFailed(trackId: string) {
        setDismissedTrackIds((prev) => {
            const next = new Set(prev);
            next.delete(trackId);
            return next;
        });
    }

    return (
        <section>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h2 className="text-h2 text-text-primary">
                        Pour <em className="italic text-accent-deep">toi</em>
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Reviens demain pour une nouvelle sélection.
                    </p>
                </div>
            </div>

            <div className="flex gap-1.5 mb-5">
                {(["albums", "titres"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-3 py-1 rounded-full text-label font-medium transition-colors ${
                            tab === t
                                ? "bg-text-primary text-background"
                                : "bg-background-secondary text-text-secondary hover:text-text-primary"
                        }`}
                    >
                        {t === "albums" ? "Albums" : "Titres"}
                    </button>
                ))}
            </div>

            {tab === "albums" && (
                visibleAlbums.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 lg:gap-4">
                        {visibleAlbums.map((album) => (
                            <AlbumCard key={album.album_id} album={album} onDismiss={handleDismiss} onDismissFailed={handleDismissFailed} />
                        ))}
                    </div>
                ) : allDismissed ? (
                    <p className="text-text-tertiary text-meta">Tu as écarté toutes les suggestions du jour. Reviens demain pour une nouvelle sélection.</p>
                ) : (
                    <p className="text-text-tertiary text-meta">Pas encore de recommandations.</p>
                )
            )}

            {tab === "titres" && (
                visibleTracks.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 lg:gap-4">
                        {visibleTracks.map((track) => (
                            <TrackCard key={track.track_id} track={track} onDismiss={handleDismissTrack} onDismissFailed={handleDismissTrackFailed} />
                        ))}
                    </div>
                ) : allTracksDismissed ? (
                    <p className="text-text-tertiary text-meta">Tu as écarté toutes les suggestions du jour. Reviens demain pour une nouvelle sélection.</p>
                ) : (
                    <p className="text-text-tertiary text-meta">Pas encore de recommandations.</p>
                )
            )}
        </section>
    );
}
