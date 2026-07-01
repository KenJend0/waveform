"use client";

import Link from "next/link";
import { CoverImage } from "@/components/album/CoverImage";
import AddToListButton from "@/components/lists/AddToListButton";
import AddToDiaryButton from "@/components/album/AddToDiaryButton";
import GenrePills from "@/components/album/GenrePills";
import StreamingLinks from "@/components/album/StreamingLinks";
import { creditParts, type FeaturedCredit } from "@/lib/creditedArtists";

type AlbumHeroProps = {
    album: {
        id: string;
        title: string;
        artist: string;
        artistId?: string;
        coverUrl?: string | null;
        coverFallback?: string | null;
        year?: number | null;
        featuredArtists?: FeaturedCredit[];
    };
    albumId?: string;
    userId?: string;
    userLists?: Array<{ id: string; title: string; is_default: boolean }>;
    listsContaining?: string[];
    myEntriesCount?: number;
    autoOpenDiary?: boolean;
    recSource?: string;
    albumHasGenres?: boolean;
    genres?: string[];
    genreWeights?: Record<string, number>;
    streamingLinks?: { spotify?: string; appleMusic?: string; deezer?: string; tidal?: string };
};

export default function AlbumHero({
    album,
    albumId,
    userId,
    userLists = [],
    listsContaining = [],
    myEntriesCount = 0,
    autoOpenDiary = false,
    recSource,
    albumHasGenres = true,
    genres,
    genreWeights,
    streamingLinks,
}: AlbumHeroProps) {
    const coverPlaceholder = (
        <div className="rounded-[10px] bg-background-secondary aspect-square w-full max-w-48 mx-auto md:mx-0 flex items-center justify-center">
            <span className="text-text-tertiary text-label">Pas de couverture</span>
        </div>
    );

    return (
        <>
            {/* Cover + identité */}
            <div className="flex flex-col md:flex-row md:gap-section-md md:items-start">
                <div className="flex-shrink-0 w-full md:w-48 mb-2 md:mb-0">
                    {album.coverUrl ? (
                        <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0 relative">
                            <CoverImage
                                src={album.coverUrl}
                                fallback={album.coverFallback ?? undefined}
                                alt={album.title}
                                fill
                                className="object-cover"
                                placeholder={coverPlaceholder}
                            />
                        </div>
                    ) : coverPlaceholder}
                </div>

                <div className="flex-1">
                    <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2] mb-2">
                        {album.title}
                    </h1>

                    <div className="text-meta text-text-secondary">
                        {album.featuredArtists && album.featuredArtists.length > 0 ? (
                            creditParts(
                                { id: album.artistId ?? '', name: album.artist },
                                album.featuredArtists
                            ).map((part, i) => (
                                <span key={part.artist.id || i}>
                                    {part.prefix}
                                    {part.artist.id ? (
                                        <Link href={`/artists/${part.artist.id}`} className="border-b border-rule hover:text-accent hover:border-accent transition-colors duration-150">
                                            {part.artist.name}
                                        </Link>
                                    ) : (
                                        <span className="border-b border-rule">{part.artist.name}</span>
                                    )}
                                </span>
                            ))
                        ) : album.artistId ? (
                            <Link href={`/artists/${album.artistId}`} className="border-b border-rule hover:text-accent hover:border-accent transition-colors duration-150">
                                {album.artist}
                            </Link>
                        ) : (
                            <span className="border-b border-rule">{album.artist}</span>
                        )}
                        {album.year && ` · ${album.year}`}
                    </div>

                    {genres !== undefined && (genres.length > 0 || userId) && (
                        <GenrePills
                            genres={genres}
                            albumId={albumId || album.id}
                            userId={genres.length < 3 ? userId : undefined}
                            genreWeights={genreWeights}
                            className="mt-3"
                        />
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
                <AddToDiaryButton
                    albumId={albumId || album.id}
                    userId={userId}
                    initialSaved={listsContaining.some((id) => userLists.find((l) => l.id === id)?.is_default)}
                    defaultListId={userLists.find((l) => l.is_default)?.id}
                    existingEntriesCount={myEntriesCount}
                    autoOpen={autoOpenDiary}
                    source={recSource}
                    albumHasGenres={albumHasGenres}
                />
                <AddToListButton
                    albumId={albumId || album.id}
                    userId={userId}
                    userLists={userLists}
                    initialListsContaining={listsContaining}
                />
            </div>

            {/* Streaming */}
            <div className="mt-5">
                <StreamingLinks albumId={albumId || album.id} initial={streamingLinks ?? {}} showSeparator={false} />
            </div>
        </>
    );
}
