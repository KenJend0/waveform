import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, createSupabaseAdmin } from '@/lib/supabase/server';
import ReEnrichButton from './ReEnrichButton';
import SpotifyUrlInput from './SpotifyUrlInput';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

type Album = {
  id: string;
  title: string;
  mbid: string | null;
  cover_url: string | null;
  release_date: string | null;
  artist_name: string;
};

type AlbumMeta = {
  album_id: string;
  description: string | null;
  fetched_at: string | null;
  spotify_url: string | null;
};

export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) redirect('/');

  const supabase = createSupabaseAdmin();

  const [
    { count: albumCount },
    { count: artistCount },
    { count: userCount },
    { count: entryCount },
    { data: rawAlbums },
    { data: genreData },
    { data: metaData },
    { count: reviewCount },
  ] = await Promise.all([
    supabase.from('albums').select('*', { count: 'exact', head: true }),
    supabase.from('artists').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('diary_entries').select('*', { count: 'exact', head: true }),
    supabase.from('albums').select('id, title, mbid, cover_url, release_date, artists(name)').order('title'),
    supabase.from('album_genres').select('album_id'),
    supabase.from('album_metadata').select('album_id, description, fetched_at, spotify_url').order('fetched_at', { ascending: false }),
    supabase.from('diary_entries').select('*', { count: 'exact', head: true }).not('review_body', 'is', null),
  ]);

  // Flatten albums
  const albums: Album[] = ((rawAlbums ?? []) as any[]).map((a) => ({
    id: a.id,
    title: a.title,
    mbid: a.mbid ?? null,
    cover_url: a.cover_url ?? null,
    release_date: a.release_date ?? null,
    artist_name: Array.isArray(a.artists) ? (a.artists[0]?.name ?? '—') : (a.artists?.name ?? '—'),
  }));

  const withGenreSet = new Set((genreData ?? []).map((r) => r.album_id));
  const metaMap = new Map<string, AlbumMeta>((metaData ?? []).map((r) => [r.album_id, r as AlbumMeta]));

  const noGenre = albums.filter((a) => !withGenreSet.has(a.id));
  const noDesc = albums.filter((a) => {
    const m = metaMap.get(a.id);
    return !m || !m.description;
  });
  const noSpotify = albums.filter((a) => {
    const m = metaMap.get(a.id);
    return !m?.spotify_url;
  });
  const noCover = albums.filter((a) => !a.cover_url);
  const noMbid = albums.filter((a) => !a.mbid);

  // Enrichments récents (7 derniers jours)
  const recentMeta = (metaData ?? [])
    .filter((m) => m.fetched_at && Date.now() - new Date(m.fetched_at).getTime() < 7 * 86400 * 1000)
    .slice(0, 10);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <h1 className="text-[24px] font-medium text-text-primary mb-8">Admin</h1>

      {/* Stats principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Albums', value: albumCount ?? 0 },
          { label: 'Artistes', value: artistCount ?? 0 },
          { label: 'Membres', value: userCount ?? 0 },
          { label: 'Écoutes', value: entryCount ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-background-secondary rounded-[12px] p-4">
            <p className="text-[28px] font-medium text-text-primary leading-none">{s.value.toLocaleString('fr-FR')}</p>
            <p className="text-[12px] text-text-tertiary mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Santé de la base */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-12">
        {[
          { label: 'Sans genres', value: noGenre.length },
          { label: 'Sans description', value: noDesc.length },
          { label: 'Sans Spotify', value: noSpotify.length },
          { label: 'Sans cover', value: noCover.length },
          { label: 'Sans MBID', value: noMbid.length },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-[12px] p-4 ${s.value > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}
          >
            <p className={`text-[28px] font-medium leading-none ${s.value > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {s.value}
            </p>
            <p className={`text-[12px] mt-1.5 ${s.value > 0 ? 'text-amber-600' : 'text-green-600'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Albums sans genres */}
      <Section title="Sans genres" count={noGenre.length}>
        {noGenre.map((a) => (
          <AlbumRow key={a.id} album={a}>
            <ReEnrichButton album={a} />
          </AlbumRow>
        ))}
      </Section>

      {/* Albums sans description */}
      <Section title="Sans description" count={noDesc.length}>
        {noDesc.map((a) => (
          <AlbumRow key={a.id} album={a}>
            <ReEnrichButton album={a} />
          </AlbumRow>
        ))}
      </Section>

      {/* Albums sans lien Spotify */}
      <Section title="Sans lien Spotify" count={noSpotify.length}>
        {noSpotify.map((a) => (
          <AlbumRow key={a.id} album={a}>
            <SpotifyUrlInput albumId={a.id} />
          </AlbumRow>
        ))}
      </Section>

      {/* Albums sans cover */}
      <Section title="Sans cover" count={noCover.length}>
        {noCover.map((a) => (
          <AlbumRow key={a.id} album={a}>
            {a.mbid && (
              <a
                href={`https://musicbrainz.org/release/${a.mbid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-text-tertiary hover:text-[#8E6F5E] border border-border hover:border-[#8E6F5E] rounded-full px-2.5 py-1 transition-colors duration-150 ml-4 flex-shrink-0"
              >
                MusicBrainz ↗
              </a>
            )}
          </AlbumRow>
        ))}
      </Section>

      {/* Albums sans MBID */}
      <Section title="Sans MBID (non enrichissable)" count={noMbid.length}>
        {noMbid.map((a) => (
          <AlbumRow key={a.id} album={a} />
        ))}
      </Section>

      {/* Enrichissements récents */}
      {recentMeta.length > 0 && (
        <div className="border-t border-border-divider pt-6 mb-8">
          <h2 className="text-[16px] font-medium text-text-primary mb-4">
            Enrichissements récents
            <span className="text-[12px] text-text-tertiary font-normal ml-2">(7 derniers jours)</span>
          </h2>
          <div className="space-y-1">
            {recentMeta.map((m) => {
              const album = albums.find((a) => a.id === m.album_id);
              if (!album) return null;
              return (
                <div key={m.album_id} className="flex items-center justify-between py-2 border-b border-border-divider last:border-0">
                  <div>
                    <Link href={`/albums/${album.id}`} className="text-[14px] text-text-primary hover:text-[#8E6F5E] transition-colors">
                      {album.title}
                    </Link>
                    <span className="text-[12px] text-text-tertiary ml-2">{album.artist_name}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${m.description ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                      {m.description ? 'desc ✓' : 'sans desc'}
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {m.fetched_at ? new Date(m.fetched_at).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count: number; children?: React.ReactNode }) {
  return (
    <div className="border-t border-border-divider pt-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-[16px] font-medium text-text-primary">{title}</h2>
        <span className={`text-[11px] rounded-full px-2 py-0.5 ${count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {count > 0 ? count : '✓ OK'}
        </span>
      </div>
      {count > 0 && <div className="space-y-0">{children}</div>}
    </div>
  );
}

function AlbumRow({ album, children }: { album: Album; children?: React.ReactNode }) {
  const year = album.release_date ? new Date(album.release_date).getFullYear() : null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-divider last:border-0">
      <div className="flex-1 min-w-0">
        <Link href={`/albums/${album.id}`} className="text-[14px] text-text-primary hover:text-[#8E6F5E] transition-colors">
          {album.title}
        </Link>
        <span className="text-[12px] text-text-tertiary ml-2">
          {album.artist_name}{year ? ` · ${year}` : ''}
        </span>
        {album.mbid && (
          <span className="text-[10px] text-text-disabled ml-2 font-mono hidden sm:inline">
            {album.mbid.slice(0, 8)}…
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

