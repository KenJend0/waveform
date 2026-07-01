"use client";

import { useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";
import { useBottomSheet } from "@/lib/BottomSheetContext";

export type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxHeight?: string;
};

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = "max-h-[50vh]",
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { register, unregister } = useBottomSheet();

  // Register/unregister in context to hide BottomNav
  useEffect(() => {
    if (isOpen) {
      register();
      return () => unregister();
    }
  }, [isOpen, register, unregister]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#1C1C1C]/40 z-[60] flex items-end"
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className={`w-full bg-background rounded-t-[20px] border border-border border-b-0 flex flex-col ${maxHeight} animate-in slide-in-from-bottom-5 duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-divider flex-shrink-0">
          <h2 className="text-body font-medium font-sans text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-background-secondary rounded-[8px] transition-colors duration-150 flex-shrink-0"
          >
            <X size={18} className="text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
