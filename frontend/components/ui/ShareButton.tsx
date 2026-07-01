'use client';

import { useState, useEffect, useRef } from 'react';
import { Share2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';

interface ShareButtonProps {
  entryId: string;
  basePath?: string;
}

export default function ShareButton({ entryId, basePath = 'diary' }: ShareButtonProps) {
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

  const copyTextToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback below
      }
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
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
      const pageUrl = `${window.location.origin}/${basePath}/${entryId}`;
      const linkCopied = await copyTextToClipboard(pageUrl);

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], url: pageUrl });
        showToast(linkCopied ? 'Lien copié · colle-le comme sticker' : 'Story prête · copie le lien manuellement', 'success');
      } else {
        // Navigateur sans partage natif → téléchargement
        downloadBlob(blob);
        showToast(linkCopied ? 'Story téléchargée · lien copié' : 'Story téléchargée · copie le lien manuellement', 'success');
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
