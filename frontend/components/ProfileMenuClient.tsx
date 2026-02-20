// components/ProfileMenuClient.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function ProfileMenuClient() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { signOut } = useAuth();

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
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-[8px] hover:bg-background-tertiary transition-colors duration-150 text-text-secondary hover:text-text-primary"
        title="Menu profil"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10.5 1.5H3.75A2.25 2.25 0 001.5 3.75v12.5A2.25 2.25 0 003.75 18.5h12.5a2.25 2.25 0 002.25-2.25V9.5m-15-4h0m4 0h0m4 0h0M5.5 14h9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-[8px] overflow-hidden z-50">
          <Link
            href="/settings/profile"
            className="block px-4 py-3 text-meta text-text-primary hover:bg-background-tertiary transition-colors duration-150"
            onClick={() => setIsOpen(false)}
          >
            ðŸ‘¤ Mon profil
          </Link>
          <Link
            href="/settings"
            className="block px-4 py-3 text-meta text-text-primary hover:bg-background-tertiary transition-colors duration-150"
            onClick={() => setIsOpen(false)}
          >
            âš™ï¸ ParamÃ¨tres
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full text-left px-4 py-3 text-meta text-text-tertiary hover:text-[#C86C6C] hover:bg-background-tertiary transition-colors duration-150 disabled:opacity-50"
          >
            {isLoggingOut ? "DÃ©connexion..." : "ðŸšª Se dÃ©connecter"}
          </button>
        </div>
      )}
    </div>
  );
}

