'use client';

import Link from "next/link";

export default function Error({ error }: { error: Error }) {
    return (
        <main className="max-w-page mx-auto px-4 py-8 pb-24">
            <p className="text-[14px] font-medium text-[#C86C6C]">Impossible de charger l'album.</p>
            <pre className="mt-2 p-3 bg-background-secondary border border-border-divider rounded-[8px] text-[12px] text-text-secondary overflow-auto">
                {error.message}
            </pre>
            <Link href="/" className="inline-block mt-4 text-[14px] text-text-secondary hover:text-[#8E6F5E] transition-colors duration-150">
                Retour à l'accueil
            </Link>
        </main>
    );
}
