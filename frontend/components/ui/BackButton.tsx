"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_PREV_KEY } from "@/components/background/NavigationTracker";

type Props = { fallbackHref?: string; label?: string; className?: string };

export default function BackButton({ fallbackHref = "/", label = "Retour", className = "" }: Props) {
    const router = useRouter();
    const [prevLabel, setPrevLabel] = useState<string | null>(null);

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(NAV_PREV_KEY);
            if (stored) setPrevLabel(JSON.parse(stored).label);
        } catch {}
    }, []);

    const displayLabel = prevLabel ?? label;

    const onClick = () => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
    };

    return (
        <>
            {/* Mobile : fixed sans fond pleine-largeur — pilule discrète derrière le bouton seulement */}
            <div className="md:hidden fixed top-3 left-4 z-30">
                <button
                    type="button"
                    onClick={onClick}
                    className={`inline-flex items-center gap-1.5 text-[13px] text-text-primary hover:text-accent transition-colors bg-background/80 backdrop-blur-md border border-border/50 rounded-full px-3 py-1.5 shadow-sm${className ? ` ${className}` : ""}`}
                    aria-label={displayLabel}
                >
                    ← {displayLabel}
                </button>
            </div>
            {/* Spacer pour que le contenu ne parte pas sous le bouton fixe */}
            <div className="md:hidden h-[49px]" aria-hidden="true" />
            {/* Desktop : inline comme avant */}
            <button
                type="button"
                onClick={onClick}
                className={`hidden md:inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors${className ? ` ${className}` : ""}`}
                aria-label={displayLabel}
            >
                ← {displayLabel}
            </button>
        </>
    );
}
