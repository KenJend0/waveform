'use client';

import { useState } from 'react';
import { setAlbumSpotifyUrl } from '@/app/admin/actions';

export default function AdminSpotifyEdit({ albumId }: { albumId: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (status === 'saved') {
    return (
      <span className="text-[11px] text-green-600">
        Spotify enregistré — rechargez la page
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-text-disabled hover:text-text-tertiary transition-colors duration-150 border border-dashed border-border rounded px-2 py-0.5"
      >
        + Spotify [admin]
      </button>
    );
  }

  const handleSave = async () => {
    const url = value.trim();
    if (!url.startsWith('https://open.spotify.com/')) { setStatus('error'); return; }
    setStatus('saving');
    const ok = await setAlbumSpotifyUrl(albumId, url);
    setStatus(ok ? 'saved' : 'error');
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="url"
        autoFocus
        placeholder="https://open.spotify.com/album/…"
        value={value}
        onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
        className={`text-[11px] bg-background border rounded px-2 py-1 w-56 outline-none focus:border-[#8E6F5E] ${status === 'error' ? 'border-red-400' : 'border-border'}`}
      />
      <button
        onClick={handleSave}
        disabled={status === 'saving' || !value.trim()}
        className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded px-2 py-1 transition-colors disabled:opacity-40"
      >
        {status === 'saving' ? '…' : 'OK'}
      </button>
      <button onClick={() => setOpen(false)} className="text-[11px] text-text-disabled hover:text-text-tertiary">✕</button>
    </div>
  );
}
