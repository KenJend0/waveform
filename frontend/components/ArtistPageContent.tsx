'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { importAlbumFromMusicBrainz } from '@/app/actions/musicbrainz';
import { showToast } from '@/components/Toast';
import NetworkListenersBottomSheet from '@/components/NetworkListenersBottomSheet';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';

type Album = {
    id: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
    mbid?: string | null;
    track_count: number;
    avg_rating?: number | null;
    reviews_count?: number;
    listeners_count?: number;
};

type Artist = {
    id: string;
    name: string;
    mbid: string | null;
};

type MBRelease = {
    mbid: string;
    releaseGroupMbid: string;
    title: string;
    date?: string | null;
    type?: string | null;
};

type NetworkListener = {
    userId: string;
    username: string;
    avatarUrl: string | null;
    rating?: number | null;
    listenedAt?: string | null;
    entryId?: string | null;
    hasReview?: boolean;
};

type SimilarArtist = {
    id: string | null;
    name: string;
    imageUrl: string | null;
    mbid?: string | null;
};

type DiscographyItem = {
    title: string;
    date?: string | null;
    cover?: string | null;
    coverFromArchive?: boolean;
    releaseGroupMbid?: string;
    href: string;
    inDatabase: boolean;
    avgRating?: number | null;
    reviewsCount?: number;
    listenersCount?: number;
    mbid?: string;
    releaseType?: 'Album' | 'EP' | 'Single' | null;
};

type ArtistPageContentProps = {
    artist?: Artist;
    albums?: Album[];
    previewName?: string;
    previewMbid?: string;
    previewCountry?: string;
    previewType?: string;
    imageUrl?: string | null;
    mbReleases?: MBRelease[];
    artistStats?: {
        totalListeners: number;
        globalAvgRating: number | null;
        totalReviews: number;
    };
    networkListeners?: NetworkListener[];
    similarArtists?: SimilarArtist[];
    userId?: string;
};

