'use client';

import { Loader2, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

type Props = {
  children: ReactNode;
  enabled: boolean;
};

/**
 * Pull-to-refresh global, monté une seule fois autour du <main>. Recharge les données
 * SSR de la page courante via router.refresh().
 *
 * router.refresh() met à jour les props envoyées aux composants, mais certains
 * composants client (ex: FeedInfiniteList) figent leurs données initiales dans un
 * useState au montage et ignorent les props suivantes. On force donc un remount complet
 * du contenu (key bump) une fois la transition de refresh terminée, pour garantir que
 * la nouvelle donnée s'affiche partout, sans dépendre du comportement interne de chaque
 * composant de page.
 */
export default function PullToRefresh({ children, enabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isPending && resolveRef.current) {
      setRefreshKey((key) => key + 1);
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [isPending]);

  const handleRefresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      startTransition(() => {
        router.refresh();
      });
    });
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
      <div key={refreshKey}>{children}</div>
    </>
  );
}
