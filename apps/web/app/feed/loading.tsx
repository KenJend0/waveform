function FeedRowSkeleton({ i }: { i: number }) {
    return (
        <div className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'mt-0.5' : ''}`}>
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
    );
}

function FeedColumnSkeleton() {
    return (
        <>
            {/* Date separator */}
            <div className="h-4 bg-background-secondary rounded w-16 mb-2" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <FeedRowSkeleton key={i} i={i} />
            ))}
        </>
    );
}

export default function Loading() {
    return (
        <div className="mx-auto max-w-6xl px-3 pb-28 md:px-5 lg:flex lg:h-[calc(100vh-68px)] lg:flex-col lg:overflow-hidden lg:px-8 lg:pb-6 animate-pulse">
            <div className="pt-8 lg:pt-10 lg:shrink-0" />

            {/* Switcher d'onglets — mobile uniquement */}
            <div className="lg:hidden mb-3">
                <div className="grid grid-cols-2 rounded-full border border-border bg-paper-hi p-1 gap-1">
                    <div className="h-9 bg-background-secondary rounded-full" />
                    <div className="h-9 rounded-full" />
                </div>
            </div>

            {/* ── Desktop : deux colonnes de feed côte à côte, scroll indépendant ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:min-h-0 lg:flex-1">
                <section className="lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:pr-5">
                    <div className="hidden lg:block lg:shrink-0 h-6 bg-background-secondary rounded w-20 mb-5" />
                    <div className="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                        <FeedColumnSkeleton />
                    </div>
                </section>

                <section className="hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-l lg:border-rule lg:pl-5">
                    <div className="lg:shrink-0 h-6 bg-background-secondary rounded w-16 mb-5" />
                    <div className="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                        <FeedColumnSkeleton />
                    </div>
                </section>
            </div>
        </div>
    );
}
