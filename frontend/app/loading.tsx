export default function Loading() {
    return (
        <main className="p-6 pb-20 max-w-page mx-auto animate-pulse">
            {/* Page title */}
            <div className="h-7 w-48 bg-background-secondary rounded-[8px] mb-8" />

            {/* Content rows */}
            <div className="space-y-5">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 pb-5 border-b border-border-divider">
                        <div className="w-12 h-12 rounded-[8px] bg-background-secondary flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-background-secondary rounded-[6px] w-2/3" />
                            <div className="h-3 bg-background-secondary rounded-[6px] w-1/3" />
                            <div className="h-3 bg-background-secondary rounded-[6px] w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
