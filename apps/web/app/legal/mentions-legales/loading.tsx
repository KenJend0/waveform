// Rendu à l'intérieur de LegalPageShell (via legal/layout.tsx).
export default function Loading() {
    return (
        <article className="animate-pulse">
            {/* h1 */}
            <div className="h-8 bg-background-secondary rounded-[8px] w-48 mb-2" />
            {/* Date */}
            <div className="h-3 bg-background-secondary rounded w-36 mb-10" />

            {/* 4 sections de prose */}
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="mb-8">
                    <div className="h-5 bg-background-secondary rounded w-44 mb-3" />
                    <div className="space-y-2">
                        <div className="h-3.5 bg-background-secondary rounded w-full" />
                        <div className="h-3.5 bg-background-secondary rounded w-11/12" />
                        {i % 2 === 1 && <div className="h-3.5 bg-background-secondary rounded w-3/4" />}
                    </div>
                </div>
            ))}
        </article>
    );
}
