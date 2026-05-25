import type { Metadata } from "next";
import Link from "next/link";
import { Mail, FileText, Shield, ScrollText, Trash2 } from "lucide-react";

export const metadata: Metadata = {
    title: "Support — Waveform",
    description: "Besoin d'aide avec Waveform ? Contacte-nous ou consulte nos ressources.",
};

const resources = [
    {
        href: "/faq",
        icon: FileText,
        label: "FAQ",
        description: "Questions fréquentes sur l'utilisation de Waveform",
    },
    {
        href: "/legal/cgu",
        icon: ScrollText,
        label: "Conditions d'utilisation",
        description: "Règles d'usage de la plateforme",
    },
    {
        href: "/legal/confidentialite",
        icon: Shield,
        label: "Politique de confidentialité",
        description: "Comment nous traitons tes données personnelles",
    },
    {
        href: "/settings",
        icon: Trash2,
        label: "Supprimer mon compte",
        description: "Réglages → Zone dangereuse → Supprimer le compte",
    },
];

export default function SupportPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-meta text-text-secondary hover:text-text-primary transition-colors duration-150 mb-6"
                    >
                        ← <span className="underline underline-offset-2">Retour</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-tertiary tracking-widest uppercase">Waveform</span>
                    </div>
                </div>

                <article>
                    <h1 className="text-h1 text-text-primary mb-2">Support</h1>
                    <p className="text-[14px] text-text-secondary mb-10">
                        Une question, un problème ou une suggestion ? On est là.
                    </p>

                    {/* Contact */}
                    <section className="mb-10">
                        <h2 className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
                            Nous contacter
                        </h2>
                        <a
                            href="mailto:waveform.contact@proton.me?subject=Support%20Waveform"
                            className="flex items-center gap-4 px-4 py-4 rounded-[12px] bg-background-secondary hover:bg-background-tertiary transition-colors duration-150 group -mx-4"
                        >
                            <div className="flex-shrink-0 w-9 h-9 rounded-[8px] bg-background-tertiary group-hover:bg-[#D8D3CB] flex items-center justify-center transition-colors duration-150">
                                <Mail size={16} className="text-text-tertiary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-text-primary font-medium">waveform.contact@proton.me</p>
                                <p className="text-[12px] text-text-tertiary mt-0.5">
                                    Réponse sous 48 h en général
                                </p>
                            </div>
                            <span className="text-text-disabled text-[18px] leading-none">›</span>
                        </a>
                    </section>

                    {/* Ressources */}
                    <section className="mb-10">
                        <h2 className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
                            Ressources utiles
                        </h2>
                        <div className="space-y-2">
                            {resources.map(({ href, icon: Icon, label, description }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="flex items-center gap-4 px-4 py-4 rounded-[12px] hover:bg-background-secondary transition-colors duration-150 group -mx-4"
                                >
                                    <div className="flex-shrink-0 w-9 h-9 rounded-[8px] bg-background-secondary group-hover:bg-background-tertiary flex items-center justify-center transition-colors duration-150">
                                        <Icon size={16} className="text-text-tertiary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] text-text-primary font-medium">{label}</p>
                                        <p className="text-[12px] text-text-tertiary mt-0.5">{description}</p>
                                    </div>
                                    <span className="text-text-disabled text-[18px] leading-none">›</span>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Sujets fréquents */}
                    <section className="mb-10">
                        <h2 className="text-[13px] font-medium text-text-tertiary tracking-widest uppercase mb-3">
                            Sujets fréquents
                        </h2>
                        <div className="space-y-4 text-[14px] text-text-secondary">
                            <div>
                                <p className="font-medium text-text-primary mb-1">Je ne reçois pas l'email de confirmation</p>
                                <p>Vérifie ton dossier spam. Si le problème persiste, contacte-nous avec l'adresse utilisée à l'inscription.</p>
                            </div>
                            <div>
                                <p className="font-medium text-text-primary mb-1">Je veux changer mon adresse email</p>
                                <p>Pour l'instant, le changement d'email se fait sur demande. Envoie-nous un message depuis ton adresse actuelle.</p>
                            </div>
                            <div>
                                <p className="font-medium text-text-primary mb-1">Un album ou un artiste est incorrect</p>
                                <p>
                                    Les données musicales proviennent de{" "}
                                    <a
                                        href="https://musicbrainz.org"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-2 hover:text-text-primary transition-colors duration-150"
                                    >
                                        MusicBrainz
                                    </a>
                                    . Tu peux y contribuer directement pour corriger une erreur.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-text-primary mb-1">Signaler un contenu inapproprié</p>
                                <p>Utilise le bouton « Signaler » disponible sur chaque entrée ou via le menu d'un profil.</p>
                            </div>
                        </div>
                    </section>
                </article>

                <footer className="mt-16 pt-8 border-t border-border-divider">
                    <nav className="flex flex-wrap gap-x-6 gap-y-2">
                        <Link href="/legal/mentions-legales" className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Mentions légales
                        </Link>
                        <Link href="/legal/confidentialite" className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            Confidentialité
                        </Link>
                        <Link href="/legal/cgu" className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            CGU
                        </Link>
                        <Link href="/faq" className="text-sm text-text-tertiary hover:text-text-primary transition-colors duration-150">
                            FAQ
                        </Link>
                    </nav>
                </footer>
            </div>
        </div>
    );
}
