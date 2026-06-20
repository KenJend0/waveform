import Link from "next/link";

export default function NotFound() {
    return (
        <main className="min-h-[60dvh] flex flex-col items-center justify-center p-6 text-center">
            <p className="text-[72px] font-medium text-text-primary leading-none tracking-[-0.04em] mb-4">
                404
            </p>
            <h1 className="text-h2 text-text-primary mb-2">Page introuvable</h1>
            <p className="text-[14px] text-text-secondary max-w-xs mb-8">
                Cette page n'existe pas ou a été déplacée.
            </p>
            <Link
                href="/explore"
                className="px-6 py-2.5 bg-[#1C1C1C] text-[#F5F3EF] text-[14px] font-medium rounded-[8px] hover:opacity-85 transition-opacity"
            >
                Retour à l&apos;accueil
            </Link>
        </main>
    );
}
