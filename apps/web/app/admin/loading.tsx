// Page admin : tabs Dashboard / Enrichissement / Signalements + contenu.
export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
            {/* Tabs */}
            <div className="flex gap-4 border-b border-border-divider mb-8 pb-0">
                {['Dashboard', 'Enrichissement', 'Signalements'].map((_, i) => (
                    <div
                        key={i}
                        className="h-9 bg-background-secondary rounded-t-[6px] px-4"
                        style={{ width: i === 0 ? 100 : i === 1 ? 120 : 110 }}
                    />
                ))}
            </div>

            {/* Sélecteur de plage (7j / 30j / 90j) */}
            <div className="flex gap-2 mb-8">
                {[48, 56, 56].map((w, i) => (
                    <div key={i} className="h-7 bg-background-secondary rounded-full" style={{ width: w }} />
                ))}
            </div>

            {/* Stat cards — grille 2 × 4 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-[12px] bg-background-secondary px-4 py-5 space-y-2">
                        <div className="h-7 bg-background-tertiary rounded w-14" />
                        <div className="h-3 bg-background-tertiary rounded w-20" />
                        <div className="h-3 bg-background-tertiary rounded w-12" />
                    </div>
                ))}
            </div>

            {/* Tableau d'événements récents */}
            <div className="rounded-[12px] bg-background-secondary overflow-hidden">
                {/* En-tête */}
                <div className="flex items-center gap-4 px-4 py-3 border-b border-border-divider">
                    {[80, 120, 64, 96].map((w, i) => (
                        <div key={i} className="h-3 bg-background-tertiary rounded" style={{ width: w }} />
                    ))}
                </div>
                {/* Lignes */}
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 border-b border-border-divider last:border-0"
                    >
                        {[80, 120, 64, 96].map((w, j) => (
                            <div
                                key={j}
                                className="h-3 bg-background-tertiary rounded"
                                style={{ width: `${w - (i % 3) * 10}px` }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
