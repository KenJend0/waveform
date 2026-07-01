"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BackButton from "@/components/ui/BackButton";

const footerLinks = [
    { href: "/legal", label: "Aide & support" },
    { href: "/faq", label: "FAQ" },
    { href: "/legal/cgu", label: "CGU" },
    { href: "/legal/confidentialite", label: "Confidentialité" },
    { href: "/legal/mentions-legales", label: "Mentions légales" },
];

export default function LegalPageShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Le hub /legal a déjà sa propre liste "Ressources utiles" avec les mêmes liens —
    // le footer n'est utile que pour naviguer entre les sous-pages sans repasser par le hub.
    const isHub = pathname === "/legal";
    const links = footerLinks.filter(({ href }) => href !== pathname);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
                <div className="mb-8">
                    <BackButton className="mb-6" />
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-tertiary tracking-widest uppercase">Waveform</span>
                    </div>
                </div>

                {children}

                {!isHub && (
                    <footer className="mt-16 pt-8 border-t border-border-divider">
                        <nav className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                            {links.map(({ href, label }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150"
                                >
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </footer>
                )}
            </div>
        </div>
    );
}
