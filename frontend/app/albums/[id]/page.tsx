import { notFound, redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { msToMMSS, msToDuration } from "@/lib/time";
import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";
import { getUserListsContaining, getUserLists, getPublicListsContaining } from "@/app/actions/lists";
import AppearsInLists from "@/components/AppearsInLists";
import { getArtistReleases } from "@/app/actions/musicbrainz";
import { getSimilarAlbums } from "@/app/actions/metadata";
import { getAlbumReviewsPreview, type AlbumReview } from "@/app/actions/diary";
import { getAlbumTracksStats } from "@/app/actions/track-diary";
import Link from "next/link";
import AlbumHero from "@/components/AlbumHero";
import { CoverImage } from "@/components/CoverImage";
import { coverSrcWithFallback } from "@/lib/cover";
import AlbumReviewSection from "@/components/AlbumReviewSection";
import ArtistAlbumsSection from "@/components/ArtistAlbumsSection";
import ScrollToHashClient from "@/components/ScrollToHashClient";
import GenrePills from "@/components/GenrePills";
import StreamingLinks from "@/components/StreamingLinks";
import AdminSpotifyEdit from "@/components/AdminSpotifyEdit";
import AdminRefreshCover from "@/components/AdminRefreshCover";
import EnrichmentPoller from "@/components/EnrichmentPoller";
import MyListenSection from "@/components/MyListenSection";
import NetworkListenersSection from "@/components/NetworkListenersSection";

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ addToDiary?: string; source?: string }>;
};

export async function generateMetadata({ params }: any) {
    const resolvedParams = params && typeof params.then === "function" ? await params : params;
    const { id } = resolvedParams;
    const supabase = await createSupabaseServer();
    const { data: album } = await supabase
        .from("albums")
        .select("id, title, cover_url, artist_id")
        .eq("id", id)
        .maybeSingle();

    if (!album) return { title: "Album" };

    let artistName = "";
    if (album.artist_id) {
        const { data: artist } = await supabase
            .from("artists")
            .select("name")
            .eq("id", album.artist_id)
            .maybeSingle();
        artistName = artist?.name || "";
    }

    return {
        title: `${album.title}${artistName ? ` — ${artistName}` : ""}`,
        description: `Découvrez ${album.title}${artistName ? ` de ${artistName}` : ""}.`,
        openGraph: {
            images: album.cover_url ? [{ url: album.cover_url }] : [],
        },
    };
}

