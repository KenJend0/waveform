"use client";

import { useEffect, useState, useRef } from "react";
import {
  clearTitleTransition,
  getTitleTransition,
  subscribe,
  type TitleTransitionPayload,
} from "@/lib/titleTransition";

const FADEOUT_DURATION = 700; // ms — content fades to silence
const MOVE_DURATION = 900;   // ms — title glides to destination
const SAFETY_TIMEOUT = 4000; // ms — fallback if target never registers

/**
 * Cinematic title overlay.
 *
 * Timeline:
 *   T=0          click — ghost appears at `from`, page fades out (700 ms)
 *   T=700        world is silent — ghost begins gliding to `to` (900 ms)
 *   T=1600       ghost arrives — overlay removed, page fades back in (700 ms)
 *   T=2300       done
 */
export function TitleTransitionOverlay() {
  const [p, setP] = useState<TitleTransitionPayload | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "waiting" | "ready" | "moving"
  >("idle");

  const moveScheduled = useRef(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- subscribe to store (replaces polling) ---- */
  useEffect(() => {
    const sync = () => setP(getTitleTransition());
    sync();
    const unsub = subscribe(sync);
    return () => { unsub(); };
  }, []);

  /* ---- idle → waiting (as soon as `from` exists) ---- */
  useEffect(() => {
    if (p?.from && phase === "idle") {
      setPhase("waiting");
      moveScheduled.current = false;
    }
    if (!p && phase !== "idle") {
      setPhase("idle");
      moveScheduled.current = false;
    }
  }, [p, phase]);

  /* ---- waiting → ready → moving (once `to` arrives & fade-out elapsed) ---- */
  useEffect(() => {
    if (phase !== "waiting" || !p?.to || moveScheduled.current) return;
    moveScheduled.current = true;

    const elapsed = Date.now() - p.startedAt;
    const remaining = Math.max(0, FADEOUT_DURATION - elapsed);

    moveTimer.current = setTimeout(() => {
      // Render one frame at `from` position with transition enabled,
      // then flip to `to` so the browser can interpolate.
      setPhase("ready");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase("moving");
        });
      });
    }, remaining);

    return () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, !!p?.to]);

  /* ---- moving → done (after glide) ---- */
  useEffect(() => {
    if (phase !== "moving") return;

    const t = setTimeout(() => {
      clearTitleTransition();
      setPhase("idle");
      moveScheduled.current = false;
    }, MOVE_DURATION);

    return () => clearTimeout(t);
  }, [phase]);

  /* ---- safety: clear if target never registers ---- */
  useEffect(() => {
    if (!p) return;
    const t = setTimeout(() => {
      clearTitleTransition();
      setPhase("idle");
      moveScheduled.current = false;
    }, SAFETY_TIMEOUT);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.startedAt]);

  /* ---- don't render when idle ---- */
  if (!p?.from || phase === "idle") return null;

  const from = p.from;
  const to = p.to;
  const atTarget = phase === "moving" && !!to;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div
        style={{
          position: "absolute",
          top: atTarget ? to!.top : from.top,
          left: atTarget ? to!.left : from.left,
          width: atTarget ? to!.width : from.width,
          fontSize:
            atTarget && to!.fontSize
              ? to!.fontSize
              : from.fontSize || "18px",
          fontWeight:
            atTarget && to!.fontWeight
              ? to!.fontWeight
              : from.fontWeight || "500",
          color: "#1C1C1C", // texte principal
          lineHeight: 1.2,
          transition:
            phase === "ready" || phase === "moving"
              ? `all ${MOVE_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`
              : "none",
        }}
      >
        {p.label}
      </div>
    </div>
  );
}
