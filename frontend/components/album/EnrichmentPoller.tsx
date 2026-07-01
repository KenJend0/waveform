'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Props = { albumId: string };

// Polls /api/enrich-status until fetched_at is set, then refreshes the page
// so genres/streaming links appear without a manual reload.
// Max 12 attempts × 3s = 36s, then gives up silently.
export default function EnrichmentPoller({ albumId }: Props) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const attempts = useRef(0);

  useEffect(() => {
    timer.current = setInterval(async () => {
      attempts.current++;
      if (attempts.current >= 12) {
        clearInterval(timer.current!);
        return;
      }
      try {
        const res = await fetch(`/api/enrich-status?albumId=${albumId}`);
        if (!res.ok) return;
        const { ready } = await res.json();
        if (ready) {
          clearInterval(timer.current!);
          router.refresh();
        }
      } catch { /* best-effort */ }
    }, 3000);

    return () => { if (timer.current) clearInterval(timer.current); };
  }, [albumId, router]);

  return null;
}
