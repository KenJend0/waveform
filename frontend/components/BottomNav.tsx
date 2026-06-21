"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useBottomSheet } from "@/lib/BottomSheetContext";
import { useScrollNavState } from "@/lib/useScrollNavState";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import CompassIcon from "@/components/icons/CompassIcon";
import NotificationsIcon from "@/components/icons/NotificationsIcon";
import AddIcon from "@/components/icons/AddIcon";
import ProfileIcon from "@/components/icons/ProfileIcon";

export default function BottomNav() {
    const pathname = usePathname();
    const { user: authUser, profile, unseenActivity } = useAuth();
    const { openCount } = useBottomSheet();
    const isScrollCompact = useScrollNavState();
    const shouldReduceMotion = useReducedMotion();

    if (openCount > 0) return null;

    const isMainPage = ["/feed", "/explore", "/add", "/me"].includes(pathname);
    // Hors des 4 pages principales (fiches artiste/album/track, journal, etc.),
    // la barre reste toujours compacte — ces pages sont denses et n'ont pas besoin
    // d'une barre pleine largeur avec labels.
    const isCompact = isScrollCompact || !isMainPage;

    const transition = shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.6 };

    const isActive = (route: string) => {
        if (route === "/feed") return pathname === "/feed";
        if (route === "/explore") return pathname === "/explore";
        if (route === "/add") return pathname === "/add";
        if (route === "/me") return pathname === "/me";
        return false;
    };

    const navItems = [
        { href: "/explore", icon: CompassIcon, label: "Découvrir" },
        { href: "/add", icon: AddIcon, label: "Ajouter" },
        { href: "/feed", icon: NotificationsIcon, label: "Activité" },
    ];

    const itemSizeClass = "flex-1";

    return (
        <div
            className="fixed inset-x-0 px-9 md:hidden z-50 flex justify-center"
            style={{
                bottom: 'calc(0.25rem + env(safe-area-inset-bottom))',
                // Force sa propre couche de composition GPU : sur iOS Safari, un élément
                // fixed + backdrop-blur dont le repaint survient pendant un scroll momentum
                // peut interrompre brutalement le scroll (bug WebKit connu).
                transform: 'translateZ(0)',
                willChange: 'transform',
            }}
        >
            <motion.nav
                transition={transition}
                style={{
                    // C'est cet élément (backdrop-blur + largeur animée) qu'iOS doit repeindre :
                    // l'isoler sur sa propre couche GPU et limiter la portée du repaint évite
                    // que la mutation interrompe le scroll momentum en cours.
                    transform: 'translateZ(0)',
                    willChange: 'transform, opacity',
                    contain: 'paint',
                }}
                className={`flex items-center min-h-11
                            bg-[#FAF8F4]/92 backdrop-blur-md border border-border
                            shadow-[0_8px_20px_-8px_rgba(60,40,20,0.18),0_1px_2px_rgba(0,0,0,0.04)]
                            justify-around transition-[width,border-radius,padding] duration-300 ease-out
                            ${isCompact ? "w-[78%] max-w-[320px] rounded-full px-2 py-1.5" : "w-full rounded-[20px] px-2 py-2"}`}
            >
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    if (item.href === "/add") {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex h-11 ${itemSizeClass} items-center justify-center text-[9px] leading-none ${
                                    active ? "text-text-warm" : "text-text-tertiary"
                                }`}
                            >
                                {active && (
                                    <span className="absolute left-1/2 -translate-x-1/2 -top-1 w-4 h-0.5 bg-accent rounded-full" />
                                )}
                                <motion.span
                                    animate={{ y: isCompact ? 0 : -5, rotate: -4 }}
                                    transition={transition}
                                    className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-text-warm text-[#FAF8F4]
                                                shadow-[0_4px_10px_-2px_rgba(60,40,20,0.3)]"
                                >
                                    <Icon />
                                </motion.span>
                                <motion.span
                                    animate={{ opacity: isCompact ? 0 : 1 }}
                                    transition={transition}
                                    className="absolute bottom-1 text-[9px] leading-none pointer-events-none"
                                >
                                    Ajouter
                                </motion.span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex h-11 ${itemSizeClass} items-center justify-center transition-colors duration-150 ${
                                active ? "text-text-warm" : "text-text-tertiary"
                            }`}
                        >
                            {active && (
                                <span className="absolute left-1/2 -translate-x-1/2 -top-1 w-4 h-0.5 bg-accent rounded-full" />
                            )}
                            <motion.span
                                animate={{ y: isCompact ? 0 : -5 }}
                                transition={transition}
                                className="relative flex h-6 w-6 items-center justify-center"
                            >
                                <Icon />
                                {item.href === "/feed" && unseenActivity && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full" />
                                )}
                            </motion.span>
                            <motion.span
                                animate={{ opacity: isCompact ? 0 : 1 }}
                                transition={transition}
                                className="absolute bottom-1 text-[9px] leading-none pointer-events-none"
                            >
                                {item.label}
                            </motion.span>
                        </Link>
                    );
                })}

                {/* Profile */}
                <Link
                    href="/me"
                    className={`relative flex h-11 ${itemSizeClass} items-center justify-center transition-colors duration-150 ${
                        isActive("/me") ? "text-text-warm" : "text-text-tertiary"
                    }`}
                >
                    {isActive("/me") && (
                        <span className="absolute left-1/2 -translate-x-1/2 -top-1 w-4 h-0.5 bg-accent rounded-full" />
                    )}
                    <motion.span
                        animate={{ y: isCompact ? 0 : -5 }}
                        transition={transition}
                        className="flex h-6 w-6 items-center justify-center"
                    >
                        {authUser ? (
                            <div className={`h-[22px] w-[22px] rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center ${
                                isActive("/me") ? "border-accent" : "border-border"
                            }`}>
                                <UserAvatar userId={authUser.id} src={profile?.avatar_url} size={22} />
                            </div>
                        ) : (
                            <ProfileIcon />
                        )}
                    </motion.span>
                    <motion.span
                        animate={{ opacity: isCompact ? 0 : 1 }}
                        transition={transition}
                        className="absolute bottom-1 text-[9px] leading-none pointer-events-none"
                    >
                        Moi
                    </motion.span>
                </Link>
            </motion.nav>
        </div>
    );
}
