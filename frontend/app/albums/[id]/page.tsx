import { notFound } from "next/navigation";
import BackButton from "@/components/BackButton";
import { msToMMSS } from "@/lib/time";
import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";
import { isAlbumSaved } from "@/app/actions/saved-albums";
import { getAlbumStreamingLinks, getArtistReleases } from "@/app/actions/musicbrainz";
import { getSimilarAlbums } from "@/app/actions/metadata";
import Link from "next/link";
import Image from "next/image";
import AlbumHero from "@/components/AlbumHero";
import AlbumReviewSection from "@/components/AlbumReviewSection";
import ArtistAlbumsSection from "@/components/ArtistAlbumsSection";
import DescriptionCollapse from "@/components/DescriptionCollapse";
import ScrollToHashClient from "@/components/ScrollToHashClient";

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ addToDiary?: string }>;
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
    const supabase = await createSupabaseServer();

    // Fetch album
    const { data: album } = await supabase
        .from("albums")
        .select("id, title, cover_url, release_date, artist_id, mbid")
        .eq("id", id)
        .maybeSingle();

    if (!album) notFound();

    // Fetch artist
    const { data: artist } = await supabase
        .from("artists")
        .select("id, name, mbid")
        .eq("id", album.artist_id)
        .maybeSingle();

    // Fetch tracks
    const { data: tracks = [] } = await supabase
        .from("tracks")
        .select("id, title, duration_ms, track_no, disc_no")
        .eq("album_id", id)
        .order("disc_no", { ascending: true, nullsFirst: true })
        .order("track_no", { ascending: true, nullsFirst: true });

    // Get current user and album saved status + streaming links + metadata in parallel
    const user = await getAuthUser();
    const [albumSaved, streamingLinks, genresData, albumMeta, similarAlbums, artistAlbumsData] = await Promise.all([
        user ? isAlbumSaved(album.id) : Promise.resolve(false),
        album.mbid ? getAlbumStreamingLinks(album.mbid) : Promise.resolve({} as import("@/app/actions/musicbrainz").StreamingLinks),
        supabase
            .from("album_genres")
            .select("weight, genres(name)")
            .eq("album_id", id)
            .order("weight", { ascending: false })
            .limit(3),
        supabase
            .from("album_metadata")
            .select("description, spotify_url")
            .eq("album_id", id)
            .maybeSingle(),
        getSimilarAlbums(album.id),
        album.artist_id
            ? supabase
                .from("albums")
                .select("id, title, cover_url, release_date")
                .eq("artist_id", album.artist_id)
                .neq("id", album.id)
                .order("release_date", { ascending: false })
                .limit(8)
            : Promise.resolve({ data: [] }),
    ]);

    const genres: string[] = (genresData.data ?? [])
        .flatMap((row) => (row.genres && typeof row.genres === "object" && "name" in row.genres ? [row.genres.name as string] : []));
    const description: string | null = albumMeta.data?.description ?? null;
    // Lien Spotify manuel (admin) prend la priorité sur MusicBrainz
    if (albumMeta.data?.spotify_url) {
        streamingLinks.spotify = albumMeta.data.spotify_url;
    }
    const artistAlbums = artistAlbumsData.data ?? [];

    // Activité réseau : abonnés ayant écouté cet album
    type NetworkListener = { userId: string; username: string; displayName: string | null; avatarUrl: string | null };
    let networkListeners: NetworkListener[] = [];
    if (user) {
        const { data: follows } = await supabase
            .from("follows")
            .select("followee_id")
            .eq("follower_id", user.id);
        const followeeIds = (follows ?? []).map((f) => f.followee_id);
        if (followeeIds.length > 0) {
            const { data: entries } = await supabase
                .from("diary_entries")
                .select("user_id")
                .eq("album_id", album.id)
                .in("user_id", followeeIds);
            const listenerIds = [...new Set((entries ?? []).map((e) => e.user_id))];
            if (listenerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, username, display_name, avatar_url")
                    .in("id", listenerIds.slice(0, 5));
                networkListeners = (profiles ?? []).map((p) => ({
                    userId: p.id,
                    username: p.username ?? "",
                    displayName: p.display_name ?? null,
                    avatarUrl: p.avatar_url ?? null,
                }));
            }
        }
    }

    // Complement with MusicBrainz if fewer than 3 artist albums in DB
    let mbArtistAlbums: Array<{ mbid: string; title: string; date: string | null; type: string | null }> = [];
    if (artistAlbums.length < 3 && artist?.mbid) {
        const mbResult = await getArtistReleases(artist.mbid);
        if (mbResult.success && mbResult.releases) {
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            // Exclude: current album + all albums already in DB (MB uses release-group MBIDs, album.mbid is release MBID — can't compare directly)
            const excludedTitles = new Set([album.title, ...artistAlbums.map((a) => a.title)].map(norm));
            mbArtistAlbums = mbResult.releases
                .filter((r) => !excludedTitles.has(norm(r.title)))
                .slice(0, 8 - artistAlbums.length);
        }
    }

    // Fetch stats from DB view (latest entry per user)
    const { data: albumStats } = await supabase
        .from("album_stats")
        .select("reviews_count, avg_rating, listeners_count")
        .eq("album_id", id)
        .maybeSingle();

    const avgRating = albumStats?.avg_rating !== undefined && albumStats?.avg_rating !== null
        ? Number(albumStats.avg_rating)
        : null;

    const stats = {
        reviews_count: albumStats?.reviews_count ?? 0,
        avg_rating: avgRating,
        listeners_count: albumStats?.listeners_count ?? 0,
    };

    // Fetch user's own entries for this album
    let myEntries: { id: string; rating: number | null; review_body: string | null; listened_at: string; created_at: string }[] = [];
    let myLatestEntry: { id: string; rating: number | null; review_body: string | null; listened_at: string; created_at?: string } | undefined = undefined;
    if (user) {
        const { data: entriesData } = await supabase
            .from("diary_entries")
            .select("id, rating, review_body, listened_at, created_at")
            .eq("album_id", id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

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
    }

    const year = album.release_date ? new Date(album.release_date).getFullYear() : undefined;

    const albumHeroData = {
        id: album.id,
        title: album.title,
        artist: artist?.name || "Artiste inconnu",
        artistId: artist?.id,
        coverUrl: album.cover_url,
        year,
    };

    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24 overflow-x-hidden">
            <BackButton />

            {/* ========== 1. THE ALBUM ========== */}
            <div className="mt-8 mb-6">
                <AlbumHero
                    album={albumHeroData}
                    albumId={album.id}
                    isSaved={albumSaved}
                    userId={user?.id}
                    stats={stats}
                    myLatestEntry={myLatestEntry}
                    myEntriesCount={myEntries.length}
                    autoOpenDiary={autoOpenDiary}
                    albumHasGenres={genres.length > 0}
                    genres={genres.length > 0 && !description && Object.keys(streamingLinks).length === 0 ? genres : undefined}
                    networkListeners={networkListeners}
                />
            </div>

            {/* ========== 1B. ALBUM INFO + DESCRIPTION ========== */}
            {/* 1B only renders when there's streaming links or description (genres-only → go to hero) */}
            {(Object.keys(streamingLinks).length > 0 || !!description) && (
                <div className="border-t border-border-divider pt-8 mb-20">
                    {(genres.length > 0 || Object.keys(streamingLinks).length > 0) && (
                        <div className="mb-6">
                            {genres.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap mb-4">
                                    <span className="text-[12px] text-text-tertiary">Genres</span>
                                    {genres.map((g) => (
                                        <span
                                            key={g}
                                            className="text-[11px] text-text-tertiary bg-background-secondary rounded-full px-2.5 py-0.5 capitalize"
                                        >
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {Object.keys(streamingLinks).length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[12px] text-text-tertiary">Écouter sur</span>
                                    {[
                                        { key: "spotify", label: "Spotify", href: streamingLinks.spotify },
                                        { key: "appleMusic", label: "Apple Music", href: streamingLinks.appleMusic },
                                        { key: "deezer", label: "Deezer", href: streamingLinks.deezer },
                                        { key: "tidal", label: "Tidal", href: streamingLinks.tidal },
                                    ]
                                        .filter((s) => s.href)
                                        .map((s, i, arr) => (
                                            <span key={s.key} className="flex items-center gap-2">
                                                <a
                                                    href={s.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[12px] text-text-secondary hover:text-text-primary transition-colors duration-150"
                                                >
                                                    {s.label}
                                                </a>
                                                {i < arr.length - 1 && (
                                                    <span className="text-[12px] text-text-disabled">·</span>
                                                )}
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {description && <DescriptionCollapse text={description} />}
                </div>
            )}

            {/* ========== 2. THE MUSIC ========== */}
            {(tracks?.length ?? 0) > 0 && (() => {
                const allTracks = tracks ?? [];
                const discNos = [...new Set(allTracks.map((t) => t.disc_no))].filter(Boolean).sort();
                const isMultiDisc = discNos.length > 1;
                return (
                    <section className="border-t border-border-divider pt-10 mb-20">
                        <h2 className="text-h2 text-text-primary mb-8">Morceaux</h2>
                        {isMultiDisc ? (
                            discNos.map((disc) => {
                                const discTracks = allTracks.filter((t) => t.disc_no === disc);
                                return (
                                    <div key={disc} className="mb-8">
                                        <p className="text-[11px] text-text-tertiary uppercase tracking-widest mb-3">
                                            Disque {disc}
                                        </p>
                                        {discTracks.map((t) => (
                                            <div key={t.id} className="flex items-baseline gap-4 py-2">
                                                <span className="text-text-tertiary tabular-nums flex-shrink-0 w-6 text-right text-[12px]">
                                                    {t.track_no}
                                                </span>
                                                <span className="flex-1 text-[14px] text-text-primary">{t.title}</span>
                                                <span className="text-text-tertiary tabular-nums flex-shrink-0 text-[12px]">
                                                    {msToMMSS(t.duration_ms)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })
                        ) : (
                            <div>
                                {allTracks.map((t, idx) => (
                                    <div key={t.id}>
                                        <div className="flex items-baseline gap-4 py-2">
                                            <span className="text-text-tertiary tabular-nums flex-shrink-0 w-6 text-right text-[12px]">
                                                {t.track_no ?? idx + 1}
                                            </span>
                                            <span className="flex-1 text-[14px] text-text-primary">{t.title}</span>
                                            <span className="text-text-tertiary tabular-nums flex-shrink-0 text-[12px]">
                                                {msToMMSS(t.duration_ms)}
                                            </span>
                                        </div>
                                        {(idx + 1) % 4 === 0 && idx < allTracks.length - 1 && (
                                            <div className="my-3" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })()}

            {/* ========== 3. OTHERS' NOTES ========== */}
            <section id="reviews" className="border-t border-border-divider pt-10 mb-20">
                <AlbumReviewSection albumId={album.id} reviewsCount={stats.reviews_count} />
            </section>

            {/* ========== 4. DU MÊME ARTISTE ========== */}
            {(artistAlbums.length > 0 || mbArtistAlbums.length > 0) && (
                <ArtistAlbumsSection
                    dbAlbums={artistAlbums}
                    mbAlbums={mbArtistAlbums}
                />
            )}

            {/* ========== 5. SIMILAR ALBUMS ========== */}
            {similarAlbums.length > 0 && (
                <section className="border-t border-border-divider pt-10 mb-20">
                    <h2 className="text-h2 text-text-primary mb-8">Albums similaires</h2>
                    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                        {similarAlbums.map((a) => (
                            <Link key={a.id} href={`/albums/${a.id}`} className="snap-center shrink-0 w-44 sm:w-48 md:w-52 block group">
                                <div className="rounded-[10px] overflow-hidden bg-background-secondary mb-3">
                                    {a.cover_url ? (
                                        <Image src={a.cover_url} alt={a.title} width={400} height={400} className="object-cover w-full aspect-square" />
                                    ) : (
                                        <div className="w-full aspect-square bg-background-tertiary" />
                                    )}
                                </div>
                                <p className="text-text-primary font-medium text-[14px] leading-snug mb-0.5 line-clamp-2 group-hover:text-[#8E6F5E] transition-colors duration-150">
                                    {a.title}
                                </p>
                                <p className="text-text-secondary text-[12px] truncate">{a.artist}</p>
                                {a.year && <p className="text-text-tertiary text-[12px] mt-0.5">{a.year}</p>}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <ScrollToHashClient />
        </main>
    );
}
