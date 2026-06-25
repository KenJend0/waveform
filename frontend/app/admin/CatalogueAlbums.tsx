'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReEnrichButton from './ReEnrichButton';
import FetchStreamingButton from './FetchStreamingButton';
import StreamingLinksEditor from './StreamingLinksEditor';
import DeleteAlbumButton from './DeleteAlbumButton';

type Album = {
  id: string;
  title: string;
  mbid: string | null;
  artist_name: string;
  release_date: string | null;
  hasTags: boolean;
  hasStreaming: boolean;
  hasDescription: boolean;
  fetched_at: string | null;
  streamingAttempts: number;
};

const MAX_STREAMING_ATTEMPTS = 5;

type FilterKey = 'all' | 'no-tags' | 'no-streaming' | 'incomplete';

export default function CatalogueAlbums({ albums }: { albums: Album[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts: Record<FilterKey, number> = {
    all: albums.length,
    'no-tags': albums.filter((a) => !a.hasTags).length,
    'no-streaming': albums.filter((a) => !a.hasStreaming).length,
    incomplete: albums.filter((a) => !a.hasTags || !a.hasStreaming).length,
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'no-tags', label: 'Sans tags' },
    { key: 'no-streaming', label: 'Sans streaming' },
    { key: 'incomplete', label: 'Incomplets' },
  ];

  const afterFilter = albums.filter((a) => {
    if (filter === 'no-tags') return !a.hasTags;
    if (filter === 'no-streaming') return !a.hasStreaming;
    if (filter === 'incomplete') return !a.hasTags || !a.hasStreaming;
    return true;
  });

  const filtered = search.trim()
    ? afterFilter.filter((a) => {
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.artist_name.toLowerCase().includes(q);
      })
    : afterFilter;

  return (
    <section className="rounded-[20px] border border-border bg-background-secondary p-6 sm:p-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-medium text-text-primary tracking-[-0.01em]">Catalogue albums</h2>
            <span className="rounded-full bg-background border border-border px-2.5 py-0.5 text-[12px] text-text-secondary">
              {filtered.length}{search.trim() ? ` / ${afterFilter.length}` : ''}
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un album ou artiste…"
            className="w-full sm:w-72 rounded-full border border-border bg-background px-4 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary transition-colors"
          />
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                filter === key
                  ? 'bg-text-primary text-background'
                  : counts[key] > 0 && key !== 'all'
                    ? 'border border-[#E2D5BE] bg-[#FBF8F2] text-[#8A6A27] hover:border-[#C8A565]'
                    : 'border border-border bg-background text-text-secondary hover:border-text-tertiary hover:text-text-primary'
              }`}
            >
              {label} <span className="opacity-60">({counts[key]})</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-text-tertiary">
          {search.trim() ? `Aucun résultat pour « ${search} ».` : 'Aucun album dans cette catégorie.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((album) => {
            const year = album.release_date ? new Date(album.release_date).getFullYear() : null;
            const isExpanded = expandedId === album.id;
            return (
              <div key={album.id} className="rounded-[14px] border border-border bg-background px-4 py-3">
                {/* Ligne principale */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/albums/${album.id}`}
                      className="text-[14px] font-medium text-text-primary transition-colors hover:text-text-secondary"
                    >
                      {album.title}
                    </Link>
                    <span className="text-[12px] text-text-secondary">
                      {album.artist_name}{year ? ` · ${year}` : ''}
                    </span>
                    {album.mbid && (
                      <span className="text-[11px] font-mono text-text-tertiary">{album.mbid.slice(0, 8)}…</span>
                    )}
                    {/* Indicateurs de statut */}
                    {!album.hasTags && (
                      <span className="rounded-full bg-[#F7EEDB] text-[#8A6A27] px-2 py-0.5 text-[10px] font-medium">sans tags</span>
                    )}
                    {!album.hasStreaming && album.streamingAttempts >= MAX_STREAMING_ATTEMPTS && (
                      <span className="rounded-full bg-[#F5E5E1] text-[#9A5A4D] px-2 py-0.5 text-[10px] font-medium">
                        introuvable ({album.streamingAttempts} tentatives)
                      </span>
                    )}
                    {!album.hasStreaming && album.streamingAttempts > 0 && album.streamingAttempts < MAX_STREAMING_ATTEMPTS && (
                      <span className="rounded-full bg-[#F7EEDB] text-[#8A6A27] px-2 py-0.5 text-[10px] font-medium">
                        sans streaming ({album.streamingAttempts}/{MAX_STREAMING_ATTEMPTS})
                      </span>
                    )}
                    {!album.hasStreaming && album.streamingAttempts === 0 && (
                      <span className="rounded-full bg-[#F7EEDB] text-[#8A6A27] px-2 py-0.5 text-[10px] font-medium">jamais tenté</span>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : album.id)}
                    className="flex-shrink-0 text-[11px] text-text-tertiary hover:text-text-primary border border-border hover:border-text-tertiary rounded-full px-2.5 py-1 transition-colors duration-150"
                  >
                    {isExpanded ? 'Fermer' : 'Actions'}
                  </button>
                </div>

                {/* Boutons d'action — montés uniquement quand expandé */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-text-tertiary w-20 flex-shrink-0">Tags / bio</span>
                      <ReEnrichButton album={{ id: album.id, mbid: album.mbid, title: album.title, artist_name: album.artist_name }} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-text-tertiary w-20 flex-shrink-0">Streaming</span>
                      <FetchStreamingButton album={{ id: album.id, mbid: album.mbid, title: album.title, artist_name: album.artist_name }} />
                      <StreamingLinksEditor albumId={album.id} mbid={album.mbid} artistName={album.artist_name} title={album.title} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {album.mbid && (
                        <a
                          href={`https://musicbrainz.org/release-group/${album.mbid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-text-tertiary hover:text-text-primary border border-border hover:border-text-tertiary rounded-full px-2.5 py-1 transition-colors duration-150 flex-shrink-0"
                        >
                          MusicBrainz ↗
                        </a>
                      )}
                      <DeleteAlbumButton albumId={album.id} albumTitle={album.title} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
