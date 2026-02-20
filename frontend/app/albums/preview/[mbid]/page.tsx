import BackButton from "@/components/BackButton";
import { msToMMSS } from "@/lib/time";
import { previewAlbumFromMusicBrainz } from "@/app/actions/musicbrainz";
import ImportButton from "@/components/ImportButton";

export default async function AlbumPreviewPage({
    params,
}: {
    params: Promise<{ mbid: string }>;
}) {
    const { mbid } = await params;

    const result = await previewAlbumFromMusicBrainz(mbid);

    if (!result.success || !result.preview) {
        throw new Error(result.error ?? "Failed to preview album");
    }

    const preview = result.preview;

    const year = preview.date ? Number(preview.date.slice(0, 4)) : null;
    const trackCount = preview.tracks.length;

    return (
        <main className="max-w-page mx-auto px-4 md:px-6 py-8 pb-24">
            <BackButton />

            {/* ========== 1. ALBUM ========== */}
            <div className="mt-8 mb-24">
                <div className="flex flex-col md:flex-row md:gap-12 md:items-start gap-6">
                    {/* Cover */}
                    <div className="flex-shrink-0 w-full md:w-48">
                        {preview.coverUrl ? (
                            <div className="rounded-[10px] overflow-hidden aspect-square w-full max-w-48 mx-auto md:mx-0">
                                <img
                                    src={preview.coverUrl}
                                    alt={preview.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="rounded-[10px] bg-background-tertiary aspect-square w-full max-w-48 mx-auto md:mx-0 flex items-center justify-center">
                                <span className="text-text-tertiary text-[12px]">Pas de couverture</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Title + Artist + Year + Meta */}
                    <div className="flex-1">
                        <h1 className="text-[24px] font-medium text-text-primary mb-2 leading-tight">
                            {preview.title}
                        </h1>
                        <div className="text-[16px] text-text-secondary mb-4">
                            <span className="font-medium">{preview.artist}</span>
                            {year ? ` · ${year}` : null}
                        </div>

                        <div className="text-[14px] text-text-tertiary">
                            {trackCount} morceau{trackCount !== 1 ? "x" : ""}
                        </div>

                        <div className="text-[12px] text-text-tertiary mt-2">
                            Non importé
                        </div>

                        <div className="mt-6">
                            <ImportButton albumId={preview.mbid} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== 2. MORCEAUX ========== */}
            {trackCount > 0 && (
                <section className="border-t border-border-divider pt-12 mb-24">
                    <h2 className="text-h2 text-text-primary mb-10">
                        Morceaux
                    </h2>
                    <div>
                        {preview.tracks.map((track, idx) => (
                            <div key={track.mbid || `track-${track.position}-${track.title}`}>
                                <div className="flex items-baseline gap-4 py-2">
                                    <span className="text-text-disabled tabular-nums flex-shrink-0 w-6 text-right text-[12px]">
                                        {track.position ?? idx + 1}
                                    </span>
                                    <span className="flex-1 text-[14px] text-text-primary truncate">
                                        {track.title}
                                    </span>
                                    <span className="text-text-tertiary tabular-nums flex-shrink-0 text-[12px]">
                                        {track.duration != null ? msToMMSS(track.duration) : "—"}
                                    </span>
                                </div>
                                {(idx + 1) % 4 === 0 && idx < trackCount - 1 && (
                                    <div className="my-4" />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
}
