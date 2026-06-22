"use client";

import { useRef, useState, useEffect } from "react";
import { type UserList } from "@/app/actions/lists";

type Props = {
    lists: Pick<UserList, "id" | "title" | "is_default" | "item_count">[];
    selectedListId: string | null;
    onSelect: (listId: string) => void;
    isLoading?: boolean;
};

export default function ListSwitcher({ lists, selectedListId, onSelect, isLoading }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    const selected = lists.find((l) => l.id === selectedListId) ?? lists[0];

    return (
        <div className="relative mb-3" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen((v) => !v)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-50"
            >
                <span className="truncate max-w-[180px]">{selected?.title ?? "Choisir une liste"}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}>
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-56 bg-background border border-border rounded-[12px] shadow-lg z-50 overflow-hidden">
                    {lists.map((list) => (
                        <button
                            key={list.id}
                            onClick={() => {
                                onSelect(list.id);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background-secondary transition-colors text-left ${
                                list.id === selectedListId ? "text-text-primary" : "text-text-secondary"
                            }`}
                        >
                            <span className="text-[13px] truncate">{list.title}</span>
                            <span className="text-[10px] text-text-tertiary shrink-0">{list.item_count}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
