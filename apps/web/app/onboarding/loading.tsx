// L'onboarding est un flow plein écran sans nav standard.
// On reprend le même loader animé que la page root (barres + logo).
export default function Loading() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-6 w-full max-w-sm px-8 animate-pulse">
                {/* Étape indicateur */}
                <div className="flex gap-1.5">
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full bg-background-secondary ${i === 0 ? 'w-8' : 'w-4'}`}
                        />
                    ))}
                </div>

                {/* Titre de l'étape */}
                <div className="h-8 bg-background-secondary rounded-[8px] w-3/4" />
                <div className="h-4 bg-background-secondary rounded-[6px] w-5/6" />

                {/* Champ de saisie */}
                <div className="w-full h-12 bg-background-secondary rounded-[12px] mt-2" />

                {/* Bouton suivant */}
                <div className="w-full h-12 bg-background-secondary rounded-[12px]" />
            </div>
        </div>
    );
}
