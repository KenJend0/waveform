import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BackButton from '@/components/BackButton';
import TrackReviewSection from '@/components/TrackReviewSection';
import TrackDiaryInline from '@/components/TrackDiaryInline';
import EditTrackDiaryEntryButton from '@/components/EditTrackDiaryEntryButton';
import GenrePills from '@/components/GenrePills';
import StreamingLinks from '@/components/StreamingLinks';
import { msToMMSS } from '@/lib/time';
import { getTrack, getAlbumTracks } from '@/app/actions/tracks';
import { getTrackStats, getTrackReviewsPreview, getLatestTrackDiaryEntry } from '@/app/actions/track-diary';
import { getUserLists, getUserListsContainingTrack } from '@/app/actions/lists';
import { createSupabaseServer, getAuthUser } from '@/lib/supabase/server';
import TrackNetworkListeners from '@/components/TrackNetworkListeners';
import AddToListButton from '@/components/AddToListButton';

type PageProps = { params: Promise<{ id: string }> };

export default async function TrackPage({ params }: PageProps) {
    const { id } = await params;

    const t = await getTrack(id);
    if (!t) notFound();

    const supabase = await createSupabaseServer();
    const user = await getAuthUser();

    const [stats, reviews, userEntry, albumTracks, genresData, albumMeta, artistAlbumsData, followsResp, userLists, listsContaining] = await Promise.all([
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
        // Streaming links de l'album parent
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
        spotify: albumMeta.data?.spotify_url || undefined,
        appleMusic: albumMeta.data?.apple_music_url || undefined,
        deezer: albumMeta.data?.deezer_url || undefined,
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
        <main className="max-w-page mx-auto px-4 py-8 pb-24 overflow-x-hidden">
            <BackButton />

            {/* Hero — même layout qu'AlbumHero */}
            <div className="flex flex-col md:flex-row md:gap-section-md md:items-start mt-8">
                {/* Cover */}
                <div className="flex-shrink-0 w-full md:w-48 mb-2 md:mb-0">
                    {t.cover_url ? (
                        <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0 relative">
                            <Image src={t.cover_url} alt={`${t.album_title} cover`} fill className="object-cover" />
                        </div>
                    ) : (
                        <div className="rounded-[10px] bg-background-secondary aspect-square w-full max-w-48 mx-auto md:mx-0 flex items-center justify-center">
                            <span className="text-text-tertiary text-[12px]">Pas de couverture</span>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.02em] leading-[1.2] mb-2">
                        {t.title}
                    </h1>

                    {/* Ligne 1 : artiste · année */}
                    <div className="text-[14px] text-text-secondary">
                        <Link href={`/artists/${t.artist_id}`} className="hover:text-[#8E6F5E] transition-colors duration-150">
                            {t.artist_name}
                        </Link>
                        {year && ` · ${year}`}
                    </div>

                    {/* Ligne 2 : album · durée */}
                    <div className="text-[13px] text-text-tertiary mt-0.5 mb-4">
                        {t.album_type !== 'Single' && (
                            <Link href={`/albums/${t.album_id}`} className="hover:text-text-secondary transition-colors duration-150">
                                {t.album_title}
                            </Link>
                        )}
                        {t.duration_ms != null && `${t.album_type !== 'Single' ? ' · ' : ''}${msToMMSS(t.duration_ms)}`}
                    </div>

                    {/* Stats communauté */}
                    {stats && (stats.avg_rating !== null || stats.listeners_count > 0 || stats.ratings_count > 0) && (
                        <div className="flex items-baseline gap-5 mt-2">
                            {stats.avg_rating !== null && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.avg_rating}</span>
                                    <span className="text-[12px] text-text-tertiary ml-0.5">/10 moy.</span>
                                </span>
                            )}
                            {stats.listeners_count > 0 && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.listeners_count}</span>
                                    <span className="text-[12px] text-text-tertiary ml-1">{stats.listeners_count === 1 ? 'auditeur' : 'auditeurs'}</span>
                                </span>
                            )}
                            {stats.ratings_count > 0 && (
                                <span>
                                    <span className="text-[16px] text-text-primary font-medium">{stats.ratings_count}</span>
                                    <span className="text-[12px] text-text-tertiary ml-1">{stats.ratings_count === 1 ? 'critique' : 'critiques'}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <TrackNetworkListeners listeners={networkListeners} />

            {/* ── Mon écoute ── */}
            {userEntry && (
                <div className="border-t border-border-divider mt-8 pt-8 mb-10">
                    <div className="flex items-center gap-3 mb-6">
                        <h2 className="text-h2 text-text-primary">Mon écoute</h2>
                    </div>
                    <div className="bg-background-secondary rounded-[12px] p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                {userEntry.rating !== null && (
                                    <div className="mb-3">
                                        <span className="text-[24px] font-medium text-text-primary">{userEntry.rating}</span>
                                        <span className="text-[12px] text-text-tertiary ml-1">/10</span>
                                    </div>
                                )}
                                {userEntry.reviewBody && (
                                    <blockquote className="text-[14px] text-text-secondary italic mb-3 leading-relaxed max-w-lg">
                                        {userEntry.reviewBody}
                                    </blockquote>
                                )}
                                <div className="text-[12px] text-text-tertiary">
                                    {new Date(userEntry.listenedAt).toLocaleDateString('fr-FR')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-text-tertiary">
                                <EditTrackDiaryEntryButton
                                    entryId={userEntry.id}
                                    trackId={id}
                                    albumId={t.album_id}
                                    artistId={t.artist_id}
                                    currentRating={userEntry.rating}
                                    currentReview={userEntry.reviewBody}
                                    currentListenedAt={userEntry.listenedAt}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bouton noter (toujours visible) ── */}
            <div className="flex gap-2 mt-4">
                <TrackDiaryInline
                    trackId={id}
                    albumId={t.album_id}
                    artistId={t.artist_id}
                    existingEntry={userEntry ?? null}
                />
                <AddToListButton
                    trackId={id}
                    userId={user?.id}
                    userLists={userLists}
                    initialListsContaining={listsContaining}
                />
            </div>

            {/* Séparateur */}
            {(genres.length > 0 || hasStreaming) && (
                <div className="border-t border-border-divider mt-8" />
            )}

            {/* Streaming links */}
            {hasStreaming && (
                <div className="mt-4">
                    <StreamingLinks albumId={t.album_id} initial={streamingLinks} />
                </div>
            )}

            {/* Genres hérités */}
            {genres.length > 0 && (
                <GenrePills genres={genres} albumId={t.album_id} className="mt-4" />
            )}

            {/* Autres titres de l'album */}
            {otherTracks.length > 0 && (
                <>
                    <div className="border-t border-border-divider mt-8 pt-8">
                        <div className="flex items-baseline justify-between mb-4">
                            <h2 className="text-h2 text-text-primary">Autres titres de l'album</h2>
                            <Link href={`/albums/${t.album_id}`} className="text-[12px] text-text-tertiary hover:text-[#8E6F5E] transition-colors">
                                Voir l'album
                            </Link>
                        </div>
                        <div className="space-y-1">
                            {otherTracks.map((tr) => (
                                <Link
                                    key={tr.id}
                                    href={`/tracks/${tr.id}`}
                                    className="flex items-center gap-3 py-2 px-3 rounded-[8px] hover:bg-background-secondary transition-colors duration-150 group"
                                >
                                    <span className="text-[12px] text-text-disabled w-5 text-right shrink-0">{tr.track_no ?? '–'}</span>
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
                        <Link href={`/artists/${t.artist_id}`} className="text-[12px] text-text-tertiary hover:text-[#8E6F5E] transition-colors">
                            Voir l'artiste
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
                                            <Image src={album.cover_url} alt={album.title} fill className="object-cover group-hover:opacity-80 transition-opacity" />
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
