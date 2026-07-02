export default function Loading() {
    return (
        <div className="max-w-page mx-auto px-4 sm:px-6 pb-28 pt-6 animate-pulse">
            {/* BackButton + h1 */}
            <div className="mb-6">
                <div className="h-4 w-16 bg-background-secondary rounded mb-4" />
                <div className="h-8 bg-background-secondary rounded-[8px] w-40" />
            </div>

            {/* Carte récap : 3 stat tiles */}
            <div className="grid grid-cols-3 gap-3 mb-10">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-[12px] bg-background-secondary px-4 py-5 space-y-2">
                        <div className="h-7 bg-background-tertiary rounded w-12" />
                        <div className="h-3 bg-background-tertiary rounded w-16" />
                    </div>
                ))}
            </div>

            {/* Distribution des notes — histogramme */}
            <div className="mb-10">
                <div className="h-5 bg-background-secondary rounded w-44 mb-5" />
                <div className="flex items-end gap-1.5 h-24">
                    {[20, 35, 55, 70, 90, 100, 85, 65, 45, 25].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 rounded-t-[4px] bg-background-secondary"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
                <div className="flex justify-between mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <div key={n} className="h-2.5 w-3 bg-background-secondary rounded" />
                    ))}
                </div>
            </div>

            {/* Activité mensuelle — barres */}
            <div className="mb-10">
                <div className="h-5 bg-background-secondary rounded w-40 mb-5" />
                <div className="flex items-end gap-2 h-20">
                    {[30, 50, 40, 70, 55, 80, 65, 45, 60, 75, 50, 35].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 rounded-t-[4px] bg-background-secondary"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>

            {/* Genres — liste horizontale */}
            <div className="mb-10">
                <div className="h-5 bg-background-secondary rounded w-24 mb-5" />
                <div className="space-y-3">
                    {[80, 60, 45, 35, 25].map((w, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-3 bg-background-secondary rounded w-24 flex-shrink-0" />
                            <div className="flex-1 h-2.5 bg-background-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-background-tertiary"
                                    style={{ width: `${w}%` }}
                                />
                            </div>
                            <div className="h-3 bg-background-secondary rounded w-6 flex-shrink-0" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Top artistes */}
            <div>
                <div className="h-5 bg-background-secondary rounded w-32 mb-5" />
                <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-background-secondary flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="h-3.5 bg-background-secondary rounded w-36" />
                                <div className="h-3 bg-background-secondary rounded w-20" />
                            </div>
                            <div className="h-4 bg-background-secondary rounded w-8 flex-shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
