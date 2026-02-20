"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { UserAvatar } from "@/components/avatars/DefaultAvatar";
import HomeIcon from "@/components/icons/HomeIcon";
import SearchIcon from "@/components/icons/SearchIcon";
import AddIcon from "@/components/icons/AddIcon";
import ProfileIcon from "@/components/icons/ProfileIcon";

export default function BottomNav() {
    const pathname = usePathname();
    const { user: authUser, profile } = useAuth();

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
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border flex justify-around items-center h-16 md:hidden z-50 bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center justify-center w-12 h-12 transition-colors duration-150 ${
                            active
                                ? "text-text-primary"
                                : "text-text-tertiary hover:text-text-secondary"
                        }`}
                        title={item.label}
                    >
                        <Icon />
                    </Link>
                );
            })}

            {/* Profile */}
            <Link
                href="/me"
                className={`flex flex-col items-center justify-center w-12 h-12 transition-colors duration-150 ${
                    isActive("/me")
                        ? "text-text-primary"
                        : "text-text-tertiary hover:text-text-secondary"
                }`}
                title="Profil"
            >
                {authUser ? (
                    <div className={`w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center ${
                        isActive("/me") ? "border-[#1C1C1C]" : "border-border"
                    }`}>
                        <UserAvatar userId={authUser.id} src={profile?.avatar_url} size={28} />
                    </div>
                ) : (
                    <ProfileIcon />
                )}
            </Link>
        </nav>
    );
}

