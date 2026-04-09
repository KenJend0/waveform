import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: {
        default: "Légal — Waveform",
        template: "%s — Waveform",
    },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-[14px] text-text-secondary hover:text-text-primary transition-colors duration-150 mb-6"
                    >
                        ← <span className="underline underline-offset-2">Retour</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase">Waveform</span>
                    </div>
                </div>

                {children}

                <footer className="mt-16 pt-8 border-t border-border-divider">
                    <nav className="flex flex-wrap gap-x-6 gap-y-2">
                        <Link href="/legal/mentions-legales" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Mentions légales
                        </Link>
                        <Link href="/legal/confidentialite" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Confidentialité
                        </Link>
                        <Link href="/legal/cgu" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            CGU
                        </Link>
                        <Link href="/faq" className="text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            FAQ
                        </Link>
                    </nav>
                </footer>
            </div>
        </div>
    );
}
