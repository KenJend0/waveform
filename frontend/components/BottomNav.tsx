"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useBottomSheet } from "@/lib/BottomSheetContext";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import HomeIcon from "@/components/icons/HomeIcon";
import SearchIcon from "@/components/icons/SearchIcon";
import AddIcon from "@/components/icons/AddIcon";
import ProfileIcon from "@/components/icons/ProfileIcon";

export default function BottomNav() {
    const pathname = usePathname();
    const { user: authUser, profile } = useAuth();
    const { openCount } = useBottomSheet();

    if (openCount > 0) return null;

    const isActive = (route: string) => {
        if (route === "/feed") return pathname === "/feed";
        if (route === "/explore") return pathname === "/explore";
        if (route === "/add") return pathname === "/add" || pathname === "/import" || pathname === "/diary";
        if (route === "/me") return pathname === "/me" || pathname.startsWith("/u/");
        return false;
    };

    const navItems = [
        { href: "/feed", icon: HomeIcon, label: "Feed" },
        { href: "/explore", icon: SearchIcon, label: "Explore" },
        { href: "/add", icon: AddIcon, label: "Ajouter" },
    ];

    return (
        <nav className="fixed left-5 right-5 md:hidden z-50 flex items-center justify-around
                        bg-[#FAF8F4]/92 backdrop-blur-md border border-border rounded-[20px]
                        px-2 py-2
                        shadow-[0_8px_20px_-8px_rgba(60,40,20,0.18),0_1px_2px_rgba(0,0,0,0.04)]"
             style={{ bottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}>
            {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                if (item.href === "/add") {
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 text-[9px] leading-none text-text-warm"
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-text-warm text-[#FAF8F4]
                                            shadow-[0_4px_10px_-2px_rgba(60,40,20,0.3)]"
                                  style={{ transform: 'rotate(-4deg)' }}>
                                <Icon />
                            </span>
                            <span className="text-[9px] leading-none">Ajouter</span>
                        </Link>
                    );
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`relative flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                            active ? "text-text-warm" : "text-text-tertiary"
                        }`}
                    >
                        {active && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full" />
                        )}
                        <Icon />
                        <span className="text-[9px] leading-none">{item.label}</span>
                    </Link>
                );
            })}

            {/* Profile */}
            <Link
                href="/me"
                className={`relative flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                    isActive("/me") ? "text-text-warm" : "text-text-tertiary"
                }`}
            >
                {isActive("/me") && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-accent rounded-full" />
                )}
                {authUser ? (
                    <div className={`h-[22px] w-[22px] rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center ${
                        isActive("/me") ? "border-accent" : "border-border"
                    }`}>
                        <UserAvatar userId={authUser.id} src={profile?.avatar_url} size={22} />
                    </div>
                ) : (
                    <ProfileIcon />
                )}
                <span className="text-[9px] leading-none">Moi</span>
            </Link>
        </nav>
    );
}

