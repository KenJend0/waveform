'use client';

import { useState } from 'react';
import { refreshAlbumCover } from '@/app/admin/actions';

export default function AdminRefreshCover({ albumId }: { albumId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClick = async () => {
    setStatus('loading');
    const result = await refreshAlbumCover(albumId);
    if (result.success) {
      setStatus('done');
    } else {
      setErrorMsg(result.error ?? 'Erreur inconnue');
      setStatus('error');
    }
  };

  if (status === 'done') {
    return <span className="text-[11px] text-green-600">Cover mise à jour — rechargez la page</span>;
  }

  if (status === 'error') {
    return <span className="text-[11px] text-red-500">{errorMsg}</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="text-[11px] text-text-disabled hover:text-text-tertiary transition-colors duration-150 border border-dashed border-border rounded px-2 py-0.5 disabled:opacity-40"
    >
      {status === 'loading' ? '…' : '↺ Cover [admin]'}
    </button>
  );
}
