"use client";

import { useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD = 16;
const TOP_OFFSET = 24;
const TOGGLE_COOLDOWN_MS = 200;

export function useScrollNavState() {
    const [isCompact, setIsCompact] = useState(false);
    const lastY = useRef(0);
    const lastToggleAt = useRef(0);

    useEffect(() => {
        lastY.current = window.scrollY;
        let frame = 0;

        const handleScroll = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const y = window.scrollY;
                const delta = y - lastY.current;
                const now = performance.now();
                const canToggle = now - lastToggleAt.current > TOGGLE_COOLDOWN_MS;

                if (y <= TOP_OFFSET) {
                    setIsCompact((prev) => {
                        if (prev) lastToggleAt.current = now;
                        return false;
                    });
                } else if (delta > SCROLL_THRESHOLD && canToggle) {
                    setIsCompact((prev) => {
                        if (!prev) lastToggleAt.current = now;
                        return true;
                    });
                } else if (delta < -SCROLL_THRESHOLD && canToggle) {
                    setIsCompact((prev) => {
                        if (prev) lastToggleAt.current = now;
                        return false;
                    });
                }

                lastY.current = y;
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return isCompact;
}
