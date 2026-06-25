import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BackButton from '@/components/BackButton';
import TrackReviewSection from '@/components/TrackReviewSection';
import TrackDiaryInline from '@/components/TrackDiaryInline';
import TrackEntryMenu from '@/components/TrackEntryMenu';
import GenrePills from '@/components/GenrePills';
import StreamingLinks from '@/components/StreamingLinks';
import { msToMMSS } from '@/lib/time';
import { getTrack, getAlbumTracks } from '@/app/actions/tracks';
import { getTrackStats, getTrackReviewsPreview, getLatestTrackDiaryEntry } from '@/app/actions/track-diary';
import { getUserLists, getUserListsContainingTrack } from '@/app/actions/lists';
import { createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import TrackNetworkListeners from '@/components/TrackNetworkListeners';
import AddToListButton from '@/components/AddToListButton';

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
        (supabase as any)
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

    const genres: string[] = (genresData.data ?? []).flatMap((row: any) =>
        row.genres && typeof row.genres === 'object' && 'name' in row.genres ? [row.genres.name as string] : []
    );

    const streamingLinks = {
        spotify:    trackMeta.data?.spotify_url     || albumMeta.data?.spotify_url     || undefined,
        appleMusic: trackMeta.data?.apple_music_url || albumMeta.data?.apple_music_url || undefined,
        deezer:     trackMeta.data?.deezer_url      || albumMeta.data?.deezer_url      || undefined,
    };

    const hasStreaming = !!(streamingLinks.spotify || streamingLinks.appleMusic || streamingLinks.deezer);
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
            <div className="flex flex-col md:flex-row md:gap-section-md md:items-start mt-4">
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

                    {/* Ligne 1 : artiste */}
                    <div className="text-meta text-text-secondary">
                        <Link href={`/artists/${t.artist_id}`} className="border-b border-rule hover:text-accent hover:border-accent transition-colors duration-150">
                            {t.artist_name}
                        </Link>
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
            {hasStreaming && (
                <div className="mt-5 mb-4">
                    <StreamingLinks albumId={t.album_id} initial={streamingLinks} showSeparator={false} />
                </div>
            )}

            {/* ── Mon écoute ── */}
            {userEntry && (
                <div className="border-t border-border-divider mt-8 pt-8 mb-10">
                    <div className="flex items-center gap-3 mb-6">
                        <h2 className="text-h2 text-text-primary">Mon écoute</h2>
                    </div>
                    <div className="relative bg-background-secondary rounded-[12px] p-4 pl-5">
                        <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-accent opacity-50 rounded-r-full" />
                        <div className="flex items-center justify-between mb-3">
                            {userEntry.rating !== null && (
                                <span className="inline-flex items-baseline gap-0.5 bg-[#FAF8F4] border border-accent rounded-[6px] px-2 py-1 text-accent font-display italic text-[18px] leading-none">
                                    {userEntry.rating}
                                    <span className="font-sans not-italic text-[9px] tracking-[0.16em] uppercase opacity-70">/10</span>
                                </span>
                            )}
                            {user?.id && (
                                <TrackEntryMenu
                                    entryId={userEntry.id}
                                    trackId={id}
                                    albumId={t.album_id}
                                    artistId={t.artist_id}
                                    currentRating={userEntry.rating}
                                    currentReview={userEntry.reviewBody}
                                    currentListenedAt={userEntry.listenedAt}
                                />
                            )}
                        </div>
                        {userEntry.reviewBody && (
                            <p className="text-meta text-text-secondary italic leading-relaxed max-w-lg mb-3">
                                &laquo;&thinsp;{userEntry.reviewBody}&thinsp;&raquo;
                            </p>
                        )}
                        <span className="inline-flex items-center gap-1.5 bg-[#FAF8F4] border border-rule rounded-full px-2.5 py-1 font-display italic text-[12px] text-accent leading-none">
                            {new Date(userEntry.listenedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>
            )}

            {/* ── Stats + réseau ── */}
            {((stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.ratings_count > 0)) || networkListeners.length > 0) && (
                <section className="border-t border-border-divider pt-6 mb-10">
                    {stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.ratings_count > 0) && (
                        <div className={`flex ${networkListeners.length > 0 ? 'mb-4' : ''}`}>
                            {stats.avg_rating !== null && (
                                <div className={`flex flex-col flex-1 ${(stats.listeners_count > 0 || stats.ratings_count > 0) ? 'border-r border-rule pr-4' : ''}`}>
                                    <span className="font-display italic text-[26px] text-text-warm leading-none">
                                        {Number(stats.avg_rating).toFixed(1).replace('.', ',')}
                                        <span className="font-sans not-italic text-[10px] tracking-[0.16em] uppercase text-text-tertiary ml-1 align-[1px]">/10</span>
                                    </span>
                                    <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Moyenne</span>
                                </div>
                            )}
                            {stats.listeners_count > 0 && (
                                <div className={`flex flex-col flex-1 ${stats.ratings_count > 0 ? 'border-r border-rule' : ''} ${stats.avg_rating !== null ? 'px-4' : 'pr-4'}`}>
                                    <span className="font-display italic text-[26px] text-text-warm leading-none">{stats.listeners_count.toLocaleString()}</span>
                                    <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Auditeurs</span>
                                </div>
                            )}
                            {stats.ratings_count > 0 && (
                                <div className={`flex flex-col flex-1 ${(stats.avg_rating !== null || stats.listeners_count > 0) ? 'pl-4' : ''}`}>
                                    <span className="font-display italic text-[26px] text-text-warm leading-none">{stats.ratings_count.toLocaleString()}</span>
                                    <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Critiques</span>
                                </div>
                            )}
                        </div>
                    )}
                    <TrackNetworkListeners listeners={networkListeners} />
                </section>
            )}

            {/* Autres titres de l'album */}
            {otherTracks.length > 0 && (
                <>
                    <div className="border-t border-border-divider mt-8 pt-8">
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
                                    </span>
                                    <span className="text-[12px] text-text-tertiary shrink-0">{msToMMSS(tr.duration_ms)}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Critiques */}
            <div className="border-t border-border-divider mt-8 pt-8">
                <TrackReviewSection
                    trackId={id}
                    initialReviews={reviews}
                    reviewsCount={stats?.ratings_count ?? 0}
                />
            </div>

            {/* Plus de cet artiste */}
            {artistAlbums.length > 0 && (
                <div className="border-t border-border-divider mt-8 pt-8">
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
                </div>
            )}
        </main>
    );
}
