export default function Loading() {
    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24">
            {/* Back button skeleton */}
            <div className="h-6 w-16 bg-background-secondary rounded-[8px] animate-pulse" />

            {/* ========== 1. THE ALBUM ========== */}
            <div className="mt-8 mb-20">
                {/* Header skeleton */}
                <div className="flex flex-col md:flex-row md:gap-section-md md:items-start">
                    {/* Cover skeleton */}
                    <div className="w-full md:w-48 aspect-square bg-background-secondary rounded-[10px] shrink-0 animate-pulse max-w-48 mx-auto md:mx-0 mb-2 md:mb-0" />

                    <div className="min-w-0 flex-1 space-y-3">
                        {/* Title skeleton */}
                        <div className="h-8 bg-background-secondary rounded-[8px] animate-pulse" />

                        {/* Artist + year skeleton */}
                        <div className="h-5 bg-background-secondary rounded-[8px] animate-pulse w-48" />

                        {/* Stats skeleton */}
                        <div className="flex gap-5 pt-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-1">
                                    <div className="h-5 bg-background-secondary rounded-[8px] animate-pulse w-12" />
                                    <div className="h-3 bg-background-secondary rounded-[8px] animate-pulse w-16" />
                                </div>
                            ))}
                        </div>

                        {/* Button skeleton */}
                        <div className="h-8 bg-background-secondary rounded-[8px] animate-pulse w-32" />
                    </div>
                </div>
            </div>

            {/* ========== 2. THE MUSIC ========== */}
            <section className="border-t border-border-divider pt-10 mb-20 space-y-2">
                <div className="h-4 bg-background-secondary rounded-[8px] animate-pulse w-24 mb-8" />
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 bg-background-secondary rounded-[8px] animate-pulse" />
                ))}
            </section>

            {/* ========== 3. OTHERS' NOTES ========== */}
            <section className="border-t border-border-divider pt-10 mb-20 space-y-3">
                <div className="h-4 bg-background-secondary rounded-[8px] animate-pulse w-40 mb-4" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-5 bg-background-secondary rounded-[8px] animate-pulse w-32" />
                        <div className="h-4 bg-background-secondary rounded-[8px] animate-pulse" />
                        <div className="h-4 bg-background-secondary rounded-[8px] animate-pulse w-2/3" />
                    </div>
                ))}
            </section>
        </main>
    );
}
