'use client';

import { useState } from 'react';
import { Share2, Download, ImageIcon, Link } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';

interface ShareButtonProps {
  entryId: string;
}

// Vérifie si le navigateur supporte le partage natif de fichiers
function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

export default function ShareButton({ entryId }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Cache blob après premier fetch pour éviter double-requête
  const [cachedBlob, setCachedBlob] = useState<Blob | null>(null);

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  const fetchStoryBlob = async (): Promise<Blob> => {
    if (cachedBlob) return cachedBlob;
    const res = await fetch(`/api/og/story/${entryId}`);
    if (!res.ok) throw new Error('server_error');
    const blob = await res.blob();
    setCachedBlob(blob);
    return blob;
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await fetchStoryBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waveform-story.png';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Story téléchargée', 'success');
      setOpen(false);
    } catch {
      showToast("Impossible de générer l'image", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShareImage = async () => {
    setLoading(true);
    try {
      const blob = await fetchStoryBlob();
      const file = new File([blob], 'waveform-story.png', { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        setOpen(false);
      } else {
        // Fallback silencieux : téléchargement direct
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'waveform-story.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Story téléchargée', 'success');
        setOpen(false);
      }
    } catch (err) {
      // AbortError = utilisateur a annulé → pas d'erreur
      if (!(err instanceof Error && err.name === 'AbortError')) {
        showToast("Impossible de partager l'image", 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      showToast('Lien copié', 'success');
      setOpen(false);
    } catch {
      showToast('Impossible de copier le lien', 'error');
    }
  };

  const supportsFileShare = canShareFiles();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Partager"
        className="text-text-tertiary hover:text-text-primary transition-colors duration-150 focus:outline-none"
      >
        <Share2 size={15} />
      </button>

      <BottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Partager cette écoute"
      >
        <div className="py-2">

          {/* ── Télécharger la story ── */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-background-secondary transition-colors duration-150 disabled:opacity-50"
          >
            <Download size={18} className="text-text-tertiary flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium text-text-primary leading-tight">
                {loading ? 'Génération en cours\u2026' : 'Télécharger la story'}
              </span>
              <span className="text-[12px] text-text-tertiary">
                Image verticale 1080 × 1920
              </span>
            </div>
          </button>

          {/* ── Partager l'image — mobile uniquement ── */}
          {supportsFileShare && (
            <>
              <div className="border-t border-border mx-6" />
              <button
                onClick={handleShareImage}
                disabled={loading}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-background-secondary transition-colors duration-150 disabled:opacity-50"
              >
                <ImageIcon size={18} className="text-text-tertiary flex-shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-text-primary leading-tight">
                    Partager l&apos;image
                  </span>
                  <span className="text-[12px] text-text-tertiary">
                    Via Instagram, Messages…
                  </span>
                </div>
              </button>
            </>
          )}

          {/* ── Copier le lien ── */}
          <div className="border-t border-border mx-6" />
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-background-secondary transition-colors duration-150"
          >
            <Link size={18} className="text-text-tertiary flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium text-text-primary leading-tight">
                Copier le lien de la review
              </span>
              <span className="text-[12px] text-text-tertiary">
                Pour partager dans un message
              </span>
            </div>
          </button>

        </div>
      </BottomSheet>
    </>
  );
}
