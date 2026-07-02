export default function Loading() {
    return (
        <div className="mx-auto max-w-6xl px-3 md:px-5 lg:px-8 pb-28 lg:pb-12 animate-pulse">
            {/* Header */}
            <div className="pt-8 pb-6">
                <div className="h-8 bg-background-secondary rounded-[8px] w-24 mb-2" />
                <div className="h-4 bg-background-secondary rounded-[8px] w-56" />
            </div>

            {/* ── Desktop : grille 2 colonnes feed + sidebar ── */}
            <div className="lg:grid lg:grid-cols-[minmax(0,720px)_320px] lg:items-start lg:gap-10">
                {/* Liste de feed */}
                <section>
                    {/* Date separator */}
                    <div className="h-4 bg-background-secondary rounded w-16 mb-2" />

                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'mt-0.5' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-background-secondary flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="h-3 bg-background-secondary rounded w-40" />
                                <div className="h-3.5 bg-background-secondary rounded w-32" />
                                {i % 3 === 0 && <div className="h-3 bg-background-secondary rounded w-24" />}
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <div className="w-11 h-11 rounded-cover-sm bg-background-secondary" />
                                {i % 2 === 0 && <div className="h-4 w-7 bg-background-secondary rounded-badge" />}
                            </div>
                        </div>
                    ))}
                </section>

                {/* Sidebar — visible uniquement lg+ */}
                <aside className="hidden lg:block lg:sticky lg:top-24 space-y-4">
                    <div className="h-4 bg-background-secondary rounded w-40 mb-4" />
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-background-secondary flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="h-3.5 bg-background-secondary rounded w-28" />
                                <div className="h-3 bg-background-secondary rounded w-16" />
                            </div>
                            <div className="h-7 w-14 bg-background-secondary rounded-[8px]" />
                        </div>
                    ))}
                </aside>
            </div>
        </div>
    );
}
