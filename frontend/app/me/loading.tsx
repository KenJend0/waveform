export default function Loading() {
    return (
        <div className="lg:flex lg:items-start lg:gap-12 lg:px-8 lg:pt-8 pb-28 animate-pulse">
            {/* Sidebar gauche */}
            <aside className="lg:w-72 lg:flex-shrink-0">
                {/* ProfileHeader */}
                <div className="bg-background-secondary border-b border-border-divider lg:bg-transparent lg:border-0">
                    <div className="px-4 sm:px-6 py-8 lg:px-0 lg:py-6">
                        <div className="flex gap-5 items-center">
                            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-background-tertiary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="h-6 bg-background-tertiary rounded-[6px] w-36 mb-2" />
                            </div>
                        </div>
                        <div className="h-3.5 bg-background-tertiary rounded-[6px] w-48 mt-5" />
                        <div className="flex gap-8 mt-6">
                            {[0, 1, 2].map((i) => (
                                <div key={i}>
                                    <div className="h-5 bg-background-tertiary rounded w-8 mb-1.5" />
                                    <div className="h-2.5 bg-background-tertiary rounded w-14" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Albums favoris */}
                <div className="px-4 sm:px-6 lg:px-0 mt-6">
                    <div className="h-2.5 bg-background-tertiary rounded w-24 mb-3" />
                    <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="aspect-square rounded-[8px] bg-background-secondary" />
                        ))}
                    </div>

                    {/* Rating distribution */}
                    <div className="hidden lg:block mt-6">
                        <div className="h-2.5 bg-background-tertiary rounded w-20 mb-4" />
                        <div className="flex items-end gap-[3px] h-12">
                            {[40, 60, 75, 90, 100, 85, 70, 50, 35, 20].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 rounded-[2px] bg-background-tertiary"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                        <div className="h-2.5 bg-background-tertiary rounded w-28 mt-3" />
                    </div>
                </div>
            </aside>

            {/* Contenu principal */}
            <div className="lg:flex-1 lg:min-w-0 mt-8 lg:mt-0 px-4 sm:px-6 lg:px-0">
                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    {[88, 52, 48].map((w, i) => (
                        <div key={i} className="h-4 bg-background-secondary rounded-[6px]" style={{ width: w }} />
                    ))}
                </div>

                {/* Sort + toggle */}
                <div className="flex justify-between mb-6">
                    <div className="h-3.5 bg-background-secondary rounded w-40" />
                    <div className="h-3.5 bg-background-secondary rounded w-24" />
                </div>

                {/* Diary grid — 3 cols mobile, 4 cols lg */}
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i}>
                            <div className="aspect-square rounded-[10px] bg-background-secondary mb-2" />
                            <div className="h-3 bg-background-secondary rounded w-3/4 mb-1" />
                            <div className="h-2.5 bg-background-secondary rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
