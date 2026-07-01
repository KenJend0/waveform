import type { Metadata } from "next";
import Link from "next/link";
import { Mail, FileText, Shield, ScrollText, Trash2, HelpCircle } from "lucide-react";
import LegalSection from "@/components/legal/LegalSection";

export const metadata: Metadata = {
    title: "Aide & support",
    description: "Besoin d'aide avec Waveform ? Contacte-nous ou consulte nos ressources.",
};

const resources = [
    {
        href: "/faq",
        icon: HelpCircle,
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
        href: "/legal/mentions-legales",
        icon: FileText,
        label: "Mentions légales",
        description: "Informations légales sur l'éditeur et l'hébergement",
    },
    {
        href: "/settings",
        icon: Trash2,
        label: "Supprimer mon compte",
        description: "Réglages → Zone dangereuse → Supprimer le compte",
    },
];

export default function LegalIndex() {
    return (
        <article>
            <h1 className="text-h1 text-text-primary mb-2">Aide & support</h1>
            <p className="text-[14px] text-text-secondary mb-10">
                Une question, un problème ou une suggestion ? On est là.
            </p>

            <LegalSection title="Nous contacter">
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
            </LegalSection>

            <LegalSection title="Ressources utiles">
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
            </LegalSection>
        </article>
    );
}
