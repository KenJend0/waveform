'use client';

import { useState, useEffect, useRef } from 'react';
import { Share2 } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ShareButtonProps {
  entryId: string;
}

export default function ShareButton({ entryId }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const prefetchPromiseRef = useRef<Promise<Blob | null> | null>(null);

  useEffect(() => {
    const promise = fetch(`/api/og/story/${entryId}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => { if (blob) blobRef.current = blob; return blob; })
      .catch(() => null);
    prefetchPromiseRef.current = promise;
  }, [entryId]);

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waveform-story.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Attend le blob (depuis le cache ou le prefetch en cours)
      let blob = blobRef.current;
      if (!blob) {
        blob = await (prefetchPromiseRef.current ?? fetch(`/api/og/story/${entryId}`).then((r) => r.ok ? r.blob() : null));
        if (!blob) throw new Error('server_error');
        blobRef.current = blob;
      }

      const file = new File([blob], 'waveform-story.png', { type: 'image/png' });
      const pageUrl = window.location.href;

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try { await navigator.clipboard.writeText(pageUrl); } catch { /* silencieux */ }
        await navigator.share({ files: [file] });
        showToast('Lien copié · colle-le comme sticker', 'success');
      } else {
        // Navigateur sans partage natif → téléchargement
        try { await navigator.clipboard.writeText(pageUrl); } catch { /* silencieux */ }
        downloadBlob(blob);
        showToast('Story téléchargée · lien copié', 'success');
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        showToast("Impossible de partager l'image", 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      title="Partager"
      className="text-text-tertiary hover:text-text-primary transition-colors duration-150 focus:outline-none disabled:opacity-50"
    >
      <Share2 size={15} />
    </button>
  );
}
