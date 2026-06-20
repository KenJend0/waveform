"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    const isCompact = useScrollNavState();
    const shouldReduceMotion = useReducedMotion();

    if (openCount > 0) return null;

    const transition = shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.6 };

    const isActive = (route: string) => {
        if (route === "/feed") return pathname === "/feed";
        if (route === "/explore") return pathname === "/explore";
        if (route === "/add") return pathname === "/add" || pathname === "/import" || pathname === "/diary";
        if (route === "/me") return pathname === "/me" || pathname.startsWith("/u/");
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
            style={{ bottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
        >
            <motion.nav
                layout
                transition={transition}
                className={`flex items-center min-h-11
                            bg-[#FAF8F4]/92 backdrop-blur-md border border-border
                            shadow-[0_8px_20px_-8px_rgba(60,40,20,0.18),0_1px_2px_rgba(0,0,0,0.04)]
                            justify-around
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
                                className={`relative flex h-11 ${itemSizeClass} flex-col items-center justify-center gap-0.5 text-[9px] leading-none ${
                                    active ? "text-text-warm" : "text-text-tertiary"
                                }`}
                            >
                                {active && (
                                    <span className={`absolute left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full ${isCompact ? "-top-2" : "-top-2.5"}`} />
                                )}
                                <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-text-warm text-[#FAF8F4]
                                                shadow-[0_4px_10px_-2px_rgba(60,40,20,0.3)]"
                                      style={{ transform: 'rotate(-4deg)' }}>
                                    <Icon />
                                </span>
                                <AnimatePresence initial={false}>
                                    {!isCompact && (
                                        <motion.span
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={transition}
                                            className="text-[9px] leading-none overflow-hidden"
                                        >
                                            Ajouter
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex h-11 ${itemSizeClass} flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                                active ? "text-text-warm" : "text-text-tertiary"
                            }`}
                        >
                            {active && (
                                <span className={`absolute left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full ${isCompact ? "-top-2" : "-top-2.5"}`} />
                            )}
                            <span className="relative flex h-6 w-6 items-center justify-center">
                                <Icon />
                                {item.href === "/feed" && unseenActivity && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full" />
                                )}
                            </span>
                            <AnimatePresence initial={false}>
                                {!isCompact && (
                                    <motion.span
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={transition}
                                        className="text-[9px] leading-none overflow-hidden"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>
                    );
                })}

                {/* Profile */}
                <Link
                    href="/me"
                    className={`relative flex h-11 ${itemSizeClass} flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                        isActive("/me") ? "text-text-warm" : "text-text-tertiary"
                    }`}
                >
                    {isActive("/me") && (
                        <span className={`absolute left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full ${isCompact ? "-top-2" : "-top-2.5"}`} />
                    )}
                    <span className="flex h-6 w-6 items-center justify-center">
                        {authUser ? (
                            <div className={`h-[22px] w-[22px] rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center ${
                                isActive("/me") ? "border-accent" : "border-border"
                            }`}>
                                <UserAvatar userId={authUser.id} src={profile?.avatar_url} size={22} />
                            </div>
                        ) : (
                            <ProfileIcon />
                        )}
                    </span>
                    <AnimatePresence initial={false}>
                        {!isCompact && (
                            <motion.span
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={transition}
                                className="text-[9px] leading-none overflow-hidden"
                            >
                                Moi
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Link>
            </motion.nav>
        </div>
    );
}
