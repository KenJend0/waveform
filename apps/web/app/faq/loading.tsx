// La page /faq rend LegalPageShell directement (hors du layout légal),
// donc ce loading reproduit toute la structure du shell.
export default function Loading() {
    return (
        <div className="min-h-screen bg-background animate-pulse">
            <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
                {/* Shell: BackButton + "Waveform" label */}
                <div className="mb-8">
                    <div className="h-4 w-16 bg-background-secondary rounded mb-6" />
                    <div className="h-3 w-20 bg-background-secondary rounded" />
                </div>

                {/* h1 "FAQ" */}
                <div className="h-8 bg-background-secondary rounded-[8px] w-20 mb-10" />

                {/* Catégorie 1 — ~6 questions */}
                <div className="mb-10">
                    <div className="h-5 bg-background-secondary rounded w-48 mb-6" />
                    <div className="space-y-5">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="border-b border-border-divider pb-5">
                                <div className="h-3.5 bg-background-secondary rounded w-5/6 mb-3" />
                                <div className="space-y-1.5">
                                    <div className="h-3 bg-background-secondary rounded w-full" />
                                    <div className="h-3 bg-background-secondary rounded w-4/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Catégorie 2 — ~4 questions */}
                <div className="mb-10">
                    <div className="h-5 bg-background-secondary rounded w-40 mb-6" />
                    <div className="space-y-5">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="border-b border-border-divider pb-5">
                                <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-3" />
                                <div className="space-y-1.5">
                                    <div className="h-3 bg-background-secondary rounded w-full" />
                                    <div className="h-3 bg-background-secondary rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer nav */}
                <div className="mt-16 pt-8 border-t border-border-divider">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                        {[64, 48, 80, 100, 72].map((w, i) => (
                            <div key={i} className="h-3.5 bg-background-secondary rounded" style={{ width: w }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
