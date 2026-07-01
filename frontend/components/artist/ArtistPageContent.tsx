'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { importAlbumFromMusicBrainz } from '@/app/actions/musicbrainz';
import { canonicalAlbumKey } from '@/lib/albumCanonical.mjs';
import { showToast } from '@/components/ui/Toast';
import NetworkListenersBottomSheet from '@/components/album/NetworkListenersBottomSheet';
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

type ReleaseType = 'Album' | 'EP' | 'Single' | 'Live';
const RELEASE_TYPE_FILTERS: { label: string; value: ReleaseType | 'Tous' }[] = [
    { label: 'Tous', value: 'Tous' },
    { label: 'Albums', value: 'Album' },
    { label: 'EPs', value: 'EP' },
    { label: 'Singles', value: 'Single' },
    { label: 'Lives', value: 'Live' },
];

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
    releaseType?: ReleaseType | null;
};

type Apparition = {
    id: string;
    title: string;
    coverUrl: string | null;
    subtitle: string;
    year: number | null;
    href: string;
};

type ArtistPageContentProps = {
    artist?: Artist;
    albums?: Album[];
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
    apparitions?: Apparition[];
};

export function ArtistPageContent({
    artist,
    albums = [],
    imageUrl,
    mbReleases = [],
    artistStats,
    networkListeners = [],
    similarArtists = [],
    userId,
    apparitions = [],
}: ArtistPageContentProps) {
    const router = useRouter();
    const [importingMbid, setImportingMbid] = useState<string | null>(null);
    const [isNetworkOpen, setIsNetworkOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<ReleaseType | 'Tous'>('Tous');

    const artistName = artist?.name || '';

    const discography = useMemo(() => {
        // Build a map from release-group MBID → MB type for DB albums
        const mbTypeByRgMbid = new Map(mbReleases.map(r => [r.releaseGroupMbid, r.type as ReleaseType | null]));
        const existingRgMbids = new Set(albums.filter(a => a.mbid).map(a => a.mbid as string));
        const existingCanonicalKeys = new Set(albums.map(a => canonicalAlbumKey(a.title, artistName)));

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
            .filter(r => !existingRgMbids.has(r.releaseGroupMbid) && !existingCanonicalKeys.has(canonicalAlbumKey(r.title, artistName)))
            .map(r => ({
                title: r.title,
                date: r.date,
                cover: null,
                coverFromArchive: true,
                releaseGroupMbid: r.releaseGroupMbid,
                href: '',
                inDatabase: false,
                mbid: r.mbid,
                releaseType: r.type as ReleaseType | null,
            }));

        return [...baseAlbums, ...missingReleases].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    }, [albums, mbReleases, artistName]);

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
        <div className="mt-4">
            {/* ========== HERO ========== */}
            <div className="mb-10">
                <div className="flex items-center gap-5">
                    {/* Artist image */}
                    {imageUrl ? (
                        <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden relative">
                            <Image src={imageUrl} alt={artistName} fill className="object-cover" sizes="80px" />
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
                            className="flex items-start gap-2 mt-5 w-full hover:opacity-75 transition-opacity duration-150"
                        >
                            <div className="flex -space-x-1.5 flex-shrink-0 mt-0.5">
                                {shown.map(l => (
                                    <div key={l.userId} className="border border-background-primary rounded-full flex-shrink-0">
                                        <UserAvatar userId={l.userId} src={l.avatarUrl} size={20} />
                                    </div>
                                ))}
                            </div>
                            <span className="text-label text-text-tertiary leading-snug min-w-0 flex-1 text-left">{label}</span>
                        </button>
                    );
                })()}

                {/* Aggregate stats — pleine largeur */}
                {artistStats && (artistStats.totalListeners > 0 || artistStats.globalAvgRating !== null || artistStats.totalReviews > 0) && (
                    <div className="flex w-full mt-5 border-t border-b border-rule py-3">
                        {artistStats.globalAvgRating !== null && (
                            <div className="flex flex-col flex-1 border-r border-rule pr-4">
                                <span className="font-display italic text-[26px] text-text-warm leading-none">
                                    {artistStats.globalAvgRating.toFixed(1).replace('.', ',')}
                                    <span className="font-sans not-italic text-[10px] tracking-[0.16em] uppercase text-text-tertiary ml-1 align-[1px]">/10</span>
                                </span>
                                <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Moyenne</span>
                            </div>
                        )}
                        {artistStats.totalListeners > 0 && (
                            <div className={`flex flex-col flex-1 ${artistStats.globalAvgRating !== null ? 'px-4' : 'pr-4'} ${artistStats.totalReviews > 0 ? 'border-r border-rule' : ''}`}>
                                <span className="font-display italic text-[26px] text-text-warm leading-none">{artistStats.totalListeners.toLocaleString()}</span>
                                <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Auditeurs</span>
                            </div>
                        )}
                        {artistStats.totalReviews > 0 && (
                            <div className={`flex flex-col flex-1 ${(artistStats.globalAvgRating !== null || artistStats.totalListeners > 0) ? 'pl-4' : ''}`}>
                                <span className="font-display italic text-[26px] text-text-warm leading-none">{artistStats.totalReviews.toLocaleString()}</span>
                                <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Critiques</span>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* ========== TOP ALBUMS ========== */}
            {topAlbums.length > 0 && (
                <section className="mb-12">
                    <h2 className="text-h2 text-text-primary mb-6">Populaires</h2>
                    <div className="flex flex-col gap-2">
                        {topAlbums.map((album, idx) => (
                            <Link
                                key={album.id}
                                href={`/albums/${album.id}`}
                                className="flex items-center gap-4 py-2 hover:opacity-75 transition-opacity duration-150"
                            >
                                <span className="font-display italic text-[16px] text-accent w-5 text-right flex-shrink-0 leading-none tabular-nums">{idx + 1}</span>
                                <div className="w-10 h-10 rounded-[6px] overflow-hidden flex-shrink-0 bg-background-secondary relative">
                                    {album.cover_url && (
                                        <Image src={album.cover_url} alt={album.title} fill className="object-cover" unoptimized />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-display font-normal text-sm text-text-warm truncate">{album.title}</p>
                                    <p className="text-label text-text-tertiary">
                                        {year(album.release_date)}
                                        {(album.listeners_count ?? 0) > 0 && ` · ${album.listeners_count!.toLocaleString()} auditeurs`}
                                    </p>
                                </div>
                                {album.avg_rating != null && (
                                    <span className="inline-flex items-baseline justify-center gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] w-[58px] py-0.5 text-accent font-display italic text-[15px] leading-none flex-shrink-0">
                                        {album.avg_rating.toFixed(1).replace('.', ',')}
                                        <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ========== DISCOGRAPHIE ========== */}
            {(() => {
                const typeOf = (item: DiscographyItem): ReleaseType => item.releaseType ?? 'Album';
                const typeCounts = discography.reduce((acc, item) => {
                    const t = typeOf(item);
                    acc[t] = (acc[t] ?? 0) + 1;
                    return acc;
                }, {} as Record<ReleaseType, number>);
                const availableFilters = RELEASE_TYPE_FILTERS.filter(
                    f => f.value === 'Tous' || (typeCounts[f.value as ReleaseType] ?? 0) > 0
                );
                const showFilters = availableFilters.length > 2; // "Tous" + at least 2 real types
                const effectiveFilter = availableFilters.some(f => f.value === typeFilter) ? typeFilter : 'Tous';
                const filteredDiscography = effectiveFilter === 'Tous'
                    ? discography
                    : discography.filter(item => typeOf(item) === effectiveFilter);

                return (
                    <section>
                        <h2 className="text-h2 text-text-primary mb-6">Discographie</h2>

                        {discography.length === 0 && (
                            <div className="text-center text-text-tertiary text-meta py-12">
                                Aucun album trouvé pour cet artiste
                            </div>
                        )}

                        {showFilters && (
                            <div className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide">
                                {availableFilters.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setTypeFilter(f.value)}
                                        className={`px-3 py-1 rounded-full text-label font-medium transition-colors flex-shrink-0 ${
                                            effectiveFilter === f.value
                                                ? 'bg-text-primary text-background'
                                                : 'bg-background-secondary text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            {filteredDiscography.map((album) => {
                                const isImporting = importingMbid === album.mbid;
                                const isDisabled = !!importingMbid && !isImporting;
                                const cardClass = `group text-left w-full ${isDisabled ? 'opacity-50' : ''}`;

                                const cardContent = (
                                    <>
                                        <div className="relative aspect-square rounded-cover overflow-hidden bg-background-secondary">
                                            <AlbumCover album={album} />
                                            {isImporting && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-background-secondary">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent flex-shrink-0" />
                                                </div>
                                            )}
                                            {album.avgRating != null && !isImporting && (
                                                <span className="absolute top-1.5 right-1.5 inline-flex items-baseline gap-0.5 bg-paper-hi/90 border border-accent rounded-badge-sm px-1.5 py-0.5 text-accent font-display italic text-[13px] leading-none backdrop-blur-sm">
                                                    {album.avgRating.toFixed(1).replace('.', ',')}
                                                    <span className="font-sans not-italic text-[8px] tracking-[0.14em] uppercase opacity-70">/10</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <div className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug">{album.title}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {album.date && (
                                                    <span className="text-label text-text-tertiary">{year(album.date)}</span>
                                                )}
                                                {(album.releaseType === 'EP' || album.releaseType === 'Live') && (
                                                    <span className="text-[10px] text-text-disabled font-medium uppercase tracking-wide">{album.releaseType}</span>
                                                )}
                                            </div>
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
                    </section>
                );
            })()}

            {/* ========== APPARITIONS (featuring) ========== */}
            {apparitions.length > 0 && (
                <section className="border-t border-border-divider pt-10 mt-12 mb-8">
                    <h2 className="text-h2 text-text-primary mb-6">Apparaît sur</h2>
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                        {apparitions.map((item) => (
                            <Link key={item.id} href={item.href} className="snap-center shrink-0 w-32 sm:w-36 group">
                                <div className="relative aspect-square rounded-cover overflow-hidden bg-background-secondary">
                                    {item.coverUrl ? (
                                        <Image
                                            src={item.coverUrl}
                                            alt={item.title}
                                            fill
                                            className="object-cover group-hover:opacity-80 transition-opacity"
                                            sizes="(max-width: 768px) 33vw, 144px"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-background-tertiary" />
                                    )}
                                </div>
                                <div className="mt-2">
                                    <div className="font-display font-normal text-sm text-text-warm line-clamp-2 leading-snug">{item.title}</div>
                                    <div className="text-label text-text-tertiary truncate mt-0.5">
                                        {item.subtitle}{item.year ? ` · ${item.year}` : ''}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

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
                                        <Image src={a.imageUrl} alt={a.name} fill className="object-cover" sizes="56px" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-[20px] text-text-tertiary">{a.name.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <span className="font-display font-normal text-sm text-text-warm text-center leading-tight line-clamp-2 w-full">{a.name}</span>
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
                title="Ont écouté cet artiste"
                showRating={false}
            />
        </div>
    );
}

function AlbumCover({ album }: { album: DiscographyItem }) {
    const [error, setError] = useState(false);

    if (album.cover && !error) {
        return <Image src={album.cover} alt={album.title} fill className="object-cover" onError={() => setError(true)} unoptimized />;
    }

    if (album.coverFromArchive && album.releaseGroupMbid && !error) {
        return (
            <Image
                src={`https://coverartarchive.org/release-group/${album.releaseGroupMbid}/front-500`}
                alt={album.title}
                fill
                className="object-cover"
                loading="lazy"
                onError={() => setError(true)}
                unoptimized
            />
        );
    }

    return (
        <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
            <span className="text-text-disabled text-[20px]">♪</span>
        </div>
    );
}
