export default function Loading() {
    return (
        <div className="pb-28 animate-pulse">
            {/* Profile header */}
            <div className="px-4 sm:px-6 pt-6 pb-8 max-w-page mx-auto">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-20 h-20 rounded-full bg-background-secondary flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                        <div className="h-6 bg-background-secondary rounded-[6px] w-40" />
                        <div className="h-4 bg-background-secondary rounded-[6px] w-28" />
                        <div className="flex gap-5 pt-1">
                            {[48, 40, 52].map((w, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="h-5 bg-background-secondary rounded-[6px]" style={{ width: w }} />
                                    <div className="h-3 bg-background-secondary rounded-[6px] w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bio */}
                <div className="space-y-1.5 mb-6">
                    <div className="h-3.5 bg-background-secondary rounded-[6px]" />
                    <div className="h-3.5 bg-background-secondary rounded-[6px] w-2/3" />
                </div>

                {/* Top 3 */}
                <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="w-20 h-20 rounded-[10px] bg-background-secondary" />
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-page mx-auto px-4 sm:px-6">
                <div className="flex gap-6 mb-6 pb-3 border-b border-border">
                    {[56, 44].map((w, i) => (
                        <div key={i} className="h-4 bg-background-secondary rounded-[6px]" style={{ width: w }} />
                    ))}
                </div>

                {/* Entries */}
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
            </div>
        </div>
    );
}
