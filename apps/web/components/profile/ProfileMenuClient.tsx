// components/ProfileMenuClient.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Settings, Heart, LifeBuoy, LogOut, Shield, BarChart2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { showToast } from "@/components/ui/Toast";

export default function ProfileMenuClient() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { signOut, isAdmin } = useAuth();

  // Fermer le menu quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("Logout error:", e);
      showToast("Erreur lors de la déconnexion", "error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button — même icône que ProfileHeader /me */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-[8px] hover:bg-background-tertiary transition-colors duration-150"
        title="Menu profil"
      >
        <Menu size={20} className="text-text-secondary" />
      </button>

      {/* Dropdown Menu — même style que ProfileHeader /me */}
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-background border border-border rounded-[12px] overflow-hidden min-w-48 z-50 shadow-sm">
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
          >
            <Settings size={16} />
            Éditer mon profil
          </Link>
          <Link
            href="/settings/favorite-albums"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
          >
            <Heart size={16} />
            Mes albums favoris
          </Link>
          <Link
            href="/me/stats"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
          >
            <BarChart2 size={16} />
            Mes statistiques
          </Link>
          <Link
            href="/legal"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
          >
            <LifeBuoy size={16} />
            Aide & support
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta text-text-primary"
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-secondary transition-colors duration-150 text-meta border-t border-border-divider text-[#C86C6C] text-left disabled:opacity-50"
          >
            <LogOut size={16} />
            {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}

