"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Ban, CircleSlash } from "lucide-react";
import { toggleBlock } from "@/app/actions/social";
import { showToast } from "@/components/ui/Toast";

interface ProfileActionsMenuProps {
  userId: string;
  initialIsBlocking: boolean;
}

export default function ProfileActionsMenu({ userId, initialIsBlocking }: ProfileActionsMenuProps) {
  const router = useRouter();
  const [isBlocking, setIsBlocking] = useState(initialIsBlocking);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleBlockClick = () => {
    if (isBlocking) {
      // Unblock: no confirmation needed
      handleConfirm();
    } else {
      setConfirming(true);
    }
  };

  const handleConfirm = async () => {
    setOpen(false);
    setConfirming(false);
    try {
      setLoading(true);
      const result = await toggleBlock(userId);
      if (result.success) {
        setIsBlocking(result.blocking ?? false);
        showToast(result.blocking ? "Utilisateur bloqué" : "Utilisateur débloqué", "success");
        router.refresh();
      } else {
        showToast(result.error ?? "Une erreur est survenue", "error");
      }
    } catch {
      showToast("Une erreur est survenue", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirming(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        disabled={loading}
        className="flex items-center justify-center w-9 h-9 rounded-[8px] text-text-tertiary hover:text-text-secondary hover:bg-background-tertiary transition-colors duration-150 disabled:opacity-50"
        aria-label="Plus d'options"
      >
        {loading ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <MoreHorizontal size={16} />
        )}
      </button>

      {open && (
        <div className="absolute top-11 right-0 z-50 bg-background border border-border rounded-[12px] overflow-hidden min-w-[200px] shadow-sm">
          {!confirming ? (
            <button
              onClick={handleBlockClick}
              className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors duration-150 text-left hover:bg-background-secondary ${
                isBlocking ? "text-text-secondary" : "text-[#C86C6C]"
              }`}
            >
              {isBlocking ? <CircleSlash size={14} /> : <Ban size={14} />}
              {isBlocking ? "Débloquer" : "Bloquer"}
            </button>
          ) : (
            <div className="px-4 py-3 space-y-3">
              <p className="text-sm text-text-primary leading-[1.5]">
                Son contenu disparaîtra de ton feed et il ne pourra plus te suivre.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-1.5 text-label font-medium rounded-[8px] border border-border text-text-secondary hover:bg-background-secondary transition-colors duration-150"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-3 py-1.5 text-label font-medium rounded-[8px] bg-[#C86C6C] text-white hover:opacity-90 transition-opacity duration-150"
                >
                  Bloquer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
