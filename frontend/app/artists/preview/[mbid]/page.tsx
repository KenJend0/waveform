import BackButton from "@/components/BackButton";
import { getArtistReleases, fetchArtistMetadata } from "@/app/actions/musicbrainz";
import { ArtistPageContent } from "@/components/ArtistPageContent";

export default async function ArtistPreviewPage({
    params,
}: {
    params: Promise<{ mbid: string }>;
}) {
    const { mbid } = await params;

    // Fetch artist metadata and releases in parallel (no cover fetching = fast)
    const [meta, relResult] = await Promise.all([
        fetchArtistMetadata(mbid),
        getArtistReleases(mbid),
    ]);

    if (!meta.name) {
        throw new Error("Failed to preview artist");
    }

    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24">
            <BackButton />
            <ArtistPageContent
                previewName={meta.name}
                previewMbid={mbid}
                previewCountry={meta.country ?? undefined}
                previewType={meta.type ?? undefined}
                imageUrl={meta.imageUrl}
                mbReleases={relResult.releases || []}
            />
        </main>
    );
}
