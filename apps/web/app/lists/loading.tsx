export default function Loading() {
    return (
        <div className="animate-pulse">
            {/* Header identique à lists/page.tsx */}
            <section className="px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 max-w-page lg:max-w-5xl mx-auto">
                {/* BackButton */}
                <div className="h-4 w-20 bg-background-secondary rounded mb-4" />
                {/* h1 */}
                <div className="h-8 bg-background-secondary rounded-[8px] w-52 mb-2" />
                {/* subtitle */}
                <div className="h-4 bg-background-secondary rounded-[6px] w-72 max-w-full" />
            </section>

            {/* Grille 2 → 3 → 4 cols (même que ListCard grid) */}
            <main className="px-6 pb-28 lg:pb-10 max-w-page lg:max-w-5xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-[12px] bg-background-secondary overflow-hidden">
                            {/* Grille de 4 mini-covers (ListCard preview) */}
                            <div className="grid grid-cols-2 aspect-square">
                                {[0, 1, 2, 3].map((j) => (
                                    <div key={j} className="bg-background-tertiary" />
                                ))}
                            </div>
                            <div className="px-3 py-2.5 space-y-1.5">
                                <div className="h-4 bg-background-tertiary rounded-[6px] w-5/6" />
                                <div className="h-3 bg-background-tertiary rounded-[6px] w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
