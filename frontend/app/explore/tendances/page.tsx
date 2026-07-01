export const dynamic = 'force-dynamic';

import BackButton from "@/components/ui/BackButton";
import { getTrendingThisWeek } from "@/app/actions/explore";
import { getTrendingTracks } from "@/app/actions/track-diary";
import TendancesContent from "./TendancesContent";
import { type TrendingAlbum } from "@/app/actions/explore";
import { type TrackWithStats } from "@/app/actions/track-diary";

export default async function TendancesPage() {
    let albums: TrendingAlbum[] = [];
    let tracks: TrackWithStats[] = [];

    try {
        [albums, tracks] = await Promise.all([
            getTrendingThisWeek(20),
            getTrendingTracks(20),
        ]);
    } catch (err) {
        console.error("Tendances fetch failed:", err);
    }

    return (
        <>
            <section className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 max-w-page lg:max-w-5xl mx-auto">
                <BackButton label="Explorer" fallbackHref="/explore" className="mb-4" />
                <h1 className="text-h1 text-text-primary mb-1">Tendances</h1>
                <p className="text-[14px] text-text-secondary">
                    Ce que la communauté écoute en ce moment.
                </p>
            </section>

            <main className="px-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
                <TendancesContent albums={albums} tracks={tracks} />
            </main>
        </>
    );
}
