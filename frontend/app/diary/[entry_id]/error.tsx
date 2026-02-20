"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="p-6 pb-20 max-w-page mx-auto">
            <div className="max-w-md mx-auto text-center">
                <p className="text-[14px] font-medium text-[#C86C6C]">Impossible de charger l'entrée du journal.</p>
                <p className="text-text-secondary text-[13px] mt-2">Une erreur est survenue. Réessayez.</p>
                <div className="mt-4">
                    <button onClick={() => reset()} className="px-4 py-2 bg-[#1C1C1C] text-white rounded-[8px]">Réessayer</button>
                </div>
            </div>
        </main>
    );
}
