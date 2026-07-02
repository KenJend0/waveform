export default function Loading() {
    return (
        <div className="max-w-page mx-auto px-4 sm:px-6 pb-28 pt-6 animate-pulse">
            {/* BackButton */}
            <div className="h-4 w-16 bg-background-secondary rounded mb-6" />

            {/* Titre */}
            <div className="h-8 bg-background-secondary rounded-[8px] w-48 mb-2" />
            <div className="h-4 bg-background-secondary rounded-[6px] w-72 max-w-full mb-8" />

            {/* 3 slots d'albums côte à côte (aspect-square) */}
            <div className="grid grid-cols-3 gap-3 max-w-sm">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="relative">
                        <div className="aspect-square rounded-[12px] bg-background-secondary" />
                        {/* Icône de suppression */}
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background-tertiary" />
                    </div>
                ))}
            </div>

            {/* Bouton sauvegarder */}
            <div className="mt-8 h-11 bg-background-secondary rounded-[12px] w-36" />
        </div>
    );
}
