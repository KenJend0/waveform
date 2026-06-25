'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ReEnrichButton from './ReEnrichButton';
import FetchStreamingButton from './FetchStreamingButton';
import StreamingLinksEditor from './StreamingLinksEditor';
import DeleteAlbumButton from './DeleteAlbumButton';
import { clearAlbumMetadata } from './actions';
import { fetchAlbumStreamingLinks } from '@/app/actions/metadata';

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
const BULK_DELAY_MS = 300; // pacing poli pour MB/Last.fm/Spotify entre deux albums d'un lot

type FilterKey =
  | 'all' | 'no-tags' | 'no-streaming' | 'never-tried' | 'retrying'
  | 'exhausted' | 'no-cover' | 'no-mbid' | 'incomplete';

type SortKey = 'title' | 'recent' | 'oldest' | 'attempts';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'incomplete', label: 'Incomplets' },
  { key: 'no-tags', label: 'Sans tags' },
  { key: 'no-streaming', label: 'Sans streaming' },
  { key: 'never-tried', label: 'Streaming jamais tenté' },
  { key: 'retrying', label: 'Streaming en cours de retry' },
  { key: 'exhausted', label: 'Streaming introuvable' },
  { key: 'no-cover', label: 'Sans cover' },
  { key: 'no-mbid', label: 'Sans MBID' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Enrichi récemment' },
  { key: 'oldest', label: 'Enrichi le + ancien / jamais' },
  { key: 'attempts', label: 'Tentatives streaming' },
  { key: 'title', label: 'Titre (A→Z)' },
];

function matchesFilter(a: Album, filter: FilterKey): boolean {
  switch (filter) {
    case 'no-tags': return !a.hasTags;
    case 'no-streaming': return !a.hasStreaming;
    case 'never-tried': return !a.hasStreaming && a.streamingAttempts === 0;
    case 'retrying': return !a.hasStreaming && a.streamingAttempts > 0 && a.streamingAttempts < MAX_STREAMING_ATTEMPTS;
    case 'exhausted': return !a.hasStreaming && a.streamingAttempts >= MAX_STREAMING_ATTEMPTS;
    case 'no-cover': return false; // injecté via prop noCoverIds, voir composant
    case 'no-mbid': return !a.mbid;
    case 'incomplete': return !a.hasTags || !a.hasStreaming;
    default: return true;
  }
}

export default function CatalogueAlbums({ albums, noCoverIds }: { albums: Album[]; noCoverIds: string[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ kind: 'tags' | 'streaming'; current: number; total: number; done: number } | null>(null);

  const noCoverSet = useMemo(() => new Set(noCoverIds), [noCoverIds]);
  const matches = (a: Album, key: FilterKey) => (key === 'no-cover' ? noCoverSet.has(a.id) : matchesFilter(a, key));

  const counts: Record<FilterKey, number> = {
    all: albums.length,
    'no-tags': albums.filter((a) => matches(a, 'no-tags')).length,
    'no-streaming': albums.filter((a) => matches(a, 'no-streaming')).length,
    'never-tried': albums.filter((a) => matches(a, 'never-tried')).length,
    retrying: albums.filter((a) => matches(a, 'retrying')).length,
    exhausted: albums.filter((a) => matches(a, 'exhausted')).length,
    'no-cover': albums.filter((a) => matches(a, 'no-cover')).length,
    'no-mbid': albums.filter((a) => matches(a, 'no-mbid')).length,
    incomplete: albums.filter((a) => matches(a, 'incomplete')).length,
  };

  const afterFilter = albums.filter((a) => matches(a, filter));

  const searched = search.trim()
    ? afterFilter.filter((a) => {
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.artist_name.toLowerCase().includes(q);
      })
    : afterFilter;

  const filtered = useMemo(() => {
    const rows = [...searched];
    rows.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'attempts') return b.streamingAttempts - a.streamingAttempts;
      const at = a.fetched_at ? new Date(a.fetched_at).getTime() : 0;
      const bt = b.fetched_at ? new Date(b.fetched_at).getTime() : 0;
      return sort === 'oldest' ? at - bt : bt - at;
    });
    return rows;
  }, [searched, sort]);

  const enrichableInView = filtered.filter((a) => a.mbid);

  const runBulkTags = async () => {
    const targets = enrichableInView;
    setBulk({ kind: 'tags', current: 0, total: targets.length, done: 0 });
    let done = 0;
    for (let i = 0; i < targets.length; i++) {
      const album = targets[i];
      setBulk({ kind: 'tags', current: i + 1, total: targets.length, done });
      try {
        await clearAlbumMetadata(album.id);
        const res = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ albumId: album.id, mbid: album.mbid, title: album.title, artist: album.artist_name }),
        });
        if (res.ok) {
          const data = await res.json();
          if ((data.genres ?? 0) > 0 || data.hasDescription) done++;
        }
      } catch { /* on continue le lot */ }
      await new Promise((r) => setTimeout(r, BULK_DELAY_MS));
    }
    setBulk({ kind: 'tags', current: targets.length, total: targets.length, done });
  };

  const runBulkStreaming = async () => {
    const targets = enrichableInView;
    setBulk({ kind: 'streaming', current: 0, total: targets.length, done: 0 });
    let done = 0;
    for (let i = 0; i < targets.length; i++) {
      const album = targets[i];
      setBulk({ kind: 'streaming', current: i + 1, total: targets.length, done });
      try {
        const links = await fetchAlbumStreamingLinks(album.id, album.mbid ?? '', album.artist_name, album.title);
        if (links.spotify || links.appleMusic || links.deezer) done++;
      } catch { /* on continue le lot */ }
      await new Promise((r) => setTimeout(r, BULK_DELAY_MS));
    }
    setBulk({ kind: 'streaming', current: targets.length, total: targets.length, done });
  };

  const bulkRunning = bulk !== null && bulk.current < bulk.total;

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
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-full border border-border bg-background px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-text-tertiary transition-colors"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un album ou artiste…"
              className="w-full sm:w-64 rounded-full border border-border bg-background px-4 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-text-tertiary transition-colors"
            />
          </div>
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

        {/* Barre d'actions groupées — scoped à ce qui est affiché (filtre + recherche) */}
        {enrichableInView.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-background px-4 py-3">
            <span className="text-[12px] text-text-secondary">
              Lancer sur les <span className="font-medium text-text-primary">{enrichableInView.length}</span> résultat{enrichableInView.length > 1 ? 's' : ''} affiché{enrichableInView.length > 1 ? 's' : ''} :
            </span>
            <button
              onClick={runBulkTags}
              disabled={bulkRunning}
              className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded-full px-2.5 py-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tags + bio
            </button>
            <button
              onClick={runBulkStreaming}
              disabled={bulkRunning}
              className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded-full px-2.5 py-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Streaming
            </button>
            {bulk && (
              <span className="text-[11px] text-text-tertiary ml-1">
                {bulkRunning
                  ? `${bulk.kind === 'tags' ? 'Tags+bio' : 'Streaming'} — ${bulk.current}/${bulk.total} (${bulk.done} réussi${bulk.done > 1 ? 's' : ''})…`
                  : `Terminé — ${bulk.done}/${bulk.total} réussi${bulk.done > 1 ? 's' : ''}.`}
              </span>
            )}
          </div>
        )}
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
                    {noCoverSet.has(album.id) && (
                      <span className="rounded-full bg-[#F7EEDB] text-[#8A6A27] px-2 py-0.5 text-[10px] font-medium">sans cover</span>
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
