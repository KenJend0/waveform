import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Shield, ScrollText, HelpCircle, LifeBuoy } from "lucide-react";

export const metadata: Metadata = {
    title: "Légal — Waveform",
};

const links = [
    {
        href: "/faq",
        icon: HelpCircle,
        label: "FAQ",
        description: "Questions fréquentes sur l'utilisation de Waveform",
    },
    {
        href: "/support",
        icon: LifeBuoy,
        label: "Support",
        description: "Besoin d'aide ? Contacte-nous",
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
        description: "Comment nous traitons vos données personnelles (RGPD)",
    },
    {
        href: "/legal/mentions-legales",
        icon: FileText,
        label: "Mentions légales",
        description: "Informations légales sur l'éditeur et l'hébergement",
    },
];

export default function LegalIndex() {
    return (
        <article>
            <h1 className="text-h1 text-text-primary mb-2">Légal & informations</h1>
            <p className="text-[14px] text-text-secondary mb-10">
                Waveform — Journal musical social.
            </p>

            <div className="space-y-2">
                {links.map(({ href, icon: Icon, label, description }) => (
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

            <div className="mt-12 pt-8 border-t border-border-divider">
                <p className="text-[13px] text-text-tertiary">
                    Une question ?{" "}
                    <a
                        href="mailto:waveform.contact@proton.me"
                        className="text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors duration-150"
                    >
                        waveform.contact@proton.me
                    </a>
                </p>
            </div>
        </article>
    );
}
