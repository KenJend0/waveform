import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BackButton from '@/components/ui/BackButton';
import TrackReviewSection from '@/components/track/TrackReviewSection';
import TrackDiaryInline from '@/components/track/TrackDiaryInline';
import GenrePills from '@/components/album/GenrePills';
import StreamingLinks from '@/components/album/StreamingLinks';
import { msToMMSS } from '@/lib/time';
import { getTrack, getAlbumTracks } from '@/app/actions/tracks';
import { getTrackStats, getTrackReviewsPreview, getLatestTrackDiaryEntry } from '@/app/actions/track-diary';
import { getUserLists, getUserListsContainingTrack } from '@/app/actions/lists';
import { createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import TrackNetworkListeners from '@/components/track/TrackNetworkListeners';
import AddToListButton from '@/components/lists/AddToListButton';
import TrackMyListenSection from '@/components/track/TrackMyListenSection';
import ScrollToReviewsStat from '@/components/album/ScrollToReviewsStat';
import ScrollToHashClient from '@/components/ui/ScrollToHashClient';
import { creditParts } from '@/lib/creditedArtists';

type PageProps = { params: Promise<{ id: string }>; searchParams?: Promise<{ source?: string }> };

export default async function TrackPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const recSource = resolvedSearchParams?.source;

    const t = await getTrack(id);
    if (!t) notFound();

    const supabase = await createSupabaseServer();
    const user = await getAuthUser();

    const [stats, reviews, userEntry, albumTracks, genresData, trackMeta, albumMeta, artistAlbumsData, followsResp, userLists, listsContaining] = await Promise.all([
        getTrackStats(id),
        getTrackReviewsPreview(id, 5),
        getLatestTrackDiaryEntry(id),
        getAlbumTracks(t.album_id),
        // Genres hérités de l'album parent
        supabase
            .from('album_genres')
            .select('genres(name)')
            .eq('album_id', t.album_id)
            .order('weight', { ascending: false })
            .limit(3),
        // Streaming links du titre (priorité)
        supabase
            .from('track_metadata')
            .select('spotify_url, apple_music_url, deezer_url')
            .eq('track_id', id)
            .maybeSingle(),
        // Streaming links de l'album parent (fallback)
        supabase
            .from('album_metadata')
            .select('spotify_url, apple_music_url, deezer_url')
            .eq('album_id', t.album_id)
            .maybeSingle(),
        // Autres albums de l'artiste
        supabase
            .from('albums')
            .select('id, title, cover_url, release_date, album_stats(listeners_count)')
            .eq('artist_id', t.artist_id)
            .neq('id', t.album_id)
            .order('listeners_count', { ascending: false, referencedTable: 'album_stats' })
            .limit(6),
        user
            ? supabase.from('follows').select('followee_id').eq('follower_id', user.id)
            : Promise.resolve({ data: null }),
        user ? getUserLists(user.id) : Promise.resolve([]),
        user ? getUserListsContainingTrack(id) : Promise.resolve([]),
    ]);

    const year = t.release_date ? new Date(t.release_date).getFullYear() : undefined;
    const otherTracks = albumTracks.filter(tr => tr.id !== id).slice(0, 8);
    const hasStats = !!stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.reviews_count > 0);

    const genres: string[] = (genresData.data ?? []).flatMap((row: any) =>
        row.genres && typeof row.genres === 'object' && 'name' in row.genres ? [row.genres.name as string] : []
    );

    const streamingLinks = {
        spotify:    trackMeta.data?.spotify_url     || albumMeta.data?.spotify_url     || undefined,
        appleMusic: trackMeta.data?.apple_music_url || albumMeta.data?.apple_music_url || undefined,
        deezer:     trackMeta.data?.deezer_url      || albumMeta.data?.deezer_url      || undefined,
    };

    const artistAlbums = (artistAlbumsData.data ?? []) as any[];

    type NetworkListener = {
        userId: string; username: string; avatarUrl: string | null;
        rating: number | null; listenedAt: string | null; entryId: string | null; hasReview: boolean;
    };
    let networkListeners: NetworkListener[] = [];
    const followeeIds = ((followsResp as any).data ?? []).map((f: any) => f.followee_id);
    if (user && followeeIds.length > 0) {
        const [{ data: entries }, { data: followeeProfiles }] = await Promise.all([
            supabase
                .from('track_diary_entries')
                .select('id, user_id, rating, listened_at, review_body')
                .eq('track_id', id)
                .in('user_id', followeeIds)
                .order('listened_at', { ascending: false }),
            supabase.from('profiles').select('id, username, avatar_url').in('id', followeeIds),
        ]);
        const profileMap = new Map((followeeProfiles ?? []).map((p: any) => [p.id, p]));
        const latestByUser = new Map<string, any>();
        for (const e of (entries ?? [])) {
            const p = profileMap.get(e.user_id);
            if (!latestByUser.has(e.user_id) && p) {
                latestByUser.set(e.user_id, { id: e.id, rating: e.rating, listenedAt: e.listened_at, hasReview: !!(e.review_body?.trim()), profile: p });
            }
        }
        networkListeners = [...latestByUser.values()].map(({ profile: p, ...entry }) => ({
            userId: p.id, username: p.username ?? '', avatarUrl: p.avatar_url ?? null,
            rating: entry.rating ?? null, listenedAt: entry.listenedAt ?? null,
            entryId: entry.id ?? null, hasReview: entry.hasReview ?? false,
        }));
    }

    return (
        <main className="max-w-page mx-auto px-4 pt-4 pb-24 overflow-x-hidden">
            <BackButton />

            {/* Hero — même layout qu'AlbumHero */}
            <div className="mt-4 mb-6">
                <div className="flex flex-col md:flex-row md:gap-section-md md:items-start">
                    {/* Cover */}
                    <div className="flex-shrink-0 w-full md:w-48 mb-2 md:mb-0">
                        {t.cover_url ? (
                            <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0 relative">
                                <Image src={t.cover_url} alt={`${t.album_title} cover`} fill className="object-cover" sizes="(max-width: 768px) 192px, 192px" unoptimized />
                            </div>
                        ) : (
                            <div className="rounded-[10px] bg-background-secondary aspect-square w-full max-w-48 mx-auto md:mx-0 flex items-center justify-center">
                                <span className="text-text-tertiary text-label">Pas de couverture</span>
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2] mb-2">
                            {t.title}
                        </h1>

                        {/* Ligne 1 : artiste(s) */}
                        <div className="text-meta text-text-secondary">
                            {creditParts({ id: t.artist_id, name: t.artist_name }, t.featuredArtists).map((part, i) => (
                                <span key={part.artist.id || i}>
                                    {part.prefix}
                                    <Link href={`/artists/${part.artist.id}`} className="border-b border-rule hover:text-accent hover:border-accent transition-colors duration-150">
                                        {part.artist.name}
                                    </Link>
                                </span>
                            ))}
                        </div>

                        {/* Ligne 2 : album · année */}
                        <div className="text-sm text-text-tertiary mt-0.5">
                            {t.album_type !== 'Single' && (
                                <Link href={`/albums/${t.album_id}`} className="hover:text-text-secondary transition-colors duration-150">
                                    {t.album_title}
                                </Link>
                            )}
                            {year && `${t.album_type !== 'Single' ? ' · ' : ''}${year}`}
                        </div>

                        {/* Genres hérités */}
                        {genres.length > 0 && (
                            <GenrePills genres={genres} albumId={t.album_id} className="mt-3" />
                        )}

                    </div>
                </div>

                {/* Actions — always visible */}
                <div className="flex gap-2 mt-4">
                    <TrackDiaryInline
                        trackId={id}
                        albumId={t.album_id}
                        artistId={t.artist_id}
                        userId={user?.id}
                        existingEntry={userEntry ?? null}
                        source={recSource}
                    />
                    <AddToListButton
                        trackId={id}
                        userId={user?.id}
                        userLists={userLists}
                        initialListsContaining={listsContaining}
                    />
                </div>

                {/* Streaming links */}
                <div className="mt-5">
                    <StreamingLinks albumId={t.album_id} initial={streamingLinks} showSeparator={false} />
                </div>
            </div>

            {/* ── Activité réseau ── */}
            {networkListeners.length > 0 && (
                <div className="mb-5">
                    <TrackNetworkListeners listeners={networkListeners} />
                </div>
            )}

            {/* ── Stats ── */}
            {hasStats && (
                <div className="flex w-full border-t border-b border-rule py-3 mb-8">
                    {stats.avg_rating !== null && (
                        <div className={`flex flex-col flex-1 ${(stats.listeners_count > 0 || stats.reviews_count > 0) ? 'border-r border-rule pr-4' : ''}`}>
                            <span className="font-display italic text-[26px] text-text-warm leading-none">
                                {Number(stats.avg_rating).toFixed(1).replace('.', ',')}
                                <span className="font-sans not-italic text-[10px] tracking-[0.16em] uppercase text-text-tertiary ml-1 align-[1px]">/10</span>
                            </span>
                            <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Moyenne</span>
                        </div>
                    )}
                    {stats.listeners_count > 0 && (
                        <div className={`flex flex-col flex-1 ${stats.reviews_count > 0 ? 'border-r border-rule' : ''} ${stats.avg_rating !== null ? 'px-4' : 'pr-4'}`}>
                            <span className="font-display italic text-[26px] text-text-warm leading-none">{stats.listeners_count.toLocaleString()}</span>
                            <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Auditeurs</span>
                        </div>
                    )}
                    {stats.reviews_count > 0 && (
                        <ScrollToReviewsStat
                            count={stats.reviews_count}
                            className={`flex flex-col flex-1 ${(stats.avg_rating !== null || stats.listeners_count > 0) ? 'pl-4' : ''}`}
                        />
                    )}
                </div>
            )}

            {/* ── Mon écoute ── */}
            {userEntry && (
                <TrackMyListenSection
                    trackId={id}
                    albumId={t.album_id}
                    artistId={t.artist_id}
                    userId={user?.id}
                    entry={userEntry}
                />
            )}

            {/* Autres titres de l'album */}
            {otherTracks.length > 0 && (
                <section className={
                    userEntry
                        // "Mon écoute" ferme déjà avec un border-b sans marge après — il faut le pt-8 pour créer l'espace
                        ? 'pt-8 mb-12'
                        : hasStats
                            // Les Stats ferment avec un border-b ET un mb-8 qui sert déjà de tampon — pas de pt en plus
                            ? 'mb-12'
                            // Rien au-dessus n'a dessiné de séparateur — on le fait nous-mêmes
                            : 'border-t border-border-divider pt-8 mb-12'
                }>
                    <div className="flex items-baseline justify-between mb-4">
                        <h2 className="text-h2 text-text-primary">Autres titres de l'album</h2>
                        <Link href={`/albums/${t.album_id}`} className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150">
                            voir l'album
                        </Link>
                    </div>
                    <div className="space-y-1">
                        {otherTracks.map((tr) => (
                            <Link
                                key={tr.id}
                                href={`/tracks/${tr.id}`}
                                className="flex items-center gap-3 py-2 px-3 rounded-[8px] hover:bg-background-secondary transition-colors duration-150 group"
                            >
                                <span className="font-display italic text-accent text-[16px] w-7 text-right leading-none flex-shrink-0 tabular-nums">{tr.track_no ?? '–'}</span>
                                <span className="flex-1 text-[14px] text-text-primary truncate group-hover:text-[#8E6F5E] transition-colors">
                                    {tr.title}
                                    {tr.featuredArtists.length > 0 && (
                                        <span className="text-text-tertiary">
                                            {tr.featuredArtists.map((f) => `${f.joinphrase || ' feat. '}${f.artist.name}`).join('')}
                                        </span>
                                    )}
                                </span>
                                <span className="text-[12px] text-text-tertiary shrink-0">{msToMMSS(tr.duration_ms)}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Critiques */}
            <section id="reviews" className="border-t border-border-divider pt-8 mb-12 scroll-mt-6">
                <TrackReviewSection
                    trackId={id}
                    initialReviews={reviews}
                    reviewsCount={stats?.reviews_count ?? 0}
                />
            </section>

            {/* Plus de cet artiste */}
            {artistAlbums.length > 0 && (
                <section className="border-t border-border-divider pt-8 mb-12">
                    <div className="flex items-baseline justify-between mb-4">
                        <h2 className="text-h2 text-text-primary">Plus de {t.artist_name}</h2>
                        <Link href={`/artists/${t.artist_id}`} className="font-display italic text-sm text-accent border-b border-accent pb-px hover:text-accent-deep hover:border-accent-deep transition-colors duration-150">
                            voir l'artiste
                        </Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {artistAlbums.map((album: any) => {
                            const albumYear = album.release_date ? new Date(album.release_date).getFullYear() : null;
                            return (
                                <Link
                                    key={album.id}
                                    href={`/albums/${album.id}`}
                                    className="snap-center flex-shrink-0 w-36 group"
                                >
                                    <div className="aspect-square rounded-[8px] overflow-hidden bg-background-secondary relative mb-2">
                                        {album.cover_url ? (
                                            <Image src={album.cover_url} alt={album.title} fill className="object-cover group-hover:opacity-80 transition-opacity" sizes="144px" unoptimized />
                                        ) : (
                                            <div className="w-full h-full bg-background-tertiary" />
                                        )}
                                    </div>
                                    <p className="text-[12px] text-text-primary font-medium truncate group-hover:text-[#8E6F5E] transition-colors">{album.title}</p>
                                    {albumYear && <p className="text-[11px] text-text-tertiary">{albumYear}</p>}
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            <ScrollToHashClient />
        </main>
    );
}
