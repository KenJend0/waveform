export default function Loading() {
    return (
        <div className="animate-pulse">
            {/* BackButton + barre de recherche principale */}
            <div className="px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
                <div className="h-4 w-16 bg-background-secondary rounded mb-4" />
                <div className="h-12 bg-background-secondary rounded-[12px]" />
            </div>

            {/* Tabs de filtre : Tout · Albums · Artistes · Titres · Utilisateurs */}
            <div className="flex gap-2 px-4 sm:px-6 pb-4 overflow-hidden">
                {[48, 60, 68, 52, 80].map((w, i) => (
                    <div
                        key={i}
                        className="h-7 rounded-full bg-background-secondary flex-shrink-0"
                        style={{ width: w }}
                    />
                ))}
            </div>

            {/* Lignes de résultats (album / artiste / track / user) */}
            <div className="px-2 sm:px-4">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-[10px]"
                    >
                        {/* Vignette */}
                        <div
                            className={`w-11 h-11 bg-background-secondary flex-shrink-0 ${
                                i % 4 === 2 ? 'rounded-full' : 'rounded-[6px]'
                            }`}
                        />
                        {/* Titre + sous-titre */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                            <div
                                className="h-3.5 bg-background-secondary rounded"
                                style={{ width: `${45 + (i % 4) * 15}%` }}
                            />
                            <div
                                className="h-3 bg-background-secondary rounded"
                                style={{ width: `${30 + (i % 3) * 12}%` }}
                            />
                        </div>
                        {/* Bouton import / follow */}
                        <div className="h-7 w-16 bg-background-secondary rounded-[8px] flex-shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}