export default async function AlbumPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const autoOpenDiary = resolvedSearchParams?.addToDiary === "1" || resolvedSearchParams?.addToDiary === "true";
    const recSource = resolvedSearchParams?.source;
    const supabase = await createSupabaseServer();

    // [1] Fetch album — bloque tout, obligatoire en premier
    const { data: album } = await (supabase as any)
        .from("albums")
        .select("id, title, cover_url, release_date, artist_id, mbid, type")
        .eq("id", id)
        .maybeSingle();

    if (!album) notFound();

    // Single importé comme conteneur — rediriger vers la page du titre
    if ((album as any).type === 'Single') {
        const { data: firstTrack } = await supabase
            .from('tracks')
            .select('id')
            .eq('album_id', id)
            .order('track_no', { ascending: true, nullsFirst: true })
            .limit(1)
            .maybeSingle();
        if (firstTrack) redirect(`/tracks/${firstTrack.id}`);
    }

    // [2] Fetch artist, tracks et user en parallèle (dépendent seulement de album)
    const [artistResult, tracksResult, user] = await Promise.all([
        supabase
            .from("artists")
            .select("id, name, mbid")
            .eq("id", album.artist_id)
            .maybeSingle(),
        supabase
            .from("tracks")
            .select("id, title, duration_ms, track_no, disc_no")
            .eq("album_id", id)
            .order("disc_no", { ascending: true, nullsFirst: true })
            .order("track_no", { ascending: true, nullsFirst: true }),
        getAuthUser(),
    ]);
    const artist = artistResult.data;
    const tracks = tracksResult.data ?? [];

    // [3] Grand batch parallèle — tout ce qui dépend de album.id ou user.id
    const [
        listsContaining,
        userLists,
        publicListsContaining,
        genresData,
        albumMeta,
        similarAlbums,
        artistAlbumsData,
        albumStatsResp,
        followsResp,
        myEntriesResp,
        reviewsPreview,
        tracksStats,
    ] = await Promise.all([
        user ? getUserListsContaining(album.id) : Promise.resolve([]),
        user ? getUserLists(user.id) : Promise.resolve([]),
        getPublicListsContaining(album.id, 5),
        supabase
            .from("album_genres")
            .select("weight, source, genres(name)")
            .eq("album_id", id)
            .order("weight", { ascending: false })
            .limit(3),
        supabase
            .from("album_metadata")
            .select("spotify_url, apple_music_url, deezer_url, fetched_at")
            .eq("album_id", id)
            .maybeSingle(),
        getSimilarAlbums(album.id),
        album.artist_id
            ? supabase
                .from("albums")
                .select("id, title, cover_url, mbid, release_date, album_stats(listeners_count)")
                .eq("artist_id", album.artist_id)
                .neq("id", album.id)
                .order("listeners_count", { ascending: false, referencedTable: "album_stats" })
                .limit(8)
            : Promise.resolve({ data: [] }),
        supabase
            .from("album_stats")
            .select("reviews_count, avg_rating, listeners_count")
            .eq("album_id", id)
            .maybeSingle(),
        user
            ? supabase.from("follows").select("followee_id").eq("follower_id", user.id)
            : Promise.resolve({ data: null }),
        user
            ? supabase
                .from("diary_entries")
                .select("id, rating, review_body, listened_at, created_at")
                .eq("album_id", id)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: null }),
        getAlbumReviewsPreview(id, 3),
        getAlbumTracksStats(id),
    ]);

    const genres: string[] = (genresData.data ?? [])
        .flatMap((row) => (row.genres && typeof row.genres === "object" && "name" in row.genres ? [row.genres.name as string] : []));
    const genreWeights: Record<string, number> = Object.fromEntries(
        (genresData.data ?? [])
            .filter((row) => row.source === 'community' && row.genres && typeof row.genres === "object" && "name" in row.genres)
            .map((row) => [(row.genres as { name: string }).name, row.weight ?? 1])
    );
    const streamingLinks: { spotify?: string; appleMusic?: string; deezer?: string; tidal?: string } = {
        ...(albumMeta.data?.spotify_url ? { spotify: albumMeta.data.spotify_url } : {}),
        ...(albumMeta.data?.apple_music_url ? { appleMusic: albumMeta.data.apple_music_url } : {}),
        ...(albumMeta.data?.deezer_url ? { deezer: albumMeta.data.deezer_url } : {}),
    };

    const artistAlbums = artistAlbumsData.data ?? [];
    const isAdmin = user
        ? (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(user.id)
        : false;

    // Activité réseau — follows déjà dans le batch, 2 requêtes séquentielles restantes
    type NetworkListener = {
        userId: string;
        username: string;
        avatarUrl: string | null;
        rating: number | null;
        listenedAt: string | null;
        entryId: string | null;
        hasReview: boolean;
    };
    type JoinedProfile = {
        id: string;
        username: string | null;
        avatar_url: string | null;
    };
    let networkListeners: NetworkListener[] = [];
    const followeeIds = ((followsResp as any).data ?? []).map((f: { followee_id: string }) => f.followee_id);
    if (user && followeeIds.length > 0) {
        // Single query: diary_entries joined with profiles — saves one round-trip
        const [{ data: entries }, { data: followeeProfiles }] = await Promise.all([
            supabase
                .from("diary_entries")
                .select("id, user_id, rating, listened_at, review_body")
                .eq("album_id", album.id)
                .in("user_id", followeeIds)
                .order("listened_at", { ascending: false }),
            supabase
                .from("profiles")
                .select("id, username, avatar_url")
                .in("id", followeeIds),
        ]);

        const profileMap = new Map<string, JoinedProfile>(
            (followeeProfiles ?? []).map((p) => [p.id, p as JoinedProfile])
        );

        // Dédupliquer par user_id : garder l'entrée la plus récente par abonné
        const latestByUser = new Map<string, { id: string; rating: number | null; listenedAt: string; hasReview: boolean; profile: JoinedProfile }>();
        for (const e of (entries ?? [])) {
            const p = profileMap.get(e.user_id);
            if (!latestByUser.has(e.user_id) && p) {
                latestByUser.set(e.user_id, {
                    id: e.id,
                    rating: e.rating,
                    listenedAt: e.listened_at,
                    hasReview: !!(e.review_body && e.review_body.trim()),
                    profile: p,
                });
            }
        }

        networkListeners = [...latestByUser.values()].map(({ profile: p, ...entry }) => ({
            userId: p.id,
            username: p.username ?? "",
            avatarUrl: p.avatar_url ?? null,
            rating: entry.rating ?? null,
            listenedAt: entry.listenedAt ?? null,
            entryId: entry.id ?? null,
            hasReview: entry.hasReview ?? false,
        }));
    }

    // Complement with MusicBrainz if fewer than 3 artist albums in DB
    let mbArtistAlbums: Array<{ mbid: string; title: string; date: string | null; type: string | null }> = [];
    if (artistAlbums.length < 3 && artist?.mbid) {
        const mbResult = await getArtistReleases(artist.mbid);
        if (mbResult.success && mbResult.releases) {
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const excludedTitles = new Set([album.title, ...artistAlbums.map((a) => a.title)].map(norm));
            mbArtistAlbums = mbResult.releases
                .filter((r) => !excludedTitles.has(norm(r.title)))
                .slice(0, 8 - artistAlbums.length);
        }
    }

    // Stats et diary entries depuis le batch parallèle
    const albumStats = albumStatsResp.data;
    const avgRating = albumStats?.avg_rating !== undefined && albumStats?.avg_rating !== null
        ? Number(albumStats.avg_rating)
        : null;

    const stats = {
        reviews_count: albumStats?.reviews_count ?? 0,
        avg_rating: avgRating,
        listeners_count: albumStats?.listeners_count ?? 0,
    };

    let myEntries: { id: string; rating: number | null; review_body: string | null; listened_at: string; created_at: string }[] = [];
    let myLatestEntry: { id: string; rating: number | null; review_body: string | null; listened_at: string; created_at?: string } | undefined = undefined;
    const entriesData = (myEntriesResp as any).data;
    if (entriesData && entriesData.length > 0) {
        myEntries = entriesData;
        myLatestEntry = {
            id: entriesData[0].id,
            rating: entriesData[0].rating,
            review_body: entriesData[0].review_body,
            listened_at: entriesData[0].listened_at,
            created_at: entriesData[0].created_at,
        };
    }

    // T5: durée totale et nombre de pistes
    const trackCount = tracks.length;
    const totalDurationMs = tracks.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0);

    const year = album.release_date ? new Date(album.release_date).getFullYear() : undefined;

    const { src: heroCoverSrc, fallback: heroCoverFallback } = coverSrcWithFallback(album.mbid, album.cover_url);

    const albumHeroData = {
        id: album.id,
        title: album.title,
        artist: artist?.name || "Artiste inconnu",
        artistId: artist?.id,
        coverUrl: heroCoverSrc,
        coverFallback: heroCoverFallback,
        year,
        trackCount: trackCount > 0 ? trackCount : undefined,
        totalDurationMs: totalDurationMs > 0 ? totalDurationMs : undefined,
    };

    const hasGenres = genres.length > 0;
    const hasSomeLinks = !!(streamingLinks.spotify || streamingLinks.appleMusic || streamingLinks.deezer || streamingLinks.tidal);
    const hasPills = hasGenres || !!user;
    const showBothInSection = hasPills && hasSomeLinks;
    const showOnlyPillsInHero = hasPills && !hasSomeLinks;
    const showOnlyLinksInHero = hasSomeLinks && !hasPills;

    // Poll for enrichment completion when genres/streaming not yet fetched
    const enrichmentPending = !albumMeta.data?.fetched_at;

    return (
        <main className="max-w-page mx-auto px-4 pt-4 pb-24 overflow-x-hidden">
            {enrichmentPending && <EnrichmentPoller albumId={album.id} />}
            <BackButton />

            {/* ========== 1. THE ALBUM ========== */}
            <div className="mt-4 mb-6">
                <AlbumHero
                    album={albumHeroData}
                    albumId={album.id}
                    userId={user?.id}
                    userLists={userLists}
                    listsContaining={listsContaining}
                    myEntriesCount={myEntries.length}
                    autoOpenDiary={autoOpenDiary}
                    recSource={recSource}
                    albumHasGenres={hasGenres}
                    genres={hasPills ? genres : undefined}
                    genreWeights={genreWeights}
                    streamingLinks={hasSomeLinks ? streamingLinks : undefined}
                />
            </div>

            {/* ========== Mon écoute ========== */}
            {myLatestEntry && (
                <MyListenSection
                    albumId={album.id}
                    userId={user?.id}
                    entry={myLatestEntry}
                    entriesCount={myEntries.length}
                />
            )}

            {/* ========== Activité réseau ========== */}
            {networkListeners.length > 0 && (
                <div className="mb-5">
                    <NetworkListenersSection listeners={networkListeners} />
                </div>
            )}

            {/* ========== Stats ========== */}
            {(stats.avg_rating !== null || stats.listeners_count > 0 || stats.reviews_count > 0) && (
                <div className="flex w-full border-t border-b border-rule py-3 mb-10">
                    {stats.avg_rating !== null && (
                        <div className={`flex flex-col flex-1 ${(stats.listeners_count > 0 || stats.reviews_count > 0) ? 'border-r border-rule pr-4' : ''}`}>
                            <span className="font-display italic text-[26px] text-text-warm leading-none">
                                {stats.avg_rating.toFixed(1).replace('.', ',')}
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
                        <div className={`flex flex-col flex-1 ${(stats.avg_rating !== null || stats.listeners_count > 0) ? 'pl-4' : ''}`}>
                            <span className="font-display italic text-[26px] text-text-warm leading-none">{stats.reviews_count.toLocaleString()}</span>
                            <span className="text-[10.5px] uppercase tracking-[0.16em] text-text-tertiary mt-1.5">Critiques</span>
                        </div>
                    )}
                </div>
            )}

            {/* Admin tools */}
            {isAdmin && (!streamingLinks.spotify || !!album.mbid) && (
                <div className="border-t border-border-divider pt-8 mb-20">
                    {!streamingLinks.spotify && (
                        <div className="mb-4">
                            <AdminSpotifyEdit albumId={album.id} />
                        </div>
                    )}
                    {album.mbid && (
                        <div className="mb-4">
                            <AdminRefreshCover albumId={album.id} />
                        </div>
                    )}
                </div>
            )}

            {/* ========== 2. THE MUSIC ========== */}
            {(tracks?.length ?? 0) > 0 && (() => {
                const allTracks = tracks ?? [];
                const discNos = [...new Set(allTracks.map((t) => t.disc_no))].filter(Boolean).sort();
                const isMultiDisc = discNos.length > 1;
                return (
                    <section className="pt-10 mb-20">
                        <div className="mb-8">
                            <h2 className="text-h2 text-text-primary">Morceaux</h2>
                            {(trackCount > 0 || totalDurationMs > 0) && (
                                <p className="text-sm text-text-tertiary mt-1">
                                    {trackCount > 0 && `${trackCount} morceau${trackCount > 1 ? "x" : ""}`}
                                    {trackCount > 0 && totalDurationMs > 0 && " · "}
                                    {totalDurationMs > 0 && msToDuration(totalDurationMs)}
                                </p>
                            )}
                        </div>
                        {isMultiDisc ? (
                            discNos.map((disc) => {
                                const discTracks = allTracks.filter((t) => t.disc_no === disc);
                                return (
                                    <div key={disc} className="mb-8">
                                        <p className="text-label text-text-tertiary uppercase tracking-widest mb-3">
                                            Disque {disc}
                                        </p>
                                        {discTracks.map((t) => {
                                            const tStat = (tracksStats as Map<string, any>)?.get(t.id);
                                            return (
                                                <div key={t.id} className="flex items-baseline gap-4 py-2 group">
                                                    <span className="font-display italic text-accent text-[16px] w-7 text-right leading-none flex-shrink-0 tabular-nums">
                                                        {t.track_no}
                                                    </span>
                                                    <Link href={`/tracks/${t.id}`} className="flex-1 text-meta text-text-primary hover:text-[#8E6F5E] transition-colors truncate">
                                                        {t.title}
                                                    </Link>
                                                    <span className="text-text-tertiary tabular-nums flex-shrink-0 text-label">
                                                        {msToMMSS(t.duration_ms)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        ) : (
                            <div>
                                {allTracks.map((t, idx) => {
                                    const tStat = (tracksStats as Map<string, any>)?.get(t.id);
                                    return (
                                        <div key={t.id}>
                                            <div className="flex items-baseline gap-4 py-2 group">
                                                <span className="font-display italic text-accent text-[16px] w-7 text-right leading-none flex-shrink-0 tabular-nums">
                                                    {t.track_no ?? idx + 1}
                                                </span>
                                                <Link href={`/tracks/${t.id}`} className="flex-1 text-meta text-text-primary hover:text-[#8E6F5E] transition-colors truncate">
                                                    {t.title}
                                                </Link>
                                                <span className="text-text-tertiary tabular-nums flex-shrink-0 text-label">
                                                    {msToMMSS(t.duration_ms)}
                                                </span>
                                            </div>
                                            {(idx + 1) % 4 === 0 && idx < allTracks.length - 1 && (
                                                <div className="my-3" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })()}

            {/* ========== 3. OTHERS' NOTES ========== */}
            <section id="reviews" className="border-t border-border-divider pt-10 mb-20">
                <AlbumReviewSection
                    albumId={album.id}
                    reviewsCount={stats.reviews_count}
                    initialReviews={reviewsPreview}
                />
                {publicListsContaining.length > 0 && (
                    <div className="mt-8">
                        <AppearsInLists lists={publicListsContaining} />
                    </div>
                )}
            </section>

            {/* ========== 4. DU MÊME ARTISTE ========== */}
            {(artistAlbums.length > 0 || mbArtistAlbums.length > 0) && (
                <ArtistAlbumsSection
                    dbAlbums={artistAlbums}
                    mbAlbums={mbArtistAlbums}
                />
            )}

            {/* ========== 5. SIMILAR ALBUMS ========== */}
            <section className="border-t border-border-divider pt-10 mb-20">
                <h2 className="text-h2 text-text-primary mb-8">Albums similaires</h2>
                {similarAlbums.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                        {similarAlbums.map((a) => (
                            <Link key={a.id} href={`/albums/${a.id}`} className="snap-center shrink-0 w-44 sm:w-48 md:w-52 block group">
                                <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-3">
                                    {a.cover_url ? (
                                        <CoverImage
                                            src={a.cover_url}
                                            alt={a.title}
                                            width={400}
                                            height={400}
                                            className="object-cover w-full aspect-square"
                                            placeholder={<div className="w-full aspect-square bg-background-tertiary" />}
                                        />
                                    ) : (
                                        <div className="w-full aspect-square bg-background-tertiary" />
                                    )}
                                </div>
                                <p className="text-text-primary font-medium text-meta leading-snug mb-0.5 line-clamp-2 group-hover:text-[#8E6F5E] transition-colors duration-150">
                                    {a.title}
                                </p>
                                <p className="text-text-secondary text-label truncate">{a.artist}</p>
                                {a.year && <p className="text-text-tertiary text-label mt-0.5">{a.year}</p>}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-meta text-text-tertiary">Aucun album similaire trouvé pour le moment.</p>
                )}
            </section>

            <ScrollToHashClient />
        </main>
    );
}
