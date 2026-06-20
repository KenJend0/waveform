export const dynamic = 'force-dynamic';

import { getAuthUser } from "@/lib/supabase/server";
import { getTrendingThisWeek, getForYouSuggestions, getDiscoveryAlbums, getSimilarUsers, getForYouTracks } from "@/app/actions/explore";
import { getPublicLists, type UserList } from "@/app/actions/lists";
import { getTrendingTracks } from "@/app/actions/track-diary";
import StickySearchBar from "@/components/explore/StickySearchBar";
import PourToiSection from "@/components/PourToiSection";
import DiscoverySection from "@/components/DiscoverySection";
import SimilarUsersSection from "@/components/SimilarUsersSection";
import TrendingSection from "@/components/TrendingSection";
import ListCard from "@/components/ListCard";
import { type TrendingAlbum, type ForYouAlbum, type DiscoveryAlbum, type SimilarUser, type ForYouTrack } from "@/app/actions/explore";
import { type TrackWithStats } from "@/app/actions/track-diary";

export default async function ExplorePage() {
    const authUser = await getAuthUser();
    const isLoggedIn = !!authUser;

    let trending: TrendingAlbum[] = [];
    let forYou: ForYouAlbum[] = [];
    let forYouTracks: ForYouTrack[] = [];
    let discovery: DiscoveryAlbum[] = [];
    let similarUsers: SimilarUser[] = [];
    let trendingTracks: TrackWithStats[] = [];
    let communityLists: UserList[] = [];

    try {
        [trending, forYou, forYouTracks, discovery, similarUsers, trendingTracks, communityLists] = await Promise.all([
            getTrendingThisWeek(10),
            isLoggedIn ? getForYouSuggestions(6) : Promise.resolve([]),
            isLoggedIn ? getForYouTracks(6) : Promise.resolve([]),
            isLoggedIn ? getDiscoveryAlbums(10) : Promise.resolve([]),
            isLoggedIn ? getSimilarUsers(4) : Promise.resolve([]),
            getTrendingTracks(10),
            getPublicLists(6),
        ]);
    } catch (err) {
        console.error("Explore data fetch failed:", err);
    }

    const isEmpty = trending.length === 0 && trendingTracks.length === 0 && communityLists.length === 0;

    return (
        <div>
            <section className="px-6 lg:px-8 pt-6 lg:pt-8 pb-5">
                <h1 className="text-h1 text-text-primary mb-2">
                    Découvrir
                </h1>
                <p className="text-text-secondary text-meta">
                    Découvre de la musique, des listes et des profils qui correspondent à tes goûts.
                </p>
            </section>

            <StickySearchBar />

            <main className="px-6 lg:px-8 pb-28 lg:pb-10">
                {isEmpty ? (
                    <div className="text-center py-16 space-y-6">
                        <div className="space-y-3">
                            <p className="text-body text-text-primary font-medium">
                                Bienvenue sur Waveform !
                            </p>
                            <p className="text-meta text-text-secondary max-w-md mx-auto">
                                Commence à découvrir de la musique en recherchant tes albums et artistes préférés.
                            </p>
                        </div>
                        <p className="text-label text-text-tertiary">
                            Utilise la barre de recherche ci-dessus pour trouver n&apos;importe quel album ou artiste
                        </p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Pour toi — recommandations personnalisées (connecté seulement) */}
                        {isLoggedIn && <PourToiSection albums={forYou} tracks={forYouTracks} />}

                        {/* Tendances — albums + titres populaires cette semaine */}
                        <TrendingSection albums={trending} tracks={trendingTracks} />

                        {/* Hors de ta bulle — artistes inconnus bien notés (connecté seulement) */}
                        {isLoggedIn && <DiscoverySection albums={discovery} />}

                        {/* Listes de la communauté */}
                        {communityLists.length > 0 && (
                            <section>
                                <div className="mb-5">
                                    <h2 className="text-h2 text-text-primary">
                                        Listes <em className="italic text-accent-deep">populaires</em>
                                    </h2>
                                    <p className="text-sm text-text-secondary mt-1">
                                        Sélections musicales partagées par la communauté.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {communityLists.map((list) => (
                                        <ListCard
                                            key={list.id}
                                            list={list}
                                            href={`/lists/${list.id}`}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Goûts similaires (connecté seulement) */}
                        {isLoggedIn && <SimilarUsersSection users={similarUsers} />}
                    </div>
                )}
            </main>
        </div>
    );
}
