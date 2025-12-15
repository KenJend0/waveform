import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { cookies } from "next/headers";
import Image from "next/image";

export default async function Header() {
    const user = await getCurrentUser();
    const cookieStore = await cookies();

    const navItems = [
        { href: "/feed", label: "Feed" },
        { href: "/explore", label: "Explore" },
        { href: "/notifications", label: "Notifications", prefetch: false},
        { href: "/me", label: "Profile" },
        { href: "/settings", label: "Settings" },
    ];

    return (
        <header className="hidden md:flex items-center justify-between px-8 py-3 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50 shadow-lg">
            {/* LOGO */}
            <Link href="/feed" className="flex items-center space-x-2 group">
        <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
          Music
        </span>
                <span className="text-2xl font-extrabold tracking-tight text-emerald-400 group-hover:text-white transition-colors">
          Boxd
        </span>
            </Link>

            {/* NAVIGATION */}
            <nav className="flex space-x-8 items-center">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="text-gray-400 hover:text-emerald-400 transition-colors text-sm font-medium"
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* UTILISATEUR */}
            <div className="flex items-center space-x-4">
                {!user && (
                    <Link
                        href="/login"
                        className="text-gray-300 hover:text-emerald-400 text-sm transition"
                    >
                        Se connecter
                    </Link>
                )}

                {user && (
                    <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700">
                            <Image
                                src={user.picture_url || "/default-avatar.png"}
                                alt={user.display_name || "user"}
                                width={32}
                                height={32}
                                className="object-cover"
                            />
                        </div>

                        {/* Nom utilisateur */}
                        <span className="text-sm font-semibold text-emerald-400">
              {user.display_name || user.username}
            </span>

                        {/* Bouton logout */}
                        <LogoutButton />
                    </div>
                )}
            </div>
        </header>
    );
}
