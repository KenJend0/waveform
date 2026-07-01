'use client';

import { useEffect, useRef } from 'react';
import SearchOverlay from '@/components/layout/SearchOverlay';
import { useHeaderSearch } from '@/lib/HeaderSearchContext';

export default function StickySearchBar() {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { showHeaderSearch, setShowHeaderSearch } = useHeaderSearch();

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const media = window.matchMedia('(min-width: 1024px)');
        const updateForViewport = () => {
            if (!media.matches) setShowHeaderSearch(false);
        };

        const observer = new IntersectionObserver(
            ([entry]) => {
                setShowHeaderSearch(media.matches && !entry.isIntersecting);
            },
            {
                root: null,
                threshold: 0,
                rootMargin: '-64px 0px 0px 0px',
            }
        );

        observer.observe(el);
        updateForViewport();
        media.addEventListener('change', updateForViewport);

        return () => {
            observer.disconnect();
            media.removeEventListener('change', updateForViewport);
            setShowHeaderSearch(false);
        };
    }, [setShowHeaderSearch]);

    return (
        <div
            ref={wrapperRef}
            className="sticky top-0 z-40 mb-5 bg-background px-6 py-2 md:top-16 lg:static lg:z-auto lg:bg-transparent lg:px-0"
        >
            <SearchOverlay shortcutEnabled={!showHeaderSearch} />
        </div>
    );
}
