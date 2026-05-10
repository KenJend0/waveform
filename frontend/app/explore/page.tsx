import { createSupabaseAnon } from "@/lib/supabase/server";
import { getForYouSuggestions, getDiscoveryAlbums, getSimilarUsers, type ForYouAlbum, type DiscoveryAlbum, type SimilarUser } from "@/app/actions/explore";
import DiscoverCard from "@/components/DiscoverCard";
import SearchOverlay from "@/components/SearchOverlay";
import PourToiSection from "@/components/PourToiSection";
import DiscoverySection from "@/components/DiscoverySection";
import SimilarUsersSection from "@/components/SimilarUsersSection";

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


export default async function ExplorePage() {
    let trending: DiscoverItem[] = [];
    let forYou: ForYouAlbum[] = [];
    let discovery: DiscoveryAlbum[] = [];
    let similarUsers: SimilarUser[] = [];

    try {
        [trending, forYou, discovery, similarUsers] = await Promise.all([
            getTrendingThisWeek(),
            getForYouSuggestions(),
            getDiscoveryAlbums(),
            getSimilarUsers(4),
        ]);
    } catch (err) {
        console.error("Explore data fetch failed:", err);
    }

    const isEmpty = trending.length === 0;

    return (
        <>
            <section className="px-6 pt-safe pb-6 max-w-page lg:max-w-5xl mx-auto">
                <h1 className="text-h1 text-text-primary mb-2">
                    Explorer
                </h1>
                <p className="text-text-secondary text-[14px]">
                    Albums partagés, écoutés ou découverts récemment.
                </p>
            </section>

            <div className="bg-background border-b border-border-divider">
                <div className="px-6 pb-3 max-w-page lg:max-w-5xl mx-auto">
                    <SearchOverlay />
                </div>
            </div>

            <main className="p-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
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
                        {/* Pour toi — suggestions personnalisées */}
                        <PourToiSection albums={forYou} />

                        {/* Goûts similaires */}
                        <SimilarUsersSection users={similarUsers} />

                        {/* Trending this week */}
                        <section>
                            <div className="mb-5">
                                <h2 className="text-h2 text-text-primary mb-2">
                                    Écoutés cette semaine
                                </h2>

                            </div>
                            {trending.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                                    {trending.map((item) => (
                                        <div
                                            key={item.id}
                                            className="snap-center shrink-0 w-44 sm:w-48 md:w-52 lg:w-60"
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

                        {/* Découverte — artistes inconnus de l'utilisateur, bien notés */}
                        <DiscoverySection albums={discovery} />
                    </div>
                )}
            </main>
        </>
    );
}

