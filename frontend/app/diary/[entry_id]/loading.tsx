export default function Loading() {
    return (
        <main className="p-6 pb-20 max-w-page mx-auto animate-pulse">
            {/* Back button */}
            <div className="h-5 w-16 bg-background-secondary rounded-[6px] mb-8" />

            {/* Album header */}
            <div className="flex items-start gap-4 mb-8 pb-8 border-b border-border">
                <div className="w-20 h-20 rounded-[10px] bg-background-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2 pt-1">
                    <div className="h-5 bg-background-secondary rounded-[6px] w-3/4" />
                    <div className="h-4 bg-background-secondary rounded-[6px] w-1/2" />
                    <div className="h-3 bg-background-secondary rounded-[6px] w-24 mt-1" />
                </div>
            </div>

            {/* Rating */}
            <div className="flex gap-1 mb-6">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="w-6 h-6 bg-background-secondary rounded-[4px]" />
                ))}
            </div>

            {/* Review body */}
            <div className="space-y-2 mb-8">
                <div className="h-4 bg-background-secondary rounded-[6px]" />
                <div className="h-4 bg-background-secondary rounded-[6px] w-5/6" />
                <div className="h-4 bg-background-secondary rounded-[6px] w-4/6" />
            </div>

            {/* Like / comment bar */}
            <div className="flex items-center gap-4">
                <div className="h-5 w-14 bg-background-secondary rounded-[6px]" />
                <div className="h-5 w-14 bg-background-secondary rounded-[6px]" />
            </div>
        </main>
    );
}
