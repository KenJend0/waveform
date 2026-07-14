export const dynamic = 'force-dynamic';

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser, userNeedsOnboarding } from "@/lib/supabase/server";
import {
    getTrendingThisWeek,
    getForYouSuggestions,
    getDiscoveryAlbums,
    getSimilarUsers,
    getForYouTracks,
    getProfileTier,
    type TrendingAlbum,
    type ForYouAlbum,
    type DiscoveryResult,
    type SimilarUser,
    type ForYouTrack,
} from "@/app/actions/explore";
import { getPublicLists, type UserList } from "@/app/actions/lists";
import { getTrendingTracks } from "@/app/actions/track-diary";
import { type TrackWithStats } from "@/app/actions/track-diary";
import { getCuratorPick, type CuratorPick } from "@/app/actions/curator";
import StickySearchBar from "@/components/explore/StickySearchBar";
import PourToiSection from "@/components/explore/PourToiSection";
import OnboardingCTASection from "@/components/auth/OnboardingCTASection";
import DiscoverySection from "@/components/explore/DiscoverySection";
import SimilarUsersSection from "@/components/user/SimilarUsersSection";
import TrendingSection from "@/components/explore/TrendingSection";
import CuratorPickSection from "@/components/explore/CuratorPickSection";
import ListCard from "@/components/lists/ListCard";

function CommunityListsSection({ lists, compact = false }: { lists: UserList[]; compact?: boolean }) {
    if (lists.length === 0) return null;

    return (
        <section>
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-h2 text-text-primary">
                        Listes <em className="italic text-accent-deep">populaires</em>
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Sélections musicales partagées par la communauté.
                    </p>
                </div>
                <Link
                    href="/lists"
                    className="font-display italic text-sm text-accent border-b border-accent pb-px shrink-0 hover:text-accent-deep hover:border-accent-deep transition-colors mt-1"
                >
                    voir tout
                </Link>
            </div>
            <div className={compact ? "grid grid-cols-2 gap-4" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"}>
                {lists.map((list) => (
                    <ListCard
                        key={list.id}
                        list={list}
                        href={`/lists/${list.id}`}
                    />
                ))}
            </div>
        </section>
    );
}

export default async function ExplorePage() {
    const user = await getAuthUser();
    if (user && await userNeedsOnboarding(user.id)) {
        redirect('/onboarding');
    }

    const tier = await getProfileTier();
    const isEstablished = tier === 'established';

    let trending: TrendingAlbum[] = [];
    let forYou: ForYouAlbum[] = [];
    let forYouTracks: ForYouTrack[] = [];
    let discovery: DiscoveryResult = { albums: [], mode: 'discover', hasTasteProfile: false };
    let similarUsers: SimilarUser[] = [];
    let trendingTracks: TrackWithStats[] = [];
    let communityLists: UserList[] = [];
    let curatorPick: CuratorPick | null = null;

    try {
        [trending, forYou, forYouTracks, discovery, similarUsers, trendingTracks, communityLists, curatorPick] = await Promise.all([
            getTrendingThisWeek(10),
            isEstablished ? getForYouSuggestions(4) : Promise.resolve([]),
            isEstablished ? getForYouTracks(4) : Promise.resolve([]),
            getDiscoveryAlbums(10),
            isEstablished ? getSimilarUsers(4) : Promise.resolve([]),
            getTrendingTracks(10),
            getPublicLists(6),
            getCuratorPick(),
        ]);
    } catch (err) {
        console.error("Explore data fetch failed:", err);
    }

    const isEmpty = trending.length === 0 && trendingTracks.length === 0 && communityLists.length === 0 && !curatorPick;

    return (
        <div>
            <div className="mx-auto max-w-6xl pt-6 lg:pt-8">
                <StickySearchBar />
            </div>

            <main className="mx-auto max-w-6xl px-6 lg:px-8 pb-28 lg:pb-10">
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
                    <>
                        <div className="space-y-12 lg:hidden">
                            {tier === 'established' && <PourToiSection albums={forYou} tracks={forYouTracks} />}
                            {tier === 'new' && <OnboardingCTASection />}
                            {curatorPick && <CuratorPickSection pick={curatorPick} />}
                            <TrendingSection albums={trending} tracks={trendingTracks} />
                            <DiscoverySection result={discovery} />
                            <CommunityListsSection lists={communityLists} />
                            {tier === 'established' && <SimilarUsersSection users={similarUsers} />}
                        </div>

                        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:items-start">
                            <div className="min-w-0 space-y-12">
                                {tier === 'established' && <PourToiSection albums={forYou} tracks={forYouTracks} />}
                                {tier === 'new' && <OnboardingCTASection />}
                                <TrendingSection albums={trending} tracks={trendingTracks} />
                                <DiscoverySection result={discovery} />
                            </div>

                            <aside className="sticky top-24 space-y-10">
                                {curatorPick && <CuratorPickSection pick={curatorPick} variant="compact" />}
                                <CommunityListsSection lists={communityLists.slice(0, 4)} compact />
                                {tier === 'established' && <SimilarUsersSection users={similarUsers} />}
                            </aside>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
