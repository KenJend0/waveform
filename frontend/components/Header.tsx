'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import AddMenuClient from "@/components/AddMenuClient";
import ProfileMenuClient from "@/components/ProfileMenuClient";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";

export default function Header() {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { href: "/feed", label: "Feed" },
        { href: "/explore", label: "Explore" },
        { href: "/add", label: "Ajouter" },
        { href: "/me", label: "Profile" },
    ];

    const isActive = (href: string) => {
        if (!mounted) return false;
        return pathname === href || pathname.startsWith(href + "/");
    };

    return (
        user && (
            <header
                className="hidden md:flex items-center px-8 py-3 border-b border-border sticky top-0 z-50 bg-background"
            >
                {/* LOGO — à gauche */}
                <Link href="/" className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo/mark.svg" alt="" aria-hidden="true" className="h-5 w-auto" />
                    <span className="font-display italic text-[22px] leading-none text-text-warm">
                        Waveform
                    </span>
                </Link>

                {/* NAVIGATION — centrée */}
                <nav className="flex-1 flex justify-center space-x-6 items-center">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-meta font-medium px-6 py-2 transition-colors duration-150 ${
                                isActive(item.href)
                                    ? "text-text-primary"
                                    : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* MENU PROFIL — à droite */}
                <ProfileMenuClient />
            </header>
        )
    );
}

