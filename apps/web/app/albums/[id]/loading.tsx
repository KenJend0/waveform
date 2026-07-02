export default function Loading() {
    return (
        <main className="max-w-page mx-auto px-4 pt-4 pb-24 animate-pulse">
            {/* Back button */}
            <div className="h-5 w-14 bg-background-secondary rounded-[6px]" />

            {/* ── 1. Album hero ── */}
            <div className="mt-4 mb-6">
                <div className="flex flex-col md:flex-row md:gap-8 md:items-start">
                    {/* Cover */}
                    <div className="w-full md:w-48 aspect-square bg-background-secondary rounded-[10px] shrink-0 max-w-48 mx-auto md:mx-0 mb-6 md:mb-0" />

                    <div className="flex-1 min-w-0">
                        {/* Title */}
                        <div className="h-8 bg-background-secondary rounded-[8px] mb-2" />
                        {/* Artist + year */}
                        <div className="h-5 bg-background-secondary rounded-[8px] w-48 mb-3" />
                        {/* Genre pills */}
                        <div className="flex gap-2 mb-4">
                            <div className="h-6 w-16 bg-background-secondary rounded-full" />
                            <div className="h-6 w-20 bg-background-secondary rounded-full" />
                        </div>
                        {/* Action button */}
                        <div className="h-10 bg-background-secondary rounded-[10px] w-36" />
                    </div>
                </div>
            </div>

            {/* Streaming links */}
            <div className="flex gap-3 mt-4 mb-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-[8px] bg-background-secondary" />
                ))}
            </div>

            {/* Stats — bande horizontale full-width */}
            <div className="flex w-full border-t border-b border-border py-3 mb-8 mt-4">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className={`flex flex-col flex-1 ${i < 2 ? 'border-r border-border pr-4' : ''} ${i > 0 ? 'pl-4' : ''}`}
                    >
                        <div className="h-6 bg-background-secondary rounded w-12 mb-1" />
                        <div className="h-3 bg-background-secondary rounded w-16" />
                    </div>
                ))}
            </div>

            {/* ── 2. Tracks ── */}
            <section className="border-t border-border-divider pt-10 mb-20">
                <div className="h-5 bg-background-secondary rounded-[8px] w-24 mb-8" />
                <div className="space-y-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-baseline gap-4 py-2">
                            <div className="h-3.5 bg-background-secondary rounded w-5 flex-shrink-0" />
                            <div className="h-3.5 bg-background-secondary rounded flex-1" style={{ maxWidth: `${55 + (i % 3) * 15}%` }} />
                            <div className="h-3 bg-background-secondary rounded w-8 flex-shrink-0" />
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 3. Reviews ── */}
            <section className="border-t border-border-divider pt-10 mb-12">
                <div className="h-5 bg-background-secondary rounded-[8px] w-40 mb-8" />
                <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-background-secondary flex-shrink-0" />
                                <div className="h-3.5 bg-background-secondary rounded w-28" />
                            </div>
                            <div className="h-3.5 bg-background-secondary rounded" />
                            <div className="h-3.5 bg-background-secondary rounded w-3/4" />
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 4. Albums similaires ── */}
            <section className="border-t border-border-divider pt-8 mb-12">
                <div className="h-5 bg-background-secondary rounded-[8px] w-36 mb-6" />
                <div className="flex gap-4 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-44 sm:w-48">
                            <div className="aspect-square rounded-[10px] bg-background-secondary mb-3" />
                            <div className="h-3.5 bg-background-secondary rounded w-3/4 mb-1.5" />
                            <div className="h-3 bg-background-secondary rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
