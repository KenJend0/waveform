export default function Loading() {
    return (
        <div className="animate-pulse">
            {/* Header */}
            <section className="px-6 pt-safe pb-6 max-w-page mx-auto">
                <div className="h-8 bg-background-secondary rounded-[8px] w-24 mb-2" />
                <div className="h-4 bg-background-secondary rounded-[8px] w-64" />
            </section>

            {/* Search bar */}
            <div className="bg-background border-b border-border-divider">
                <div className="px-6 pb-3 max-w-page mx-auto">
                    <div className="h-10 bg-background-secondary rounded-[10px]" />
                </div>
            </div>

            <main className="p-6 pb-20 max-w-page mx-auto space-y-12">
                {/* Pour toi — grille 2 colonnes */}
                <section>
                    <div className="h-5 bg-background-secondary rounded w-20 mb-5" />
                    <div className="grid grid-cols-2 gap-3 lg:gap-4 lg:grid-cols-[repeat(4,minmax(0,15rem))]">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-[6px] bg-background-secondary flex-shrink-0" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="h-3 bg-background-secondary rounded w-3/4" />
                                    <div className="h-2.5 bg-background-secondary rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Écoutés cette semaine + Découverte — scroll horizontal */}
                {[0, 1].map((s) => (
                    <section key={s}>
                        <div className="h-5 bg-background-secondary rounded w-44 mb-5" />
                        <div className="flex gap-4 overflow-hidden pb-2">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="shrink-0 w-44">
                                    <div className="aspect-square bg-background-secondary rounded-[10px] mb-3" />
                                    <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                                    <div className="h-3 bg-background-secondary rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </main>
        </div>
    );
}
