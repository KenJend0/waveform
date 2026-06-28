'use client';

import { Loader2, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useState } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type Props = {
  children: ReactNode;
  enabled: boolean;
};

/**
 * Pull-to-refresh global, monté une seule fois autour du <main>. Recharge les données
 * SSR de la page courante via router.refresh() — fonctionne pour toutes les pages
 * server component (feed, explore, profils, listes, albums...).
 */
export default function PullToRefresh({ children, enabled }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsPending(true);
    router.refresh();
    // Laisse le temps au re-render serveur de s'appliquer avant de masquer l'indicateur.
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsPending(false);
  }, [router]);

  const { state, pullDistance, threshold } = usePullToRefresh(handleRefresh, enabled);

  const showSpinner = state === 'refreshing' || isPending;
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: showSpinner ? threshold : pullDistance }}
        aria-hidden
      >
        {showSpinner ? (
          <Loader2 size={20} className="animate-spin text-text-secondary" />
        ) : (
          <ArrowDown
            size={18}
            className="text-text-secondary transition-transform duration-150"
            style={{
              opacity: progress,
              transform: `rotate(${progress * 180}deg)`,
            }}
          />
        )}
      </div>
      {children}
    </>
  );
}
