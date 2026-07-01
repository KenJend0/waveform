"use client";

import { useEffect } from "react";

export default function ScrollToHashClient() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const hash = window.location.hash;
        if (!hash) return;

        const id = hash.startsWith("#") ? hash.slice(1) : hash;

        let attempts = 0;
        const maxAttempts = 20;

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
            const PADDING = 24;
            const top = el.getBoundingClientRect().top + window.scrollY - (headerHeight + PADDING);
            window.scrollTo({ top, behavior: "smooth" });
        };

        // Defer first attempt to next tick to maximize chance element exists
        setTimeout(tryScroll, 0);
    }, []);

    return null;
}
