export default function Loading() {
    return (
        <div className="animate-pulse">
            {/* Header — identique à explore/page.tsx */}
            <section className="mx-auto max-w-6xl px-6 lg:px-8 pt-6 lg:pt-8 pb-5">
                <div className="h-8 bg-background-secondary rounded-[8px] w-24 mb-2" />
                <div className="h-4 bg-background-secondary rounded-[8px] w-64" />
            </section>

            {/* StickySearchBar */}
            <div className="mx-auto max-w-6xl px-6 lg:px-8 pb-5">
                <div className="h-10 bg-background-secondary rounded-[10px]" />
            </div>

            {/* ── Mobile : colonne unique (lg:hidden) ── */}
            <div className="lg:hidden mx-auto max-w-6xl px-6 pb-28 space-y-12">
                {/* Pour toi */}
                <section>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="h-5 bg-background-secondary rounded w-20 mb-2" />
                            <div className="h-3.5 bg-background-secondary rounded w-44" />
                        </div>
                    </div>
                    <div className="flex gap-1.5 mb-5">
                        <div className="h-6 w-16 bg-background-secondary rounded-full" />
                        <div className="h-6 w-14 bg-background-secondary rounded-full" />
                    </div>
                    <div className="flex gap-4 overflow-hidden">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="shrink-0 w-36">
                                <div className="aspect-square bg-background-secondary rounded-[10px] mb-2" />
                                <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                <div className="h-3 bg-background-secondary rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Tendances */}
                <section>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="h-5 bg-background-secondary rounded w-24 mb-2" />
                            <div className="h-3.5 bg-background-secondary rounded w-52" />
                        </div>
                        <div className="h-3.5 bg-background-secondary rounded w-14" />
                    </div>
                    <div className="flex gap-1.5 mb-5">
                        <div className="h-6 w-16 bg-background-secondary rounded-full" />
                        <div className="h-6 w-14 bg-background-secondary rounded-full" />
                    </div>
                    <div className="flex gap-4 overflow-hidden">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="shrink-0 w-44">
                                <div className="aspect-square bg-background-secondary rounded-[10px] mb-2" />
                                <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                <div className="h-3 bg-background-secondary rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Listes populaires */}
                <section>
                    <div className="h-5 bg-background-secondary rounded w-32 mb-2" />
                    <div className="h-3.5 bg-background-secondary rounded w-56 mb-5" />
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="aspect-square bg-background-secondary rounded-[12px]" />
                        ))}
                    </div>
                </section>
            </div>

            {/* ── Desktop : grille 2 colonnes main + sidebar (hidden lg:grid) ── */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:items-start mx-auto max-w-6xl px-8 pb-10">
                {/* Colonne principale */}
                <div className="min-w-0 space-y-12">
                    {/* Pour toi */}
                    <section>
                        <div className="h-5 bg-background-secondary rounded w-20 mb-2" />
                        <div className="h-3.5 bg-background-secondary rounded w-44 mb-3" />
                        <div className="flex gap-1.5 mb-5">
                            <div className="h-6 w-16 bg-background-secondary rounded-full" />
                            <div className="h-6 w-14 bg-background-secondary rounded-full" />
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i}>
                                    <div className="aspect-square bg-background-secondary rounded-[10px] mb-2" />
                                    <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                    <div className="h-3 bg-background-secondary rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Tendances — grille 5 cols */}
                    <section>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="h-5 bg-background-secondary rounded w-24 mb-2" />
                                <div className="h-3.5 bg-background-secondary rounded w-52" />
                            </div>
                            <div className="h-3.5 bg-background-secondary rounded w-14" />
                        </div>
                        <div className="flex gap-1.5 mb-5">
                            <div className="h-6 w-16 bg-background-secondary rounded-full" />
                            <div className="h-6 w-14 bg-background-secondary rounded-full" />
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i}>
                                    <div className="aspect-square bg-background-secondary rounded-[10px] mb-2" />
                                    <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                    <div className="h-3 bg-background-secondary rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Découverte — grille 4 cols */}
                    <section>
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="h-5 bg-background-secondary rounded w-28 mb-2" />
                                <div className="h-3.5 bg-background-secondary rounded w-64" />
                            </div>
                            <div className="h-3.5 bg-background-secondary rounded w-14" />
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i}>
                                    <div className="aspect-square bg-background-secondary rounded-[10px] mb-2" />
                                    <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                    <div className="h-3 bg-background-secondary rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar droite */}
                <aside className="space-y-8 sticky top-24">
                    {/* CuratorPick */}
                    <div>
                        <div className="h-4 bg-background-secondary rounded w-28 mb-3" />
                        <div className="aspect-square bg-background-secondary rounded-[12px] mb-3" />
                        <div className="h-4 bg-background-secondary rounded w-3/4 mb-1.5" />
                        <div className="h-3 bg-background-secondary rounded w-1/2" />
                    </div>

                    {/* Comptes similaires */}
                    <div>
                        <div className="h-4 bg-background-secondary rounded w-36 mb-4" />
                        <div className="space-y-3">
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
                        </div>
                    </div>

                    {/* Listes populaires */}
                    <div>
                        <div className="h-4 bg-background-secondary rounded w-32 mb-3" />
                        <div className="grid grid-cols-2 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="aspect-square bg-background-secondary rounded-[12px]" />
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
