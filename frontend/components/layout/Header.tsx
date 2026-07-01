'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import ProfileMenuClient from "@/components/profile/ProfileMenuClient";
import SearchOverlay from "@/components/layout/SearchOverlay";
import { useHeaderSearch } from "@/lib/HeaderSearchContext";
import { Plus } from "lucide-react";

export default function Header() {
    const { user, loading, unseenActivity } = useAuth();
    const { showHeaderSearch } = useHeaderSearch();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [headerSearchOpen, setHeaderSearchOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { href: "/explore", label: "Découvrir" },
        { href: "/add", label: "Ajouter", primary: true },
        { href: "/feed", label: "Activité" },
        { href: "/me", label: "Moi" },
    ];

    const isActive = (href: string) => {
        if (!mounted) return false;
        return pathname === href || pathname.startsWith(href + "/");
    };

    if (loading) return null;

    return (
        <header
            className="hidden md:block sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-8 xl:px-10">
                {/* LOGO — à gauche */}
                <Link
                    href="/explore"
                    className="group flex min-w-[172px] items-center gap-2.5 text-text-warm transition-opacity duration-150 hover:opacity-80 lg:min-w-[260px]"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo/mark.svg" alt="" aria-hidden="true" className="h-5 w-auto" />
                    <span className="font-display italic text-[23px] leading-none">
                        Waveform
                    </span>
                </Link>

                {/* NAVIGATION — capsule desktop */}
                <nav className="flex flex-1 justify-center">
                    <div className="flex items-center gap-1 rounded-full border border-border bg-paper-hi/90 p-1 shadow-[0_8px_20px_-16px_rgba(60,40,20,0.35),0_1px_2px_rgba(0,0,0,0.03)]">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            const isPrimary = Boolean(item.primary);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium leading-none transition-all duration-150 ${
                                        isPrimary
                                            ? active
                                                ? "bg-text-warm text-paper-hi shadow-[0_6px_14px_-8px_rgba(42,37,32,0.55)]"
                                                : "bg-text-warm text-paper-hi shadow-[0_6px_14px_-8px_rgba(42,37,32,0.42)] hover:opacity-90"
                                            : active
                                                ? "bg-background-secondary text-text-primary"
                                                : "text-text-secondary hover:bg-background-secondary/70 hover:text-text-primary"
                                    }`}
                                >
                                    {isPrimary && <Plus size={14} strokeWidth={2} />}
                                    <span>{item.label}</span>
                                    {item.href === "/feed" && unseenActivity && (
                                        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* MENU PROFIL — à droite, ou CTA auth si non connecté */}
                <div className="flex min-w-[172px] items-center justify-end gap-3 lg:min-w-[260px]">
                    <div
                        className={`hidden transition-all duration-200 lg:block ${
                            headerSearchOpen ? "w-80 xl:w-96" : "w-44 xl:w-56"
                        } ${
                            showHeaderSearch
                                ? "translate-y-0 opacity-100"
                                : "pointer-events-none translate-y-1 opacity-0"
                        }`}
                    >
                        <SearchOverlay
                            variant="header"
                            shortcutEnabled={showHeaderSearch}
                            onOpenChange={setHeaderSearchOpen}
                        />
                    </div>
                    {user ? (
                        <ProfileMenuClient />
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/auth"
                                className="text-meta font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
                            >
                                Se connecter
                            </Link>
                            <Link
                                href="/auth?mode=signup"
                                className="rounded-button bg-text-warm px-4 py-2 text-meta font-medium text-paper-hi transition-opacity duration-150 hover:opacity-90"
                            >
                                Créer un compte
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

