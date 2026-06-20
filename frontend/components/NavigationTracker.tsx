"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export const NAV_PREV_KEY = "wf_nav_prev";

export function getNavLabel(pathname: string): string {
    if (pathname === "/feed") return "Activité";
    if (pathname === "/") return "Découvrir";
    if (pathname === "/diary") return "Journal";
    if (pathname.startsWith("/diary/")) return "Journal";
    if (pathname === "/track-diary") return "Journal";
    if (pathname.startsWith("/track-diary/")) return "Journal";
    if (pathname.startsWith("/search")) return "Recherche";
    if (pathname === "/explore") return "Découvrir";
    if (pathname === "/explore/tendances") return "Tendances";
    if (pathname.startsWith("/explore/")) return "Découvrir";
    if (pathname.startsWith("/u/")) return "Profil";
    if (pathname === "/me") return "Mon profil";
    if (pathname.startsWith("/settings")) return "Paramètres";
    if (pathname.startsWith("/lists/")) return "Listes";
    if (pathname.startsWith("/albums/")) return "Albums";
    if (pathname.startsWith("/artists/")) return "Artistes";
    if (pathname.startsWith("/tracks/")) return "Titres";
    return "Retour";
}

export default function NavigationTracker() {
    const pathname = usePathname();
    const prev = useRef<string | null>(null);

    useEffect(() => {
        if (prev.current !== null && prev.current !== pathname) {
            sessionStorage.setItem(NAV_PREV_KEY, JSON.stringify({
                label: getNavLabel(prev.current),
                href: prev.current,
            }));
        }
        prev.current = pathname;
    }, [pathname]);

    return null;
}
