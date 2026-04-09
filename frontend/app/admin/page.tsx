import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import EnrichAllButton from './EnrichAllButton';
import FetchStreamingAllButton from './FetchStreamingAllButton';
import ReEnrichButton from './ReEnrichButton';
import StreamingLinksEditor from './StreamingLinksEditor';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_OPTIONS = {
  '7d': { label: '7 jours', days: 7 },
  '30d': { label: '30 jours', days: 30 },
  '90d': { label: '90 jours', days: 90 },
} as const;

type RangeKey = keyof typeof RANGE_OPTIONS;
type SearchParamsInput = Promise<Record<string, string | string[] | undefined>> | undefined;

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
  apple_music_url: string | null;
  deezer_url: string | null;
};

type ProductEventRow = {
  created_at: string;
  event_name: string;
  surface: string | null;
  user_id: string | null;
};

type WindowMetrics = {
  signups: number;
  onboardings: number;
  albumLoggers: number;
  followers: number;
  wau: number;
  albumLogs: number;
  authErrors: number;
  noResultSearches: number;
  importFailures: number;
};

type ProductSignals = {
  available: boolean;
  weeklyViewAvailable: boolean;
  current: WindowMetrics;
  previous: WindowMetrics;
  recentEvents: ProductEventRow[];
  frictionByEvent: Array<{ label: string; count: number }>;
  searchBySurface: Array<{ label: string; count: number }>;
  weeklyTrend: WeeklyTrendRow[];
};

type WeeklyTrendRow = {
  week: string;
  signup_users: number;
  onboarded_users: number;
  activated_users: number;
  social_users: number;
  wau: number;
  album_logs: number;
  import_failures: number;
  search_no_results: number;
  auth_errors: number;
};

const EMPTY_WINDOW: WindowMetrics = {
  signups: 0,
  onboardings: 0,
  albumLoggers: 0,
  followers: 0,
  wau: 0,
  albumLogs: 0,
  authErrors: 0,
  noResultSearches: 0,
  importFailures: 0,
};

