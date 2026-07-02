// La page /auth est centrée dans un min-h écran avec un formulaire max-w-sm.
export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6 animate-pulse">
            <div className="w-full max-w-sm">
                {/* Tabs de mode (Connexion / Inscription) */}
                <div className="flex gap-4 mb-8">
                    <div className="h-4 w-20 bg-background-secondary rounded" />
                    <div className="h-4 w-20 bg-background-secondary rounded" />
                </div>

                {/* Champ email */}
                <div className="mb-4">
                    <div className="h-3.5 bg-background-secondary rounded w-24 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Champ mot de passe */}
                <div className="mb-6">
                    <div className="h-3.5 bg-background-secondary rounded w-28 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Bouton submit */}
                <div className="h-12 bg-background-secondary rounded-[12px] w-full mb-4" />

                {/* Lien "Mot de passe oublié" */}
                <div className="h-3 bg-background-secondary rounded w-40 mx-auto" />

                {/* Footer légal */}
                <div className="mt-8 space-y-1.5">
                    <div className="h-3 bg-background-secondary rounded w-full mx-auto max-w-xs" />
                    <div className="h-3 bg-background-secondary rounded w-4/5 mx-auto max-w-xs" />
                </div>
            </div>
        </div>
    );
}
