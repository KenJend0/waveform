'use client';

import { useState } from 'react';
import { clearAlbumMetadata } from './actions';

type Album = { id: string; mbid: string | null; title: string; artist_name: string };
type Result = {
  genres: number;
  hasDescription: boolean;
  mbTagsRaw: number;
  lfmTagsRaw: number;
  errors: string[];
} | null;

export default function ReEnrichButton({ album }: { album: Album }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result>(null);

  if (!album.mbid) return null;

  const handleClick = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const cleared = await clearAlbumMetadata(album.id);
      if (!cleared) { setStatus('error'); return; }

      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.id, mbid: album.mbid, title: album.title, artist: album.artist_name }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult({
          genres: data.genres ?? 0,
          hasDescription: data.hasDescription ?? false,
          mbTagsRaw: data.mbTagsRaw ?? 0,
          lfmTagsRaw: data.lfmTagsRaw ?? 0,
          errors: data.errors ?? [],
        });
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done' && result) {
    const nothingChanged = result.genres === 0 && !result.hasDescription;
    const hasErrors = result.errors.length > 0;
    return (
      <span
        className={`text-[11px] ml-4 flex-shrink-0 ${nothingChanged ? 'text-amber-600' : 'text-green-600'}`}
        title={hasErrors ? `Erreurs: ${result.errors.join(' | ')}` : `MB: ${result.mbTagsRaw} tags bruts, LFM: ${result.lfmTagsRaw} tags bruts`}
      >
        {nothingChanged
          ? `Rien trouvé (MB:${result.mbTagsRaw} LFM:${result.lfmTagsRaw})${hasErrors ? ' ⚠' : ''}`
          : `${result.genres} genre${result.genres > 1 ? 's' : ''} · ${result.hasDescription ? 'bio ✓' : 'sans bio'}${hasErrors ? ' ⚠' : ''}`}
      </span>
    );
  }

  if (status === 'error') {
    return <span className="text-[11px] text-red-500 ml-4 flex-shrink-0">Erreur — réessayer</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded-full px-2.5 py-1 transition-colors duration-150 ml-4 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'loading' ? (
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          En cours…
        </span>
      ) : 'Ré-enrichir'}
    </button>
  );
}