export default async function AdminPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const user = await getAuthUser();
  if (!user || !ADMIN_IDS.includes(user.id)) redirect('/');

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const range = resolveRange(resolvedSearchParams?.range);

  const supabase = createSupabaseAdmin();

  const [
    { count: albumCount },
    { count: artistCount },
    { count: userCount },
    { count: entryCount },
    { count: followCount },
    { count: commentCount },
    { count: reviewCount },
    { data: rawAlbums },
    { data: genreData },
    { data: metaData },
    productSignals,
  ] = await Promise.all([
    supabase.from('albums').select('*', { count: 'exact', head: true }),
    supabase.from('artists').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('diary_entries').select('*', { count: 'exact', head: true }),
    supabase.from('follows').select('*', { count: 'exact', head: true }),
    supabase.from('diary_comments').select('*', { count: 'exact', head: true }),
    supabase.from('diary_entries').select('*', { count: 'exact', head: true }).not('review_body', 'is', null),
    supabase.from('albums').select('id, title, mbid, cover_url, release_date, artists(name)').order('title'),
    supabase.from('album_genres').select('album_id'),
    supabase.from('album_metadata').select('album_id, description, fetched_at, spotify_url, apple_music_url, deezer_url').order('fetched_at', { ascending: false }),
    getProductSignals(supabase, range.days),
  ]);

  const albums: Album[] = ((rawAlbums ?? []) as any[]).map((album) => ({
    id: album.id,
    title: album.title,
    mbid: album.mbid ?? null,
    cover_url: album.cover_url ?? null,
    release_date: album.release_date ?? null,
    artist_name: Array.isArray(album.artists) ? (album.artists[0]?.name ?? '—') : (album.artists?.name ?? '—'),
  }));

  const genreSet = new Set((genreData ?? []).map((row) => row.album_id));
  const metaMap = new Map<string, AlbumMeta>((metaData ?? []).map((row) => [row.album_id, row as AlbumMeta]));

  const noGenre = albums.filter((album) => !genreSet.has(album.id));
  const noDesc = albums.filter((album) => !metaMap.get(album.id)?.description);
  const noCover = albums.filter((album) => !album.cover_url);
  const noMbid = albums.filter((album) => !album.mbid);
  const noStreaming = albums.filter((album) => {
    const meta = metaMap.get(album.id);
    return !meta?.spotify_url && !meta?.apple_music_url && !meta?.deezer_url;
  });

  const noGenreSet = new Set(noGenre.map((album) => album.id));
  const noDescSet = new Set(noDesc.map((album) => album.id));
  const notEnriched = albums.filter((album) => noGenreSet.has(album.id) || noDescSet.has(album.id));

  const recentMeta = (metaData ?? [])
    .filter((meta) => meta.fetched_at && Date.now() - new Date(meta.fetched_at).getTime() < range.days * DAY_MS)
    .slice(0, 8) as AlbumMeta[];

  const current = productSignals.current;
  const previous = productSignals.previous;
  const totalFrictions = current.authErrors + current.noResultSearches + current.importFailures;
  const activationRate = current.onboardings > 0 ? Math.round((current.albumLoggers / current.onboardings) * 100) : 0;

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-page px-6 py-6 lg:py-8 space-y-6">

        {/* ── 1. Header ───────────────────────────────────────────────── */}
        <section className="rounded-[20px] border border-border bg-background-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Tag tone="neutral">Admin cockpit</Tag>
                <Tag tone={productSignals.available ? 'success' : 'warning'}>
                  {productSignals.available ? 'product events actifs' : 'product events indisponibles'}
                </Tag>
                <Tag tone={notEnriched.length + noStreaming.length > 0 ? 'warning' : 'success'}>
                  {notEnriched.length + noStreaming.length} taches prioritaires
                </Tag>
              </div>
              <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-text-primary sm:text-[34px]">
                Tableau de bord admin
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-secondary">
                Vue unifiee du catalogue, des signaux produit et des actions de maintenance prioritaires.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(RANGE_OPTIONS) as Array<[RangeKey, { label: string; days: number }]>).map(([key, option]) => (
                <Link
                  key={key}
                  href={key === '7d' ? '/admin' : `/admin?range=${key}`}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${
                    range.key === key
                      ? 'bg-text-primary text-background'
                      : 'border border-border bg-background text-text-secondary hover:border-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
              <Link href="/" className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[12px] text-text-secondary transition-colors hover:border-text-tertiary hover:text-text-primary">
                ← Retour app
              </Link>
            </div>
          </div>
        </section>

        {/* ── 2. Stats globales ────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DeltaCard label={`Signups ${range.key}`} value={current.signups} delta={current.signups - previous.signups} hint="Comparaison fenetre precedente" />
          <DeltaCard label={`Onboardings ${range.key}`} value={current.onboardings} delta={current.onboardings - previous.onboardings} hint={rateLabel(current.onboardings, current.signups, 'signup → onboarding')} />
          <DeltaCard label={`Album loggers ${range.key}`} value={current.albumLoggers} delta={current.albumLoggers - previous.albumLoggers} hint={rateLabel(current.albumLoggers, current.onboardings, 'onboarding → album')} />
          <DeltaCard label={`Followers ${range.key}`} value={current.followers} delta={current.followers - previous.followers} hint={rateLabel(current.followers, current.albumLoggers, 'album → social')} />
        </section>

        {/* ── 3. Santé catalogue ───────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Panel title="Vue d'ensemble plateforme" subtitle="Volumes globaux et couverture qualite catalogue">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Albums" value={albumCount ?? 0} />
                <MiniStat label="Artistes" value={artistCount ?? 0} />
                <MiniStat label="Membres" value={userCount ?? 0} />
                <MiniStat label="Ecoutes" value={entryCount ?? 0} />
                <MiniStat label="Reviews" value={reviewCount ?? 0} />
                <MiniStat label="Commentaires" value={commentCount ?? 0} />
                <MiniStat label="Follows" value={followCount ?? 0} />
                <MetricCard label={`WAU ${range.key}`} value={current.wau} subtitle="Utilisateurs actifs" accent="sand" />
              </div>
              <div className="grid gap-3 content-start">
                <GlassMetric label="Couverture enrichissement" value={coveragePercent(albums.length - notEnriched.length, albums.length)} subtitle={`${albums.length - notEnriched.length}/${albums.length} albums propres`} tone={notEnriched.length > 0 ? 'warning' : 'success'} />
                <GlassMetric label="Couverture streaming" value={coveragePercent(albums.length - noStreaming.length, albums.length)} subtitle={`${albums.length - noStreaming.length}/${albums.length} avec lien`} tone={noStreaming.length > 0 ? 'warning' : 'success'} />
                <GlassMetric label="Couverture covers" value={coveragePercent(albums.length - noCover.length, albums.length)} subtitle={`${albums.length - noCover.length}/${albums.length} avec cover`} tone={noCover.length > 0 ? 'warning' : 'success'} />
              </div>
            </div>
          </Panel>

          <Panel title="Radar qualite" subtitle="Points qui demandent une intervention">
            <div className="space-y-3">
              <HealthRow label="Albums non enrichis" value={notEnriched.length} total={albums.length} tone={notEnriched.length > 0 ? 'warning' : 'success'} />
              <HealthRow label="Albums sans streaming" value={noStreaming.length} total={albums.length} tone={noStreaming.length > 0 ? 'warning' : 'success'} />
              <HealthRow label="Albums sans cover" value={noCover.length} total={albums.length} tone={noCover.length > 0 ? 'warning' : 'success'} />
              <HealthRow label="Albums sans MBID" value={noMbid.length} total={albums.length} tone={noMbid.length > 0 ? 'critical' : 'success'} />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <MetricCard label={`Albums loggés ${range.key}`} value={current.albumLogs} subtitle="Profondeur d'usage" accent="rose" />
              <MetricCard label={`Frictions ${range.key}`} value={totalFrictions} subtitle="auth + search + import" accent={totalFrictions > 0 ? 'warning' : 'success'} />
            </div>
          </Panel>
        </section>

        {/* ── 4. Files d'action ────────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-3">
          <QueuePanel title="Backlog enrichissement" subtitle="Genres et descriptions manquants" count={notEnriched.length} action={<EnrichAllButton albums={notEnriched} />}>
            {notEnriched.slice(0, 10).map((album) => (
              <AlbumTaskRow key={album.id} album={album} meta={metaMap.get(album.id)}>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {noGenreSet.has(album.id) && <Tag tone="warning">sans genres</Tag>}
                  {noDescSet.has(album.id) && <Tag tone="warning">sans bio</Tag>}
                  <ReEnrichButton album={album} />
                </div>
              </AlbumTaskRow>
            ))}
            {notEnriched.length > 10 && <PanelFootnote value={notEnriched.length - 10} />}
          </QueuePanel>

          <QueuePanel title="Liens streaming" subtitle="Albums encore invisibles sur les plateformes" count={noStreaming.length} action={<FetchStreamingAllButton albums={noStreaming} />}>
            {noStreaming.slice(0, 8).map((album) => (
              <AlbumTaskRow key={album.id} album={album} meta={metaMap.get(album.id)}>
                <StreamingLinksEditor albumId={album.id} mbid={album.mbid} artistName={album.artist_name} title={album.title} />
              </AlbumTaskRow>
            ))}
            {noStreaming.length > 8 && <PanelFootnote value={noStreaming.length - 8} />}
          </QueuePanel>

          <QueuePanel title="Identite catalogue" subtitle="Covers et MBID a nettoyer" count={noCover.length + noMbid.length}>
            {[...noCover.slice(0, 4), ...noMbid.slice(0, 4)].map((album) => (
              <AlbumTaskRow key={album.id} album={album} meta={metaMap.get(album.id)}>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {!album.cover_url && <Tag tone="warning">sans cover</Tag>}
                  {!album.mbid && <Tag tone="critical">sans MBID</Tag>}
                  {album.mbid && (
                    <a href={`https://musicbrainz.org/release/${album.mbid}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 text-[11px] text-text-secondary transition-colors hover:border-text-tertiary hover:text-text-primary">
                      MusicBrainz ↗
                    </a>
                  )}
                </div>
              </AlbumTaskRow>
            ))}
            {noCover.length + noMbid.length > 8 && <PanelFootnote value={noCover.length + noMbid.length - 8} />}
          </QueuePanel>
        </section>

        {/* ── 5. Signaux produit ───────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Signaux produit" subtitle={`Metriques calculees sur ${range.label.toLowerCase()} depuis product_events`} tone={productSignals.available ? 'neutral' : 'warning'}>
            {productSignals.available ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[18px] border border-border bg-background p-4">
                  <h3 className="text-[14px] font-medium text-text-primary">Funnel {range.label.toLowerCase()}</h3>
                  <div className="mt-4 space-y-3">
                    <FunnelStep label="Signup" value={current.signups} nextValue={current.onboardings} />
                    <FunnelStep label="Onboarding" value={current.onboardings} nextValue={current.albumLoggers} />
                    <FunnelStep label="Premier album" value={current.albumLoggers} nextValue={current.followers} />
                    <FunnelStep label="Premier follow" value={current.followers} nextValue={null} />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[18px] border border-border bg-background p-4">
                    <h3 className="text-[14px] font-medium text-text-primary">Frictions {range.label.toLowerCase()}</h3>
                    <div className="mt-3 space-y-2">
                      {productSignals.frictionByEvent.length > 0 ? productSignals.frictionByEvent.map((item) => (
                        <CompactRow key={item.label} label={item.label} value={item.count} />
                      )) : <EmptyState message="Aucune friction critique loggee." compact />}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-border bg-background p-4">
                    <h3 className="text-[14px] font-medium text-text-primary">Recherche par surface</h3>
                    <div className="mt-3 space-y-2">
                      {productSignals.searchBySurface.length > 0 ? productSignals.searchBySurface.map((item) => (
                        <CompactRow key={item.label} label={item.label} value={item.count} />
                      )) : <EmptyState message="Pas encore assez de donnees." compact />}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState message="La table product_events n'est pas encore visible depuis l'admin. Applique la migration Supabase pour activer ce bloc." />
            )}
          </Panel>

          <Panel title="Evenements recents" subtitle={`Les derniers signaux sur ${range.label.toLowerCase()}`}>
            {productSignals.available && productSignals.recentEvents.length > 0 ? (
              <div className="space-y-2">
                {productSignals.recentEvents.map((event, index) => (
                  <div key={`${event.created_at}-${event.event_name}-${index}`} className="rounded-[14px] border border-border bg-background px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-text-primary">{humanizeEvent(event.event_name)}</p>
                        <p className="mt-1 text-[12px] text-text-secondary">
                          {humanizeSurface(event.surface)}
                          {event.user_id ? ` · ${event.user_id.slice(0, 8)}…` : ' · anonyme'}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-text-tertiary">{formatRelative(event.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Aucun evenement recent a afficher pour l'instant." />
            )}
          </Panel>
        </section>

        {/* ── 6. Tendances ─────────────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Tendance hebdo" subtitle="Lecture depuis la vue beta_dashboard_weekly" tone={productSignals.weeklyViewAvailable ? 'neutral' : 'warning'}>
            {productSignals.weeklyViewAvailable ? (
              <div className="space-y-3">
                {productSignals.weeklyTrend.map((row) => (
                  <div key={row.week} className="rounded-[18px] border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-text-primary">Semaine du {new Date(row.week).toLocaleDateString('fr-FR')}</p>
                        <p className="mt-1 text-[12px] text-text-secondary">WAU {row.wau} · logs {row.album_logs} · signups {row.signup_users}</p>
                      </div>
                      <Tag tone={row.search_no_results + row.auth_errors + row.import_failures > 0 ? 'warning' : 'success'}>
                        {row.search_no_results + row.auth_errors + row.import_failures > 0 ? `${row.search_no_results + row.auth_errors + row.import_failures} frictions` : 'stable'}
                      </Tag>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <CompactRow label="onboarding" value={row.onboarded_users} />
                      <CompactRow label="activation" value={row.activated_users} />
                      <CompactRow label="social" value={row.social_users} />
                      <CompactRow label="import fails" value={row.import_failures} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="La vue beta_dashboard_weekly n'est pas encore disponible. Execute le script SQL final pour alimenter ce bloc." />
            )}
          </Panel>

          <Panel title="Enrichissements recents" subtitle={`Metadonnees recuperees sur ${range.label.toLowerCase()}`}>
            {recentMeta.length > 0 ? (
              <div className="space-y-2">
                {recentMeta.map((meta) => {
                  const album = albums.find((item) => item.id === meta.album_id);
                  if (!album) return null;
                  return (
                    <AlbumTaskRow key={meta.album_id} album={album} meta={meta}>
                      <div className="flex items-center gap-2">
                        <Tag tone={meta.description ? 'success' : 'warning'}>{meta.description ? 'bio OK' : 'sans bio'}</Tag>
                        <span className="text-[11px] text-text-tertiary">{meta.fetched_at ? new Date(meta.fetched_at).toLocaleDateString('fr-FR') : '—'}</span>
                      </div>
                    </AlbumTaskRow>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="Pas d'enrichissement recent detecte cette periode." />
            )}
          </Panel>
        </section>

        {/* ── 7. Decisions rapides ─────────────────────────────────────── */}
        <section className="rounded-[20px] border border-border bg-background-secondary p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-[20px] font-medium tracking-[-0.02em] text-text-primary">Decisions rapides</h2>
            <p className="mt-1 text-[13px] text-text-secondary">Ce que cette page doit t'aider a arbitrer immediatement.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DecisionCard
              title="Reparer la decouvrabilite"
              body={`${noStreaming.length} album${noStreaming.length !== 1 ? 's' : ''} sans lien de streaming. Backlog le plus visible pour l'utilisateur final.`}
              tone={noStreaming.length > 0 ? 'warning' : 'success'}
            />
            <DecisionCard
              title="Taux d'activation"
              body={productSignals.available ? `${activationRate}% des onboardings ${range.key} vont jusqu'au premier album.` : 'Active product_events pour voir le vrai taux onboarding → album.'}
              tone={productSignals.available && activationRate < 50 ? 'warning' : 'neutral'}
            />
            <DecisionCard
              title="Frictions produit"
              body={productSignals.available ? `${totalFrictions} signal${totalFrictions !== 1 ? 's' : ''} de friction sur ${range.label.toLowerCase()} (auth, search, import).` : 'Les frictions apparaitront ici une fois la migration activee.'}
              tone={totalFrictions > 0 ? 'warning' : 'success'}
            />
            <DecisionCard
              title="Catalogue incomplet"
              body={`${notEnriched.length} album${notEnriched.length !== 1 ? 's' : ''} partiellement incomplets, dont ${noMbid.length} non enrichissables automatiquement.`}
              tone={notEnriched.length > 0 ? 'warning' : 'success'}
            />
          </div>
        </section>

      </div>
    </main>
  );
}

// ── Data helpers ─────────────────────────────────────────────────────────────

async function getProductSignals(supabase: any, rangeDays: number): Promise<ProductSignals> {
  try {
    const cutoff = new Date(Date.now() - (rangeDays * 2) * DAY_MS).toISOString();
    const { data, error } = await (supabase as any)
      .from('product_events')
      .select('created_at, event_name, surface, user_id')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { available: false, weeklyViewAvailable: false, current: EMPTY_WINDOW, previous: EMPTY_WINDOW, recentEvents: [], frictionByEvent: [], searchBySurface: [], weeklyTrend: [] };
    }

    const rows = data as ProductEventRow[];
    const currentBoundary = Date.now() - rangeDays * DAY_MS;
    const currentRows = rows.filter((row) => new Date(row.created_at).getTime() >= currentBoundary);
    const previousRows = rows.filter((row) => new Date(row.created_at).getTime() < currentBoundary);

    const weeklyTrend = await getWeeklyTrend(supabase, rangeDays);

    return {
      available: true,
      weeklyViewAvailable: weeklyTrend.available,
      current: computeWindowMetrics(currentRows),
      previous: computeWindowMetrics(previousRows),
      recentEvents: rows.slice(0, 10),
      frictionByEvent: toBreakdown(currentRows.filter((row) => ['auth_error', 'search_no_results', 'album_import_failed'].includes(row.event_name)).map((row) => humanizeEvent(row.event_name))),
      searchBySurface: toBreakdown(currentRows.filter((row) => row.event_name === 'search_used').map((row) => humanizeSurface(row.surface))),
      weeklyTrend: weeklyTrend.rows,
    };
  } catch {
    return { available: false, weeklyViewAvailable: false, current: EMPTY_WINDOW, previous: EMPTY_WINDOW, recentEvents: [], frictionByEvent: [], searchBySurface: [], weeklyTrend: [] };
  }
}

