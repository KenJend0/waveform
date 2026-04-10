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
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border flex justify-around items-center md:hidden z-50 bg-background/95 backdrop-blur-sm h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors duration-150 ${
                            active
                                ? "text-text-primary"
                                : "text-text-tertiary hover:text-text-secondary"
                        }`}
                    >
                        <Icon />
                        <span className="text-[10px] leading-none">{item.label}</span>
                    </Link>
                );
            })}

            {/* Profile */}
            <Link
                href="/me"
                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors duration-150 ${
                    isActive("/me")
                        ? "text-text-primary"
                        : "text-text-tertiary hover:text-text-secondary"
                }`}
            >
                {authUser ? (
                    <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center ${
                        isActive("/me") ? "border-[#1C1C1C]" : "border-border"
                    }`}>
                        <UserAvatar userId={authUser.id} src={profile?.avatar_url} size={24} />
                    </div>
                ) : (
                    <ProfileIcon />
                )}
                <span className="text-[10px] leading-none">Profil</span>
            </Link>
        </nav>
    );
}

