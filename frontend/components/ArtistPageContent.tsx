'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { importAllArtistAlbums } from '@/app/actions/importAllArtistAlbums';

type Album = {
    id: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
    track_count: number;
    avg_rating?: number | null;
    reviews_count?: number;
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
    mbid?: string;
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
};

export function ArtistPageContent({
    artist,
    albums = [],
    previewName,
    previewMbid,
    previewCountry,
    previewType,
    imageUrl,
    mbReleases = []
}: ArtistPageContentProps) {
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState('');

    const isPreviewMode = !artist && previewMbid;
    const artistName = artist?.name || previewName || '';
    const mbid = artist?.mbid || previewMbid;

    const discography = useMemo(() => {
        const existingTitles = new Set(albums.map(a => a.title.toLowerCase()));

        const baseAlbums: DiscographyItem[] = albums.map(a => ({
            title: a.title,
            date: a.release_date,
            cover: a.cover_url,
            href: `/albums/${a.id}`,
            inDatabase: true,
            avgRating: a.avg_rating,
            reviewsCount: a.reviews_count,
        }));

        const missingReleases: DiscographyItem[] = mbReleases
            .filter(r => !existingTitles.has(r.title.toLowerCase()))
            .map(r => ({
                title: r.title,
                date: r.date,
                cover: null,
                coverFromArchive: true,
                releaseGroupMbid: r.releaseGroupMbid,
                href: `/albums/preview/${r.mbid}`,
                inDatabase: false,
                mbid: r.mbid,
            }));

        return [...baseAlbums, ...missingReleases].sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    }, [albums, mbReleases]);

    const missingAlbumsCount = discography.filter(d => !d.inDatabase).length;

    const handleImportAll = async () => {
        if (!artist?.id || !mbid || importing) return;

        setImporting(true);
        setImportProgress(`Importation de ${missingAlbumsCount} album(s)...`);

        try {
            const result = await importAllArtistAlbums(artist.id, mbid);

            if (result.success) {
                // Friendly message coming from action (includes quota)
                const msg = result.message || `${result.imported} album(s) importé(s)`;
                setImportProgress(msg);
                // Reload to reflect DB changes after short delay
                setTimeout(() => window.location.reload(), 2000);
            } else {
                // Show clear reason to user
                const userMsg = result.message || (
                    result.error === 'rate_limited'
                        ? `Limite atteinte (${result.limit} imports / 24h).` 
                        : (result.error || 'Erreur lors de l\'import')
                );
                setImportProgress(userMsg);
                // Clear status after a few seconds and re-enable button
                setTimeout(() => { setImportProgress(''); setImporting(false); }, 5000);
            }
        } catch (err) {
            setImportProgress('Erreur lors de l\'import');
            setTimeout(() => { setImportProgress(''); setImporting(false); }, 3000);
        }
    };

    const year = (date?: string | null) => date ? new Date(date).getFullYear() : null;
    const totalTracks = albums.reduce((sum, a) => sum + (a.track_count || 0), 0);

    return (
        <div className="mt-8">
            {/* Hero */}
            <div className="mb-10">
                <div className="flex items-start gap-5">
                    {/* Artist image */}
                    {imageUrl ? (
                        <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden">
                            <img
                                src={imageUrl}
                                alt={artistName}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
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
                            {discography.length} {discography.length > 1 ? 'albums' : 'album'}
                            {!isPreviewMode && totalTracks > 0 && ` · ${totalTracks} morceaux`}
                            {previewType && ` · ${previewType}`}
                        </div>
                        {previewCountry && (
                            <p className="text-[14px] text-text-secondary mt-0.5">{previewCountry}</p>
                        )}
                    </div>
                </div>

                {/* Import All — btn-secondary per charte */}
                {!isPreviewMode && artist && (missingAlbumsCount > 0 || albums.length === 0) && (
                    <div className="mt-5">
                        <button
                            onClick={handleImportAll}
                            disabled={importing}
                            className="border border-border text-text-secondary text-[14px] font-medium px-4 py-2.5 rounded-[8px] hover:border-accent hover:text-accent transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {importing ? 'Importation...' : `Importer tous les albums (${missingAlbumsCount})`}
                        </button>
                        {importProgress && (
                            <p className="text-[14px] text-text-tertiary mt-2">{importProgress}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Discography */}
            <section>
                <h2 className="text-h2 text-text-primary mb-6">
                    Discographie
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {discography.map((album) => (
                        <Link
                            key={`${album.inDatabase ? 'db' : 'mb'}-${album.title}`}
                            href={album.href}
                            className="group rounded-[12px] overflow-hidden bg-background-secondary hover:bg-background-tertiary transition-colors duration-150"
                        >
                            <AlbumCover album={album} />
                            <div className="px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] font-medium text-text-primary truncate">
                                            {album.title}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {album.date && (
                                                <span className="text-[12px] text-text-secondary">
                                                    {year(album.date)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {album.avgRating != null && (
                                        <span className="text-[12px] text-text-primary flex-shrink-0 whitespace-nowrap">
                                            {album.avgRating.toFixed(1)}/10
                                        </span>
                                    )}
                                </div>
                                {!album.inDatabase && (
                                    <div className="text-[12px] text-text-tertiary mt-0.5">
                                        Non import&eacute;
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>

                {discography.length === 0 && (
                    <div className="text-center text-text-tertiary text-[14px] py-12">
                        Aucun album trouvé pour cet artiste
                    </div>
                )}
            </section>
        </div>
    );
}

/**
 * Album cover with browser-side CoverArt Archive fetch for MB releases.
 * DB albums use their stored cover_url. MB albums use the direct CAA URL
 * and let the browser handle the 307 redirect.
 */
function AlbumCover({ album }: { album: DiscographyItem }) {
    const [error, setError] = useState(false);

    // For DB albums, use stored cover
    if (album.cover && !error) {
        return (
            <div className="aspect-square overflow-hidden">
                <img
                    src={album.cover}
                    alt={album.title}
                    className="w-full h-full object-cover"
                    onError={() => setError(true)}
                />
            </div>
        );
    }

    // For MB albums, try CoverArt Archive directly (browser handles 307 redirect)
    if (album.coverFromArchive && album.releaseGroupMbid && !error) {
        return (
            <div className="aspect-square overflow-hidden">
                <img
                    src={`https://coverartarchive.org/release-group/${album.releaseGroupMbid}/front-250`}
                    alt={album.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setError(true)}
                />
            </div>
        );
    }

    // Fallback placeholder
    return (
        <div className="aspect-square bg-background-tertiary flex items-center justify-center">
            <span className="text-[12px] text-text-tertiary">Aucune pochette</span>
        </div>
    );
}