export function ArtistPageContent({
    artist,
    albums = [],
    previewName,
    previewMbid,
    previewCountry,
    previewType,
    imageUrl,
    mbReleases = [],
    artistStats,
    networkListeners = [],
    similarArtists = [],
    userId,
}: ArtistPageContentProps) {
    const router = useRouter();
    const [importingMbid, setImportingMbid] = useState<string | null>(null);
    const [isNetworkOpen, setIsNetworkOpen] = useState(false);

    const isPreviewMode = !artist && previewMbid;
    const artistName = artist?.name || previewName || '';

    const discography = useMemo(() => {
        // Build a map from release-group MBID → MB type for DB albums
        const mbTypeByRgMbid = new Map(mbReleases.map(r => [r.releaseGroupMbid, r.type as 'Album' | 'EP' | 'Single' | null]));
        const existingRgMbids = new Set(albums.filter(a => a.mbid).map(a => a.mbid as string));
        const existingTitles = new Set(albums.map(a => a.title.toLowerCase()));

        const baseAlbums: DiscographyItem[] = albums.map(a => ({
            title: a.title,
            date: a.release_date,
            cover: a.cover_url,
            href: `/albums/${a.id}`,
            inDatabase: true,
            avgRating: a.avg_rating,
            reviewsCount: a.reviews_count,
            listenersCount: a.listeners_count,
            // Determine release type from MB data (matched by release-group MBID)
            releaseType: a.mbid ? (mbTypeByRgMbid.get(a.mbid) ?? null) : null,
        }));

        const missingReleases: DiscographyItem[] = mbReleases
            .filter(r => !existingRgMbids.has(r.releaseGroupMbid) && !existingTitles.has(r.title.toLowerCase()))
            .map(r => ({
                title: r.title,
                date: r.date,
                cover: null,
                coverFromArchive: true,
                releaseGroupMbid: r.releaseGroupMbid,
                href: `/albums/preview/${r.mbid}`,
                inDatabase: false,
                mbid: r.mbid,
                releaseType: r.type as 'Album' | 'EP' | 'Single' | null,
            }));

        return [...baseAlbums, ...missingReleases].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    }, [albums, mbReleases]);

    // Top 3 albums by listeners (DB only)
    const topAlbums = useMemo(() =>
        [...albums]
            .filter(a => (a.listeners_count ?? 0) > 0)
            .sort((a, b) => {
                const listenersDiff = (b.listeners_count ?? 0) - (a.listeners_count ?? 0);
                if (listenersDiff !== 0) return listenersDiff;
                return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
            })
            .slice(0, 3),
        [albums]
    );

    const handleImportAlbum = async (mbid: string) => {
        if (importingMbid) return;
        setImportingMbid(mbid);
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
                router.push((result as any).redirectUrl || `/albums/${result.albumId}`);
            } else {
                showToast("Erreur lors de l'import", 'error');
                setImportingMbid(null);
            }
        } catch {
            showToast("Erreur lors de l'import", 'error');
            setImportingMbid(null);
        }
    };

    const year = (date?: string | null) => date ? new Date(date).getFullYear() : null;
    const totalTracks = albums.reduce((sum, a) => sum + (a.track_count || 0), 0);

    return (
        <div className="mt-8">
            {/* ========== HERO ========== */}
            <div className="mb-10">
                <div className="flex items-start gap-5">
                    {/* Artist image */}
                    {imageUrl ? (
                        <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden relative">
                            <Image src={imageUrl} alt={artistName} fill className="object-cover" />
                        </div>
                    ) : (
                        <div className="flex-shrink-0 w-20 h-20 rounded-full bg-background-secondary flex items-center justify-center">
                            <span className="text-[24px] text-text-tertiary">{artistName.charAt(0)}</span>
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2]">
                            {artistName}
                        </h1>
                        <div className="text-[14px] text-text-secondary mt-1">
                            {(() => {
                                const mainCount = discography.filter(d => d.releaseType !== 'Single').length;
                                const singlesCount = discography.filter(d => d.releaseType === 'Single').length;
                                const parts: string[] = [];
                                if (mainCount > 0) parts.push(`${mainCount} ${mainCount > 1 ? 'albums' : 'album'}`);
                                if (singlesCount > 0) parts.push(`${singlesCount} ${singlesCount > 1 ? 'singles' : 'single'}`);
                                return parts.join(' · ') || `${discography.length} release${discography.length > 1 ? 's' : ''}`;
                            })()}
                            {previewType && ` · ${previewType}`}
                        </div>
                        {previewCountry && (
                            <p className="text-[14px] text-text-secondary mt-0.5">{previewCountry}</p>
                        )}

                        {/* Aggregate stats */}
                        {artistStats && (artistStats.totalListeners > 0 || artistStats.globalAvgRating !== null || artistStats.totalReviews > 0) && (
                            <div className="flex items-baseline gap-5 mt-3">
                                {artistStats.globalAvgRating !== null && (
                                    <span>
                                        <span className="text-[16px] text-text-primary font-medium">{artistStats.globalAvgRating.toFixed(1)}</span>
                                        <span className="text-[12px] text-text-tertiary ml-0.5">/10 moy.</span>
                                    </span>
                                )}
                                {artistStats.totalListeners > 0 && (
                                    <span>
                                        <span className="text-[16px] text-text-primary font-medium">{artistStats.totalListeners.toLocaleString()}</span>
                                        <span className="text-[12px] text-text-tertiary ml-1">{artistStats.totalListeners === 1 ? 'auditeur' : 'auditeurs'}</span>
                                    </span>
                                )}
                                {artistStats.totalReviews > 0 && (
                                    <span>
                                        <span className="text-[16px] text-text-primary font-medium">{artistStats.totalReviews.toLocaleString()}</span>
                                        <span className="text-[12px] text-text-tertiary ml-1">{artistStats.totalReviews === 1 ? 'critique' : 'critiques'}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Network listeners */}
                {networkListeners.length > 0 && (() => {
                    const shown = networkListeners.slice(0, 3);
                    const rest = networkListeners.length - shown.length;
                    const tokens = shown.map(l => l.username);
                    let label: string;
                    if (tokens.length === 1) {
                        label = `${tokens[0]} a écouté cet artiste`;
                    } else if (rest === 0) {
                        label = `${tokens.slice(0, -1).join(', ')} et ${tokens[tokens.length - 1]} ont écouté cet artiste`;
                    } else {
                        label = `${tokens.join(', ')} et ${rest} autre${rest > 1 ? 's' : ''} ont écouté cet artiste`;
                    }
                    return (
                        <button
                            onClick={() => setIsNetworkOpen(true)}
                            className="flex items-center gap-2 mt-5 hover:opacity-75 transition-opacity duration-150"
                        >
                            <div className="flex -space-x-1.5">
                                {shown.map(l => (
                                    <div key={l.userId} className="border border-background-primary rounded-full flex-shrink-0">
                                        <UserAvatar userId={l.userId} src={l.avatarUrl} size={20} />
                                    </div>
                                ))}
                            </div>
                            <span className="text-[12px] text-text-tertiary leading-snug">{label}</span>
                        </button>
                    );
                })()}

            </div>

            {/* ========== TOP ALBUMS ========== */}
            {topAlbums.length > 0 && (
                <section className="border-t border-border-divider pt-10 mb-12">
                    <h2 className="text-h2 text-text-primary mb-6">Populaires</h2>
                    <div className="flex flex-col gap-2">
                        {topAlbums.map((album, idx) => (
                            <Link
                                key={album.id}
                                href={`/albums/${album.id}`}
                                className="flex items-center gap-4 py-2 hover:opacity-75 transition-opacity duration-150"
                            >
                                <span className="text-[13px] text-text-tertiary tabular-nums w-4 flex-shrink-0">{idx + 1}</span>
                                <div className="w-10 h-10 rounded-[6px] overflow-hidden flex-shrink-0 bg-background-secondary relative">
                                    {album.cover_url && (
                                        <Image src={album.cover_url} alt={album.title} fill className="object-cover" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] text-text-primary font-medium truncate">{album.title}</p>
                                    <p className="text-[12px] text-text-tertiary">
                                        {year(album.release_date)}
                                        {(album.listeners_count ?? 0) > 0 && ` · ${album.listeners_count!.toLocaleString()} ${album.listeners_count === 1 ? 'auditeur' : 'auditeurs'}`}
                                    </p>
                                </div>
                                {album.avg_rating != null && (
                                    <span className="text-[13px] text-text-primary flex-shrink-0">
                                        {album.avg_rating.toFixed(1)}<span className="text-text-tertiary text-[11px]">/10</span>
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ========== DISCOGRAPHIE ========== */}
            {(() => {
                const mainReleases = discography.filter(a => a.releaseType !== 'Single');
                const singles = discography.filter(a => a.releaseType === 'Single');

                const renderGrid = (items: DiscographyItem[]) => (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {items.map((album) => {
                            const isImporting = importingMbid === album.mbid;
                            const isDisabled = !!importingMbid && !isImporting;
                            const cardClass = `group rounded-[12px] overflow-hidden bg-background-secondary hover:bg-background-tertiary transition-colors duration-150 text-left w-full ${isDisabled ? 'opacity-50' : ''}`;

                            const cardContent = (
                                <>
                                    <AlbumCover album={album} />
                                    <div className="px-3 py-2.5">
                                        {isImporting ? (
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#8E6F5E] flex-shrink-0" />
                                                <span className="text-[13px] text-text-secondary">Import en cours…</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[14px] font-medium text-text-primary truncate">{album.title}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {album.date && (
                                                            <span className="text-[12px] text-text-secondary">{year(album.date)}</span>
                                                        )}
                                                        {album.releaseType === 'EP' && (
                                                            <span className="text-[10px] text-text-disabled font-medium uppercase tracking-wide">EP</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {album.avgRating != null && (
                                                    <span className="text-[12px] text-text-primary flex-shrink-0 whitespace-nowrap">
                                                        {album.avgRating.toFixed(1)}/10
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            );

                            if (album.inDatabase) {
                                return (
                                    <Link key={`db-${album.href}`} href={album.href} className={cardClass}>
                                        {cardContent}
                                    </Link>
                                );
                            }

                            return (
                                <button
                                    key={`mb-${album.mbid}`}
                                    onClick={() => album.mbid && !importingMbid && handleImportAlbum(album.mbid)}
                                    disabled={!!importingMbid}
                                    className={cardClass}
                                >
                                    {cardContent}
                                </button>
                            );
                        })}
                    </div>
                );

                return (
                    <>
                        {mainReleases.length > 0 && (
                            <section>
                                <h2 className="text-h2 text-text-primary mb-6">Discographie</h2>
                                {renderGrid(mainReleases)}
                            </section>
                        )}

                        {singles.length > 0 && (
                            <section className="border-t border-border-divider pt-10 mt-12">
                                <h2 className="text-h2 text-text-primary mb-6">Singles</h2>
                                {renderGrid(singles)}
                            </section>
                        )}

                        {discography.length === 0 && (
                            <section>
                                <h2 className="text-h2 text-text-primary mb-6">Discographie</h2>
                                <div className="text-center text-text-tertiary text-[14px] py-12">
                                    Aucun album trouvé pour cet artiste
                                </div>
                            </section>
                        )}
                    </>
                );
            })()}

            {/* ========== ARTISTES SIMILAIRES ========== */}
            {similarArtists.filter(a => a.id !== null).length > 0 && (
                <section className="border-t border-border-divider pt-10 mt-12 mb-8">
                    <h2 className="text-h2 text-text-primary mb-6">Artistes similaires</h2>
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                        {similarArtists.filter(a => a.id !== null).map(a => (
                            <Link
                                key={a.id}
                                href={`/artists/${a.id}`}
                                className="snap-center shrink-0 flex flex-col items-center gap-2 w-20 hover:opacity-75 transition-opacity duration-150"
                            >
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-background-secondary relative flex-shrink-0">
                                    {a.imageUrl ? (
                                        <Image src={a.imageUrl} alt={a.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-[20px] text-text-tertiary">{a.name.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[12px] text-text-secondary text-center leading-tight line-clamp-2 w-full">{a.name}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Network Listeners Bottom Sheet */}
            <NetworkListenersBottomSheet
                listeners={networkListeners.map(l => ({
                    ...l,
                    rating: l.rating ?? null,
                    listenedAt: l.listenedAt ?? null,
                    entryId: l.entryId ?? null,
                    hasReview: l.hasReview ?? false,
                }))}
                isOpen={isNetworkOpen}
                onClose={() => setIsNetworkOpen(false)}
            />
        </div>
    );
}

function AlbumCover({ album }: { album: DiscographyItem }) {
    const [error, setError] = useState(false);

    if (album.cover && !error) {
        return (
            <div className="aspect-square overflow-hidden relative">
                <Image src={album.cover} alt={album.title} fill className="object-cover" onError={() => setError(true)} />
            </div>
        );
    }

    if (album.coverFromArchive && album.releaseGroupMbid && !error) {
        return (
            <div className="aspect-square overflow-hidden relative">
                <Image
                    src={`https://coverartarchive.org/release-group/${album.releaseGroupMbid}/front-500`}
                    alt={album.title}
                    fill
                    className="object-cover"
                    loading="lazy"
                    onError={() => setError(true)}
                />
            </div>
        );
    }

    return (
        <div className="aspect-square bg-background-tertiary flex items-center justify-center">
            <span className="text-[12px] text-text-tertiary">Aucune pochette</span>
        </div>
    );
}
