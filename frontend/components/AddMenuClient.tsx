"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import AddIcon from "@/components/icons/AddIcon";
import { Disc3, BookOpen } from "lucide-react";

export default function AddMenuClient() {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fermer le menu en cliquant en dehors
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="mx-2 px-3 py-2 hover:bg-background-tertiary text-text-primary rounded-[8px] font-medium transition-colors duration-150 text-meta flex items-center gap-3"
            >
                <div className="w-4 h-6">
                    <AddIcon />
                </div>
                Ajouter
            </button>

            {/* Menu dÃ©roulant */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-background border border-border rounded-[8px] overflow-hidden z-50">
                    <Link
                        href="/import"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-meta text-text-primary hover:bg-background-tertiary transition-colors duration-150 border-b border-border/40"
                    >
                        <Disc3 size={20} className="text-text-secondary" />
                        <div className="text-left">
                            <div className="font-medium">Ajouter un album</div>
                            <div className="text-label text-text-tertiary">Importer dans ta bibliothÃ¨que</div>
                        </div>
                    </Link>
                    <Link
                        href="/diary"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-meta text-text-primary hover:bg-background-tertiary transition-colors duration-150"
                    >
                        <BookOpen size={20} className="text-text-secondary" />
                        <div className="text-left">
                            <div className="font-medium">Ajouter une diary</div>
                            <div className="text-label text-text-tertiary">Noter ton Ã©coute</div>
                        </div>
                    </Link>
                </div>
            )}
        </div>
    );
}

