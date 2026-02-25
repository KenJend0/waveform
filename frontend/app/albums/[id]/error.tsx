"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => { console.error(error); }, [error]);

    return (
        <main className="min-h-[60dvh] flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-h2 text-text-primary mb-2">Impossible de charger cet album</h1>
            <p className="text-[14px] text-text-secondary max-w-xs mb-8">
                Une erreur est survenue. Réessaie ou reviens plus tard.
            </p>
            <div className="flex items-center gap-3">
                <button onClick={reset} className="px-6 py-2.5 bg-[#1C1C1C] text-[#F5F3EF] text-[14px] font-medium rounded-[8px] hover:opacity-85 transition-opacity">
                    Réessayer
                </button>
                <Link href="/feed" className="px-6 py-2.5 border border-border text-text-secondary text-[14px] font-medium rounded-[8px] hover:border-[#8E6F5E] hover:text-[#8E6F5E] transition-colors duration-150">
                    Retour au fil
                </Link>
            </div>
        </main>
    );
}
