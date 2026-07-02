// Rendu à l'intérieur de LegalPageShell (via legal/layout.tsx).
export default function Loading() {
    return (
        <article className="animate-pulse">
            {/* h1 */}
            <div className="h-8 bg-background-secondary rounded-[8px] w-full max-w-xs mb-2" />
            {/* Date */}
            <div className="h-3 bg-background-secondary rounded w-40 mb-10" />

            {/* 6 sections de prose */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="mb-8">
                    <div className="h-5 bg-background-secondary rounded w-40 mb-3" />
                    <div className="space-y-2">
                        <div className="h-3.5 bg-background-secondary rounded w-full" />
                        <div className="h-3.5 bg-background-secondary rounded w-10/12" />
                        {i % 3 !== 2 && <div className="h-3.5 bg-background-secondary rounded w-4/5" />}
                    </div>
                </div>
            ))}
        </article>
    );
}