async function getWeeklyTrend(supabase: any, rangeDays: number): Promise<{ available: boolean; rows: WeeklyTrendRow[] }> {
  try {
    const cutoff = new Date(Date.now() - rangeDays * DAY_MS).toISOString().slice(0, 10);
    const { data, error } = await (supabase as any)
      .from('beta_dashboard_weekly')
      .select('week, signup_users, onboarded_users, activated_users, social_users, wau, album_logs, import_failures, search_no_results, auth_errors')
      .gte('week', cutoff)
      .order('week', { ascending: false });

    if (error || !data) return { available: false, rows: [] };
    return { available: true, rows: data as WeeklyTrendRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}

function resolveRange(rawValue: string | string[] | undefined): { key: RangeKey; label: string; days: number } {
  const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (normalized === '30d' || normalized === '90d') {
    return { key: normalized, ...RANGE_OPTIONS[normalized] };
  }
  return { key: '7d', ...RANGE_OPTIONS['7d'] };
}

function computeWindowMetrics(rows: ProductEventRow[]): WindowMetrics {
  const countUsers = (eventName?: string) => new Set(rows.filter((row) => row.user_id && (!eventName || row.event_name === eventName)).map((row) => row.user_id)).size;
  return {
    signups: countUsers('signup_completed'),
    onboardings: countUsers('onboarding_completed'),
    albumLoggers: countUsers('album_logged'),
    followers: countUsers('user_followed'),
    wau: countUsers(),
    albumLogs: rows.filter((row) => row.event_name === 'album_logged').length,
    authErrors: rows.filter((row) => row.event_name === 'auth_error').length,
    noResultSearches: rows.filter((row) => row.event_name === 'search_no_results').length,
    importFailures: rows.filter((row) => row.event_name === 'album_import_failed').length,
  };
}

function toBreakdown(labels: string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

function coveragePercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function rateLabel(numerator: number, denominator: number, suffix: string): string {
  if (denominator === 0) return `0% ${suffix}`;
  return `${Math.round((numerator / denominator) * 100)}% ${suffix}`;
}

function humanizeEvent(eventName: string): string {
  return ({
    signup_completed: 'Signup completed',
    onboarding_completed: 'Onboarding completed',
    album_logged: 'Album logged',
    user_followed: 'User followed',
    auth_error: 'Auth error',
    search_no_results: 'Search without result',
    search_used: 'Search used',
    album_import_failed: 'Album import failed',
    album_import_started: 'Album import started',
    review_liked: 'Review liked',
    comment_created: 'Comment created',
  } as Record<string, string>)[eventName] ?? eventName.replaceAll('_', ' ');
}

function humanizeSurface(surface: string | null): string {
  if (!surface) return 'surface inconnue';
  return ({
    internal_search: 'recherche interne',
    musicbrainz_albums: 'search albums MB',
    musicbrainz_artists: 'search artists MB',
    musicbrainz_import: 'import MusicBrainz',
    onboarding: 'onboarding',
    follow_button: 'follow button',
    auth_form: 'auth form',
    diary: 'diary',
  } as Record<string, string>)[surface] ?? surface;
}

function formatDelta(value: number): string {
  if (value === 0) return 'stable';
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatRelative(value: string): string {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / (60 * 1000)));
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

// ── UI Components ────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children, action, tone = 'neutral' }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <section className={`rounded-[18px] border p-5 sm:p-6 ${tone === 'warning' ? 'border-[#E2D5BE] bg-[#FBF8F2]' : 'border-border bg-background-secondary'}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.02em] text-text-primary">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-text-secondary">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueuePanel({ title, subtitle, count, children, action }: { title: string; subtitle: string; count: number; children: ReactNode; action?: ReactNode }) {
  return (
    <Panel title={title} subtitle={subtitle} action={action} tone={count > 0 ? 'warning' : 'neutral'}>
      <div className="mb-4 flex items-center gap-2">
        <Tag tone={count > 0 ? 'warning' : 'success'}>{count > 0 ? String(count) : 'OK'}</Tag>
      </div>
      <div className="space-y-2">{count > 0 ? children : <EmptyState message="Rien a traiter ici pour l'instant." />}</div>
    </Panel>
  );
}

function PanelFootnote({ value }: { value: number }) {
  return <p className="mt-3 text-[12px] text-text-tertiary">+ {value} elements supplementaires dans cette file.</p>;
}

function MetricCard({ label, value, subtitle, accent }: { label: string; value: number; subtitle: string; accent: 'sand' | 'rose' | 'warning' | 'success' }) {
  const theme = {
    sand: 'from-[#F7EFE4] to-[#EAE0D0] border-[#DCCDB7]',
    rose: 'from-[#F8EAE8] to-[#EFD9D6] border-[#DFC4C1]',
    warning: 'from-[#FBF4E6] to-[#F3E4C9] border-[#E0C48F]',
    success: 'from-[#ECF4EB] to-[#DDE9DA] border-[#C3D5BE]',
  }[accent];

  return (
    <div className={`rounded-[16px] border bg-gradient-to-br ${theme} p-4`}>
      <p className="text-[12px] uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 text-[34px] font-medium leading-none tracking-[-0.04em] text-text-primary">{value.toLocaleString('fr-FR')}</p>
      <p className="mt-2 text-[12px] text-text-secondary">{subtitle}</p>
    </div>
  );
}

function DeltaCard({ label, value, delta, hint }: { label: string; value: number; delta: number; hint: string }) {
  const deltaTone = delta > 0 ? 'text-[#2E6B48]' : delta < 0 ? 'text-[#9A5B4A]' : 'text-text-tertiary';
  const deltaBg = delta > 0 ? 'bg-[#E4F0E7]' : delta < 0 ? 'bg-[#F4E4DF]' : 'bg-background-tertiary';

  return (
    <div className="rounded-[16px] border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-text-secondary">{label}</p>
          <p className="mt-2 text-[36px] font-medium leading-none tracking-[-0.04em] text-text-primary">{value.toLocaleString('fr-FR')}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${deltaTone} ${deltaBg}`}>{formatDelta(delta)}</span>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-text-secondary">{hint}</p>
    </div>
  );
}

function GlassMetric({ label, value, subtitle, tone }: { label: string; value: string; subtitle: string; tone: 'warning' | 'success' }) {
  return (
    <div className={`rounded-[16px] border p-4 ${tone === 'success' ? 'border-[#C3D5BE] bg-[#F5FAF4]' : 'border-[#DFC9A5] bg-[#FCF8F0]'}`}>
      <p className="text-[12px] uppercase tracking-[0.14em] text-text-secondary">{label}</p>
      <p className="mt-2 text-[30px] font-medium leading-none tracking-[-0.04em] text-text-primary">{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-text-secondary">{subtitle}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-border bg-background px-4 py-3">
      <p className="text-[12px] text-text-secondary">{label}</p>
      <p className="mt-1 text-[26px] font-medium tracking-[-0.03em] text-text-primary">{value.toLocaleString('fr-FR')}</p>
    </div>
  );
}

function HealthRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'warning' | 'success' | 'critical' }) {
  const percentage = total > 0 ? Math.max(4, Math.round((value / total) * 100)) : 0;
  const barTone = tone === 'success' ? 'bg-[#6E8A61]' : tone === 'critical' ? 'bg-[#B86A5F]' : 'bg-[#C8A565]';

  return (
    <div className="rounded-[14px] border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3 text-[13px] text-text-primary">
        <span>{label}</span>
        <span className="font-medium">{value.toLocaleString('fr-FR')}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-background-tertiary">
        <div className={`h-2 rounded-full ${barTone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function FunnelStep({ label, value, nextValue }: { label: string; value: number; nextValue: number | null }) {
  return (
    <div className="rounded-[14px] border border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
          <p className="mt-1 text-[28px] font-medium leading-none tracking-[-0.03em] text-text-primary">{value.toLocaleString('fr-FR')}</p>
        </div>
        {nextValue !== null && <Tag tone="neutral">{value > 0 ? `${Math.round((nextValue / value) * 100)}%` : '0%'}</Tag>}
      </div>
    </div>
  );
}

function CompactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-border bg-background px-3 py-2">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className="text-[12px] font-medium text-text-primary">{value}</span>
    </div>
  );
}

function AlbumTaskRow({ album, meta, children }: { album: Album; meta?: AlbumMeta; children?: ReactNode }) {
  const year = album.release_date ? new Date(album.release_date).getFullYear() : null;
  return (
    <div className="rounded-[14px] border border-border bg-background px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/albums/${album.id}`} className="truncate text-[14px] font-medium text-text-primary transition-colors hover:text-text-secondary">
              {album.title}
            </Link>
            <span className="text-[12px] text-text-secondary">{album.artist_name}{year ? ` · ${year}` : ''}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            {album.mbid ? <span className="font-mono">{album.mbid.slice(0, 8)}…</span> : <span>MBID absent</span>}
            {meta?.fetched_at && <span>enrichi le {new Date(meta.fetched_at).toLocaleDateString('fr-FR')}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function DecisionCard({ title, body, tone = 'neutral' }: { title: string; body: string; tone?: 'neutral' | 'warning' | 'success' }) {
  const styles = {
    neutral: 'border-border bg-background',
    warning: 'border-[#E2D5BE] bg-[#FBF8F2]',
    success: 'border-[#C3D5BE] bg-[#F5FAF4]',
  }[tone];

  return (
    <div className={`rounded-[14px] border p-4 ${styles}`}>
      <h3 className="text-[14px] font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-text-secondary">{body}</p>
    </div>
  );
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`rounded-[14px] border border-dashed border-border bg-background text-text-secondary ${compact ? 'px-3 py-2 text-[12px]' : 'px-4 py-6 text-[13px]'}`}>
      {message}
    </div>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone: 'neutral' | 'warning' | 'success' | 'critical' }) {
  const styles = {
    neutral: 'bg-background-tertiary text-text-secondary',
    warning: 'bg-[#F7EEDB] text-[#8A6A27]',
    success: 'bg-[#E8F1E6] text-[#376548]',
    critical: 'bg-[#F5E5E1] text-[#9A5A4D]',
  }[tone];

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles}`}>{children}</span>;
}
