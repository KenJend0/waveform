export const dynamic = 'force-dynamic';

import BackButton from "@/components/ui/BackButton";
import { getDiscoveryAlbums, type DiscoveryResult } from "@/app/actions/explore";
import DecouverteContent from "./DecouverteContent";

export default async function DecouvertePage() {
    let result: DiscoveryResult = { albums: [], mode: 'discover', hasTasteProfile: false };

    try {
        result = await getDiscoveryAlbums(24);
    } catch (err) {
        console.error("Decouverte fetch failed:", err);
    }

    const isBubble = result.mode === 'bubble';

    return (
        <>
            <section className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 max-w-page lg:max-w-5xl mx-auto">
                <BackButton label="Explorer" fallbackHref="/explore" className="mb-4" />
                <h1 className="text-h1 text-text-primary mb-1">
                    {isBubble ? (
                        <>Hors de ta <em className="font-display italic text-accent-deep">bulle</em></>
                    ) : (
                        <>À <em className="font-display italic text-accent-deep">découvrir</em></>
                    )}
                </h1>
                <p className="text-[14px] text-text-secondary">
                    {isBubble
                        ? "Des artistes absents de ton journal, suggérés par des comptes que tu suis."
                        : result.hasTasteProfile
                            ? "Des albums largement salués, en dehors de tes artistes habituels."
                            : "Des albums largement salués sur Waveform, pour commencer à explorer."}
                </p>
            </section>

            <main className="px-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
                <DecouverteContent albums={result.albums} />
            </main>
        </>
    );
}
