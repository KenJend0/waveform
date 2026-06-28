'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 110;

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

/**
 * Réimplémente le pull-to-refresh manquant en mode standalone (PWA "ajouter à l'écran
 * d'accueil") : iOS désactive le rubber-band scroll dans ce mode, qui est le geste dont
 * dépend le pull-to-refresh natif de Safari.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>, enabled: boolean) {
  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const distanceRef = useRef(0);
  const tracking = useRef(false);
  const refreshing = useRef(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const reset = useCallback(() => {
    tracking.current = false;
    distanceRef.current = 0;
    setPullDistance(0);
    setState('idle');
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-ptr]')) return;
      tracking.current = true;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        reset();
        return;
      }
      const distance = Math.min(delta * 0.5, MAX_PULL);
      distanceRef.current = distance;
      setPullDistance(distance);
      setState(distance >= THRESHOLD ? 'ready' : 'pulling');
    };

    const handleTouchEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      if (distanceRef.current >= THRESHOLD) {
        refreshing.current = true;
        setPullDistance(THRESHOLD);
        setState('refreshing');
        Promise.resolve(onRefreshRef.current()).finally(() => {
          refreshing.current = false;
          reset();
        });
      } else {
        reset();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, reset]);

  return { state, pullDistance, threshold: THRESHOLD };
}
