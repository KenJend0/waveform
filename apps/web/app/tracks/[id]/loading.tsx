export default function Loading() {
    return (
        <main className="max-w-page mx-auto px-4 pt-4 pb-24 animate-pulse overflow-x-hidden">
            {/* Back button */}
            <div className="h-4 w-16 bg-background-secondary rounded mb-4" />

            {/* ── Hero wrapper (flex + actions + streaming) ── identique à la page */}
            <div className="mt-4 mb-6">
                <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
                    {/* Cover */}
                    <div className="flex-shrink-0 w-full md:w-48 mb-4 md:mb-0">
                        <div className="rounded-[10px] aspect-square w-full max-w-48 mx-auto md:mx-0 bg-background-secondary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        {/* Titre */}
                        <div className="h-8 bg-background-secondary rounded w-3/4 mb-3" />
                        {/* Artiste */}
                        <div className="h-4 bg-background-secondary rounded w-1/3 mb-1.5" />
                        {/* Album · Année */}
                        <div className="h-3.5 bg-background-secondary rounded w-1/2 mb-3" />
                        {/* Genre pills */}
                        <div className="flex gap-2 mb-2">
                            <div className="h-6 w-16 bg-background-secondary rounded-full" />
                            <div className="h-6 w-20 bg-background-secondary rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Actions — toujours visibles, dans le wrapper hero */}
                <div className="flex gap-2 mt-4">
                    <div className="h-10 bg-background-secondary rounded-[10px] w-36" />
                    <div className="h-10 bg-background-secondary rounded-[10px] w-28" />
                </div>

                {/* Streaming links */}
                <div className="flex gap-3 mt-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-8 w-8 rounded-[8px] bg-background-secondary" />
                    ))}
                </div>
            </div>

            {/* Stats — bande horizontale full-width, HORS du wrapper hero */}
            <div className="flex w-full border-t border-b border-border py-3 mb-8">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className={`flex flex-col flex-1 ${i < 2 ? 'border-r border-border pr-4' : ''} ${i > 0 ? 'pl-4' : ''}`}
                    >
                        <div className="h-7 bg-background-secondary rounded w-12 mb-1.5" />
                        <div className="h-2.5 bg-background-secondary rounded w-14" />
                    </div>
                ))}
            </div>

            {/* Autres titres de l'album */}
            <div className="border-t border-border-divider mt-8 pt-8">
                <div className="flex items-baseline justify-between mb-4">
                    <div className="h-5 bg-background-secondary rounded w-44" />
                    <div className="h-3.5 bg-background-secondary rounded w-20" />
                </div>
                <div className="space-y-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-2 px-3">
                            <div className="h-4 w-5 bg-background-secondary rounded flex-shrink-0" />
                            <div className="h-3.5 bg-background-secondary rounded flex-1" style={{ maxWidth: `${50 + (i % 4) * 12}%` }} />
                            <div className="h-3 bg-background-secondary rounded w-8 shrink-0" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Critiques */}
            <div className="border-t border-border-divider mt-8 pt-8">
                <div className="h-5 bg-background-secondary rounded w-24 mb-6" />
                <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="p-4 bg-background-secondary rounded-[10px]">
                            <div className="flex gap-3">
                                <div className="w-7 h-7 rounded-full bg-background-tertiary flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 bg-background-tertiary rounded w-32" />
                                    <div className="h-3 bg-background-tertiary rounded w-full" />
                                    <div className="h-3 bg-background-tertiary rounded w-5/6" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Plus de cet artiste */}
            <div className="border-t border-border-divider mt-8 pt-8">
                <div className="flex items-baseline justify-between mb-4">
                    <div className="h-5 bg-background-secondary rounded w-36" />
                    <div className="h-3.5 bg-background-secondary rounded w-20" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-36">
                            <div className="aspect-square rounded-[8px] bg-background-secondary mb-2" />
                            <div className="h-3 bg-background-secondary rounded w-3/4 mb-1" />
                            <div className="h-2.5 bg-background-secondary rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
