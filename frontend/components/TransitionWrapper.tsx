"use client";

import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "@/lib/titleTransition";
import { cn } from "@/lib/cn";

export function TransitionWrapper({ children }: { children: React.ReactNode }) {
  const transitioning = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false // SSR fallback — always visible on server
  );

  return (
    <div
      className={cn(
        "transition-opacity duration-700 ease-out",
        transitioning ? "opacity-0" : "opacity-100"
      )}
    >
      {children}
    </div>
  );
}
