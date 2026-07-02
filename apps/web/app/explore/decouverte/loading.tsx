export default function Loading() {
    return (
        <div className="animate-pulse">
            {/* Header identique au vrai header */}
            <section className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 max-w-page lg:max-w-5xl mx-auto">
                {/* BackButton */}
                <div className="inline-flex items-center gap-1 h-4 w-20 bg-background-secondary rounded mb-4" />
                {/* h1 */}
                <div className="h-8 bg-background-secondary rounded-[8px] w-52 mb-2" />
                {/* subtitle */}
                <div className="h-4 bg-background-secondary rounded-[6px] w-80 max-w-full" />
            </section>

            {/* Grille 2 → 3 → 4 cols identique à DecouverteContent */}
            <main className="px-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i}>
                            <div className="aspect-square rounded-[10px] bg-background-secondary mb-2" />
                            <div className="h-3.5 bg-background-secondary rounded-[6px] w-3/4 mb-1.5" />
                            <div className="h-3 bg-background-secondary rounded-[6px] w-1/2" />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
