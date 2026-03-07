'use client';

import { useState } from 'react';
import { setAlbumSpotifyUrl } from './actions';

export default function SpotifyUrlInput({ albumId }: { albumId: string }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    const url = value.trim();
    if (!url.startsWith('https://open.spotify.com/')) {
      setStatus('error');
      return;
    }
    setStatus('saving');
    const ok = await setAlbumSpotifyUrl(albumId, url);
    setStatus(ok ? 'saved' : 'error');
  };

  if (status === 'saved') {
    return <span className="text-[11px] text-green-600 ml-4 flex-shrink-0">Spotify ✓</span>;
  }

  return (
    <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
      <input
        type="url"
        placeholder="https://open.spotify.com/album/…"
        value={value}
        onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
        className={`text-[11px] bg-background border rounded px-2 py-1 w-52 outline-none focus:border-[#8E6F5E] ${status === 'error' ? 'border-red-400' : 'border-border'}`}
      />
      <button
        onClick={handleSave}
        disabled={status === 'saving' || !value.trim()}
        className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded-full px-2.5 py-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === 'saving' ? (
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        ) : 'Sauver'}
      </button>
    </div>
  );
}
