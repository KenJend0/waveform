import BackButton from "@/components/BackButton";
import { msToMMSS } from "@/lib/time";
import { createSupabaseServer, getAuthUser } from "@/lib/supabase/server";
import { isAlbumSaved } from "@/app/actions/saved-albums";
import AlbumHero from "@/components/AlbumHero";
import AlbumReviewSection from "@/components/AlbumReviewSection";
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
        .select("id, title, cover_url, release_date, artist_id")
        .eq("id", id)
        .maybeSingle();

    if (!album) {
        return (
            <main className="max-w-page mx-auto px-4 py-8 pb-24">
                <BackButton />
                <div className="mt-section-sm text-text-tertiary text-meta">Album introuvable</div>
            </main>
        );
    }

    // Fetch artist
    const { data: artist } = await supabase
        .from("artists")
        .select("id, name")
        .eq("id", album.artist_id)
        .maybeSingle();

    // Fetch tracks
    const { data: tracks = [] } = await supabase
        .from("tracks")
        .select("id, title, duration_ms, track_no, disc_no")
        .eq("album_id", id)
        .order("disc_no", { ascending: true, nullsFirst: true })
        .order("track_no", { ascending: true, nullsFirst: true });

    // Get current user and album saved status
    const user = await getAuthUser();
    const albumSaved = user ? await isAlbumSaved(album.id) : false;

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
            <div className="mt-8 mb-20">
                <AlbumHero
                    album={albumHeroData}
                    albumId={album.id}
                    isSaved={albumSaved}
                    userId={user?.id}
                    stats={stats}
                    myLatestEntry={myLatestEntry}
                    myEntriesCount={myEntries.length}
                    autoOpenDiary={autoOpenDiary}
                />
            </div>

            {/* ========== 2. THE MUSIC ========== */}
            {(tracks?.length ?? 0) > 0 && (
                <section className="border-t border-border-divider pt-10 mb-20">
                    <h2 className="text-h2 text-text-primary mb-8">Morceaux</h2>
                    <div>
                        {(tracks ?? []).map((t, idx) => (
                            <div key={t.id}>
                                <div className="flex items-baseline gap-4 py-2">
                                    <span className="text-text-tertiary tabular-nums flex-shrink-0 w-6 text-right text-[12px]">
                                        {t.track_no ?? idx + 1}
                                    </span>
                                    <span className="flex-1 text-[14px] text-text-primary">
                                        {t.title}
                                    </span>
                                    <span className="text-text-tertiary tabular-nums flex-shrink-0 text-[12px]">
                                        {msToMMSS(t.duration_ms)}
                                    </span>
                                </div>
                                {(idx + 1) % 4 === 0 && idx < (tracks?.length ?? 0) - 1 && (
                                    <div className="my-3" />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ========== 3. OTHERS' NOTES ========== */}
            <section id="reviews" className="border-t border-border-divider pt-10 mb-20">
                <AlbumReviewSection albumId={album.id} reviewsCount={stats.reviews_count} />
            </section>

            <ScrollToHashClient />
        </main>
    );
}
