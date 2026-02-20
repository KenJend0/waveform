export default function LoadingArtist() {
    return (
        <main className="max-w-3xl mx-auto px-4 py-8 pb-24">
            {/* Back button skeleton */}
            <div className="h-6 w-16 bg-background-secondary rounded-[8px] animate-pulse" />

            {/* Header skeleton */}
            <div className="mt-8 mb-10">
                <div className="h-9 w-2/3 bg-background-secondary rounded-[8px] animate-pulse" />
                <div className="h-4 w-40 bg-background-secondary rounded-[8px] animate-pulse mt-3" />
            </div>

            {/* Section label */}
            <div className="h-3 w-28 bg-background-secondary rounded-[8px] animate-pulse mb-6" />

            {/* Albums grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-[12px] bg-background-secondary overflow-hidden animate-pulse">
                        <div className="aspect-square bg-background-tertiary" />
                        <div className="px-3 py-2.5 space-y-1.5">
                            <div className="h-4 w-3/4 bg-background-tertiary rounded-[6px]" />
                            <div className="h-3 w-1/2 bg-background-tertiary rounded-[6px]" />
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
