"use client";

import { useEffect, useRef, useState } from "react";

const SCROLL_THRESHOLD = 16;
const TOP_OFFSET = 24;
const COMPACT_AFTER_Y = 80;
// Délai avant d'appliquer le changement visuel. Sur iOS Safari, muter le style
// d'un élément fixed + backdrop-blur PENDANT un scroll momentum peut figer le
// scroll en cours. Le timer est repoussé à CHAQUE événement de scroll qui
// confirme la même valeur, pas seulement quand la valeur change — sinon il
// peut se déclencher en plein milieu d'un scroll continu.
const COMMIT_DELAY_MS = 140;

export function useScrollNavState() {
    const [isCompact, setIsCompact] = useState(false);

    const isCompactRef = useRef(false);
    const lastY = useRef(0);
    const frame = useRef<number | null>(null);
    const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingValue = useRef<boolean | null>(null);

    useEffect(() => {
        lastY.current = window.scrollY;

        const commitAfterScrollSettles = (value: boolean) => {
            pendingValue.current = value;

            if (commitTimer.current) {
                clearTimeout(commitTimer.current);
            }

            commitTimer.current = setTimeout(() => {
                const nextValue = pendingValue.current;

                if (nextValue !== null && nextValue !== isCompactRef.current) {
                    isCompactRef.current = nextValue;
                    setIsCompact(nextValue);
                }

                pendingValue.current = null;
                commitTimer.current = null;
            }, COMMIT_DELAY_MS);
        };

        const handleScroll = () => {
            if (frame.current !== null) return;

            frame.current = requestAnimationFrame(() => {
                frame.current = null;

                const y = window.scrollY;
                const delta = y - lastY.current;

                const isAtTop = y <= TOP_OFFSET;
                const isScrollingDown = delta > SCROLL_THRESHOLD;
                const isScrollingUp = delta < -SCROLL_THRESHOLD;

                if (isAtTop) {
                    commitAfterScrollSettles(false);
                } else if (y > COMPACT_AFTER_Y && isScrollingDown) {
                    commitAfterScrollSettles(true);
                } else if (isScrollingUp) {
                    commitAfterScrollSettles(false);
                }

                lastY.current = y;
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);

            if (frame.current !== null) {
                cancelAnimationFrame(frame.current);
            }

            if (commitTimer.current) {
                clearTimeout(commitTimer.current);
            }
        };
    }, []);

    return isCompact;
}
