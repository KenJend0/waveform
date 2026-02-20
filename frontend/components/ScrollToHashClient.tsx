"use client";

import { useEffect } from "react";

export default function ScrollToHashClient() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const hash = window.location.hash;
        if (!hash) return;

        const id = hash.startsWith("#") ? hash.slice(1) : hash;

        let attempts = 0;
        const maxAttempts = 10;

        const getHeaderHeight = () => {
            const selectors = ["header", "[role=\"banner\"]", ".Header", "#header", ".topnav", ".site-header"];
            for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) {
                    const style = getComputedStyle(el);
                    if (style.position === "fixed" || style.position === "sticky") {
                        return el.getBoundingClientRect().height;
                    }
                }
            }
            return 0;
        };

        const tryScroll = () => {
            const el = document.getElementById(id);
            if (!el) {
                attempts += 1;
                if (attempts < maxAttempts) {
                    setTimeout(tryScroll, 100);
                }
                return;
            }

            const headerHeight = getHeaderHeight();
            const PADDING = 40; // extra space so title sits lower on screen

            // 1) Scroll to bottom of the page
            const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({ top: maxScrollTop, behavior: "smooth" });

            // 2) After bottom scroll, check whether the reviews title is visible.
            // If not visible, align the top of the screen with the title (under header).
            setTimeout(() => {
                let checks = 0;
                const maxChecks = 6;
                const checkVisibility = () => {
                    const rect = el.getBoundingClientRect();
                    const isVisible = rect.top >= headerHeight && rect.top < window.innerHeight;
                    if (isVisible) return;

                    if (checks >= maxChecks) {
                        // Align top with the title (accounting for header+padding)
                        const top = rect.top + window.scrollY - (headerHeight + PADDING);
                        window.scrollTo({ top, behavior: "smooth" });
                        return;
                    }

                    checks += 1;
                    setTimeout(checkVisibility, 150);
                };

                checkVisibility();
            }, 250);
        };

        // Defer first attempt to next tick to maximize chance element exists
        setTimeout(tryScroll, 0);
    }, []);

    return null;
}
