"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import Image from "next/image";

type AlbumSuggest = {
  id: string;
  label: string;
  sublabel: string | null;
  cover_url: string | null;
};

type Props = {
  position: number;
  onSelect: (album: any) => void;
  onClose: () => void;
};

export default function SearchAlbumModal({ position, onSelect, onClose }: Props) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<AlbumSuggest[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoading(true);

        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(q)}&types=album&limit=20`,
          { signal: ac.signal, credentials: "include" }
        );

        if (!res.ok) throw new Error("suggest_failed");
        const json = (await res.json()) as { items: AlbumSuggest[] };
        setSuggestions(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [q]);

  const handleSelectAlbum = (album: AlbumSuggest) => {
    onSelect({
      id: album.id,
      title: album.label,
      artist_name: album.sublabel,
      cover_url: album.cover_url,
    });
    setQ("");
    setSuggestions([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#1C1C1C]/20 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-[12px] w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-divider">
          <h2 className="text-[16px] font-medium text-text-primary">
            Album #{position}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-background-secondary rounded-[8px] transition-colors duration-150"
          >
            <X size={18} className="text-text-secondary" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-border-divider">
          <input
            ref={inputRef}
            type="text"
            placeholder="Titre ou artiste..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            className="w-full px-3 py-2.5 bg-background-secondary border border-border rounded-[10px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-colors duration-150 text-[16px]"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-text-tertiary text-meta">Recherche...</p>}

          {!loading && suggestions.length === 0 && q && (
            <p className="text-text-tertiary text-meta">Aucun album trouve</p>
          )}

          {!loading && suggestions.length === 0 && !q && (
            <p className="text-text-tertiary text-meta">Tapez un titre ou un artiste</p>
          )}

          <div className="space-y-1">
            {suggestions.map((album) => (
              <button
                key={album.id}
                onClick={() => handleSelectAlbum(album)}
                className="w-full flex items-center gap-4 p-3 rounded-[8px] hover:bg-background-secondary transition-colors duration-150 text-left"
              >
                <div className="relative w-12 h-12 rounded-[8px] overflow-hidden flex-shrink-0 bg-background-tertiary">
                  {album.cover_url && (
                    <Image
                      src={album.cover_url}
                      alt={album.label}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-text-primary truncate">{album.label}</p>
                  <p className="text-[12px] text-text-secondary truncate">{album.sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

