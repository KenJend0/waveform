export default function Loading() {
    return (
        <>
            {/* Mobile — file de triage swipable : un titre, deux pills de
                recherche, puis une grande carte qui occupe le reste de l'écran. */}
            <div className="lg:hidden h-[100dvh] overflow-hidden flex flex-col px-6 pt-6 pb-20 animate-pulse">
                <div className="h-8 bg-background-secondary rounded-[8px] w-48 mb-3 flex-shrink-0" />

                <div className="flex gap-2 mb-3 flex-shrink-0">
                    <div className="h-7 w-36 bg-background-secondary rounded-pill" />
                    <div className="h-7 w-32 bg-background-secondary rounded-pill" />
                </div>

                <div className="flex-1 min-h-0 rounded-card-lg bg-background-secondary" />
            </div>

            {/* Desktop — recherche à gauche, suggestions en grille à droite. */}
            <div className="hidden lg:block animate-pulse">
                <div className="p-6 lg:px-8 pb-0">
                    <div className="h-8 bg-background-secondary rounded-[8px] w-56 mb-2" />
                    <div className="flex gap-4 mt-4">
                        <div className="h-5 w-14 bg-background-secondary rounded" />
                        <div className="h-5 w-12 bg-background-secondary rounded" />
                    </div>
                </div>

                <main className="p-6 lg:px-8 pb-28 lg:pb-12">
                    <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
                        {/* Colonne gauche : barre de recherche */}
                        <div className="h-11 bg-background-secondary rounded-[10px]" />

                        {/* Colonne droite : grille de pochettes */}
                        <div className="mt-6 lg:mt-0">
                            <div className="h-2.5 bg-background-secondary rounded w-36 mb-3" />
                            <div className="grid gap-4 grid-cols-3">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i}>
                                        <div className="aspect-square rounded-[10px] bg-background-secondary mb-2" />
                                        <div className="h-3 bg-background-secondary rounded w-3/4 mb-1" />
                                        <div className="h-2.5 bg-background-secondary rounded w-1/2" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
