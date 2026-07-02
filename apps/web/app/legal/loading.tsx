// Rendu à l'intérieur de LegalPageShell (via legal/layout.tsx).
// Le shell (BackButton, label Waveform, footer nav) est déjà affiché.
export default function Loading() {
    return (
        <article className="animate-pulse">
            {/* h1 "Aide & support" */}
            <div className="h-8 bg-background-secondary rounded-[8px] w-44 mb-2" />
            {/* Sous-titre */}
            <div className="h-3.5 bg-background-secondary rounded w-72 mb-10" />

            {/* Section "Nous contacter" */}
            <div className="mb-8">
                <div className="h-4 bg-background-secondary rounded w-32 mb-4" />
                {/* Ligne email */}
                <div className="flex items-center gap-4 px-4 py-4 rounded-[12px] bg-background-secondary -mx-4">
                    <div className="w-9 h-9 rounded-[8px] bg-background-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="h-3.5 bg-background-tertiary rounded w-56" />
                        <div className="h-3 bg-background-tertiary rounded w-36" />
                    </div>
                    <div className="h-4 w-3 bg-background-tertiary rounded flex-shrink-0" />
                </div>
            </div>

            {/* Section "Ressources utiles" */}
            <div>
                <div className="h-4 bg-background-secondary rounded w-36 mb-4" />
                <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 px-4 py-4 rounded-[12px] -mx-4"
                        >
                            <div className="w-9 h-9 rounded-[8px] bg-background-secondary flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="h-3.5 bg-background-secondary rounded w-40" />
                                <div className="h-3 bg-background-secondary rounded w-64 max-w-full" />
                            </div>
                            <div className="h-4 w-3 bg-background-secondary rounded flex-shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        </article>
    );
}
