'use client';

import { useState } from 'react';
import { deleteAlbum } from './actions';

export default function DeleteAlbumButton({ albumId, albumTitle }: { albumId: string; albumTitle: string }) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === 'confirm') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[11px] text-text-secondary">Supprimer ?</span>
        <button
          onClick={async () => {
            setStatus('loading');
            const result = await deleteAlbum(albumId);
            if (!result.success) {
              setErrorMsg(result.error ?? 'Erreur inconnue');
              setStatus('error');
            }
            // En cas de succès, la page se revalide automatiquement (revalidatePath)
          }}
          className="text-[11px] text-red-600 border border-red-300 hover:bg-red-50 rounded-full px-2.5 py-1 transition-colors duration-150"
        >
          Confirmer
        </button>
        <button
          onClick={() => setStatus('idle')}
          className="text-[11px] text-text-tertiary hover:text-text-primary border border-border rounded-full px-2.5 py-1 transition-colors duration-150"
        >
          Annuler
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary flex-shrink-0">
        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        Suppression…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="text-[11px] text-red-500 flex-shrink-0" title={errorMsg ?? undefined}>
        Erreur
      </span>
    );
  }

  return (
    <button
      onClick={() => setStatus('confirm')}
      title={`Supprimer "${albumTitle}"`}
      className="text-[11px] text-text-tertiary hover:text-red-600 border border-border hover:border-red-300 rounded-full px-2.5 py-1 transition-colors duration-150 flex-shrink-0"
    >
      Supprimer
    </button>
  );
}
