import { createSupabaseAnon } from "@/lib/supabase/server";

// Revalidate every hour — explore shows public trending data, no user-specific content
export const revalidate = 3600;
import DiscoverCard from "@/components/DiscoverCard";
import SearchOverlay from "@/components/SearchOverlay";

type DiscoverItem = {
    id: string;
    album_id: string;
    album_title: string;
    artist_name: string;
    cover_url: string;
    discover_kind: string;
    score?: number;
    reason?: string;
    category?: string;
    algo?: string;
};

async function getTrendingThisWeek(): Promise<DiscoverItem[]> {
    const supabase = createSupabaseAnon();
    const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch diary entries created in the last 7 days (public only)
    const { data: recentEntries } = await supabase
        .from("diary_entries")
        .select("album_id, albums(id, title, cover_url, artists(name))")
        .gte("created_at", sevenDaysAgo)
            .eq("is_public", true)
            .limit(100);

    // Fetch albums saved in the last 7 days
    const { data: recentSaves } = await supabase
        .from("saved_albums")
        .select("album_id, albums(id, title, cover_url, artists(name))")
        .gte("saved_at", sevenDaysAgo)
            .limit(100);

    // Aggregate activity count per album
    const albumScores = new Map<
        string,
        { score: number; title: string; artist_name: string; cover_url: string | null }
    >();

    for (const entry of recentEntries || []) {
        const album = entry.albums as any;
        if (!album?.id) continue;
        const existing = albumScores.get(album.id);
        if (existing) {
            existing.score += 1;
        } else {
            albumScores.set(album.id, {
                score: 1,
                title: album.title || "Unknown",
                artist_name: album.artists?.name || "Unknown",
                cover_url: album.cover_url,
            });
        }
    }

    for (const save of recentSaves || []) {
        const album = save.albums as any;
        if (!album?.id) continue;
        const existing = albumScores.get(album.id);
        if (existing) {
            existing.score += 1;
        } else {
            albumScores.set(album.id, {
                score: 1,
                title: album.title || "Unknown",
                artist_name: album.artists?.name || "Unknown",
                cover_url: album.cover_url,
            });
        }
    }

    // Sort by score descending, take top 10
    return [...albumScores.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 10)
        .map(([albumId, info]) => ({
            id: `trending-${albumId}`,
            album_id: albumId,
            album_title: info.title,
            artist_name: info.artist_name,
            cover_url: info.cover_url || "",
            discover_kind: "trending_week",
            score: info.score,
        }));
}

async function getNewOnWaveform(): Promise<DiscoverItem[]> {
    const supabase = createSupabaseAnon();

    // Albums most recently added to the Waveform catalog
    const { data: newAlbums } = await supabase
        .from("albums")
        .select("id, title, cover_url, artists(name), created_at")
        .order("created_at", { ascending: false })
        .limit(10);

    if (!newAlbums) return [];

    return newAlbums.map((album) => ({
        id: `new-${album.id}`,
        album_id: album.id,
        album_title: album.title || "Unknown",
        artist_name: (album.artists as any)?.name || "Unknown",
        cover_url: album.cover_url || "",
        discover_kind: "new_release",
    }));
}

export default async function ExplorePage() {
    let trending: DiscoverItem[] = [];
    let newOnWaveform: DiscoverItem[] = [];

    try {
        [trending, newOnWaveform] = await Promise.all([
            getTrendingThisWeek(),
            getNewOnWaveform(),
        ]);
    } catch (err) {
        // In case of Supabase/network errors, fall back to empty lists so UI shows the friendly onboarding state.
        // This avoids an empty-explore experience for new users when the backend refresh script hasn't run.
        // Server-side logs are useful to investigate the root cause.
        // eslint-disable-next-line no-console
        console.error("Explore data fetch failed:", err);
        trending = [];
        newOnWaveform = [];
    }

    const isEmpty = trending.length === 0 && newOnWaveform.length === 0;

    return (
        <>
            <section className="px-6 pt-safe pb-6 max-w-page mx-auto">
                <h1 className="text-h1 text-text-primary mb-2">
                    Explorer
                </h1>
                <p className="text-text-secondary text-[14px]">
                    Albums partagés, écoutés ou découverts récemment.
                </p>
            </section>

            <div className="bg-background border-b border-border-divider">
                <div className="px-6 pb-3 max-w-page mx-auto">
                    <SearchOverlay />
                </div>
            </div>

            <main className="p-6 pb-20 max-w-page mx-auto">
                {isEmpty ? (
                    <div className="text-center py-16 space-y-6">
                        <div className="space-y-3">
                            <p className="text-[16px] text-text-primary font-medium">
                                Bienvenue sur Waveform !
                            </p>
                            <p className="text-[14px] text-text-secondary max-w-md mx-auto">
                                Commencez à découvrir de la musique en recherchant vos albums et artistes préférés.
                            </p>
                        </div>
                        <div className="pt-4">
                            <p className="text-[12px] text-text-tertiary mb-4">
                                💡 Utilisez la barre de recherche ci-dessus pour trouver n&apos;importe quel album ou artiste
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Trending this week */}
                        <section>
                            <div className="mb-5">
                                <h2 className="text-h2 text-text-primary mb-2">
                                    Écoutés cette semaine
                                </h2>

                            </div>
                            {trending.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                                    {trending.map((item) => (
                                        <div
                                            key={item.id}
                                            className="snap-center shrink-0 w-44 sm:w-48 md:w-52"
                                        >
                                            <DiscoverCard item={item} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-tertiary text-[14px]">
                                    Rien pour le moment.
                                </p>
                            )}
                        </section>

                        {/* New on Waveform */}
                        <section>
                            <div className="mb-5">
                                <h2 className="text-h2 text-text-primary mb-2">
                                    Récemment ajoutés
                                </h2>

                            </div>
                            {newOnWaveform.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
                                    {newOnWaveform.map((item) => (
                                        <div
                                            key={item.id}
                                            className="snap-center shrink-0 w-44 sm:w-48 md:w-52"
                                        >
                                            <DiscoverCard item={item} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-tertiary text-[14px]">
                                    Rien pour le moment.
                                </p>
                            )}
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}

