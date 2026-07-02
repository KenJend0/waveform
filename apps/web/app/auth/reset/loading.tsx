// La page /auth/reset est centrée, avec 2 inputs mot de passe + submit.
export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6 animate-pulse">
            <div className="w-full max-w-sm">
                {/* Titre */}
                <div className="h-7 bg-background-secondary rounded-[8px] w-56 mb-2" />
                {/* Sous-titre */}
                <div className="h-4 bg-background-secondary rounded w-72 max-w-full mb-8" />

                {/* Nouveau mot de passe */}
                <div className="mb-4">
                    <div className="h-3.5 bg-background-secondary rounded w-36 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Confirmer le mot de passe */}
                <div className="mb-6">
                    <div className="h-3.5 bg-background-secondary rounded w-44 mb-2" />
                    <div className="h-11 bg-background-secondary rounded-[10px]" />
                </div>

                {/* Bouton submit */}
                <div className="h-12 bg-background-secondary rounded-[12px] w-full" />
            </div>
        </div>
    );
}
