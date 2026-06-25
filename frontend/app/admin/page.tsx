import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createSupabaseAdmin, getAuthUser } from '@/lib/supabase/server';
import type { ReportedContentType } from '@/app/actions/moderation';
import DeleteReportedContentButton from './DeleteReportedContentButton';
import AnalyzeReportButton from './AnalyzeReportButton';
import CatalogueAlbums from './CatalogueAlbums';

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
  hasTags: boolean;
  hasStreaming: boolean;
  hasDescription: boolean;
  fetched_at: string | null;
  streamingAttempts: number;
};

type AlbumMeta = {
  album_id: string;
  description: string | null;
  fetched_at: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  deezer_url: string | null;
  streaming_attempts: number | null;
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
  current: WindowMetrics;
  previous: WindowMetrics;
  recentEvents: ProductEventRow[];
  frictionByEvent: Array<{ label: string; count: number }>;
  searchBySurface: Array<{ label: string; count: number }>;
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
    { data: rawReports },
    { data: cronHealthData },
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
    (supabase as any).from('album_metadata').select('album_id, description, fetched_at, spotify_url, apple_music_url, deezer_url, streaming_attempts').order('fetched_at', { ascending: false }),
    (supabase as any).from('content_reports').select('id, content_type, content_id, reason, created_at, reporter_id').order('created_at', { ascending: false }).limit(50),
    (supabase as any).from('cron_health').select('job_name, status, last_run_at'),
    getProductSignals(supabase, range.days),
  ]);

  const CRON_FRESHNESS_HOURS: Record<string, number> = {
    'daily-enrich': 36,
    'process-external-imports': 2,
  };
  const cronWarnings = Object.entries(CRON_FRESHNESS_HOURS).map(([jobName, maxHours]) => {
    const row = (cronHealthData as Array<{ job_name: string; status: string; last_run_at: string }> ?? [])
      .find((r) => r.job_name === jobName);
    const staleMs = maxHours * 60 * 60 * 1000;
    const isStale = !row || Date.now() - new Date(row.last_run_at).getTime() > staleMs;
    const isFailing = row?.status === 'failure';
    return { jobName, row, isStale, isFailing, healthy: row && !isStale && !isFailing };
  });
  const unhealthyCrons = cronWarnings.filter((c) => !c.healthy);

  // Enrich reports with reporter usernames + content text
  const reports = (rawReports ?? []) as Array<{ id: string; content_type: string; content_id: string; reason: string; created_at: string; reporter_id: string }>;
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
  const entryIds = reports.filter((r) => r.content_type === 'diary_entry').map((r) => r.content_id);
  const commentIds = reports.filter((r) => r.content_type === 'diary_comment').map((r) => r.content_id);
  const trackEntryIds = reports.filter((r) => r.content_type === 'track_diary_entry').map((r) => r.content_id);
  const trackCommentIds = reports.filter((r) => r.content_type === 'track_diary_comment').map((r) => r.content_id);

  const [{ data: reporterProfiles }, { data: entryTexts }, { data: commentTexts }, { data: trackEntryTexts }, { data: trackCommentTexts }] = await Promise.all([
    reporterIds.length > 0 ? supabase.from('profiles').select('id, username').in('id', reporterIds) : Promise.resolve({ data: [] }),
    entryIds.length > 0 ? supabase.from('diary_entries').select('id, review_title, review_body').in('id', entryIds) : Promise.resolve({ data: [] }),
    commentIds.length > 0 ? supabase.from('diary_comments').select('id, body').in('id', commentIds) : Promise.resolve({ data: [] }),
    trackEntryIds.length > 0 ? supabase.from('track_diary_entries').select('id, review_title, review_body').in('id', trackEntryIds) : Promise.resolve({ data: [] }),
    trackCommentIds.length > 0 ? supabase.from('track_diary_comments').select('id, body').in('id', trackCommentIds) : Promise.resolve({ data: [] }),
  ]);

  const reporterMap = new Map((reporterProfiles ?? []).map((p) => [p.id, p.username]));
  const entryTextMap = new Map((entryTexts ?? []).map((e) => [e.id, e.review_body || e.review_title || null]));
  const commentTextMap = new Map((commentTexts ?? []).map((c) => [c.id, c.body]));
  const trackEntryTextMap = new Map((trackEntryTexts ?? []).map((e) => [e.id, e.review_body || e.review_title || null]));
  const trackCommentTextMap = new Map((trackCommentTexts ?? []).map((c) => [c.id, c.body]));


  const genreSet = new Set((genreData ?? []).map((row) => row.album_id));
  const metaMap = new Map<string, AlbumMeta>(((metaData ?? []) as AlbumMeta[]).map((row) => [row.album_id, row]));

  const albums: Album[] = ((rawAlbums ?? []) as any[]).map((album) => {
    const meta = metaMap.get(album.id);
    return {
      id: album.id,
      title: album.title,
      mbid: album.mbid ?? null,
      cover_url: album.cover_url ?? null,
      release_date: album.release_date ?? null,
      artist_name: Array.isArray(album.artists) ? (album.artists[0]?.name ?? '—') : (album.artists?.name ?? '—'),
      hasTags: genreSet.has(album.id),
      hasStreaming: !!(meta?.spotify_url || meta?.apple_music_url || meta?.deezer_url),
      hasDescription: !!(meta?.description),
      fetched_at: meta?.fetched_at ?? null,
      streamingAttempts: meta?.streaming_attempts ?? 0,
    };
  });

  const noCover = albums.filter((album) => !album.cover_url);
  const noMbid = albums.filter((album) => !album.mbid);
  const noStreaming = albums.filter((album) => !album.hasStreaming);
  const notEnriched = albums.filter((album) => !album.hasTags);

  const recentMeta = ((metaData ?? []) as AlbumMeta[])
    .filter((meta) => meta.fetched_at && Date.now() - new Date(meta.fetched_at).getTime() < range.days * DAY_MS)
    .slice(0, 8);

  // Résout l'importateur pour chaque enrichissement récent via product_events
  const { data: importEventsRaw } = await (supabase as any)
    .from('product_events')
    .select('user_id, properties')
    .eq('event_name', 'album_import_started')
    .gte('created_at', new Date(Date.now() - 60 * DAY_MS).toISOString());

  const importEvents = (importEventsRaw ?? []) as Array<{ user_id: string; properties: Record<string, string> }>;
  const importerByMbid = new Map<string, string>();
  for (const evt of importEvents) {
    const mbid = evt.properties?.mbid;
    if (mbid && !importerByMbid.has(mbid)) importerByMbid.set(mbid, evt.user_id);
  }

  const importerUserIds = [...new Set([...importerByMbid.values()].filter(Boolean))];
  const { data: importerProfiles } = importerUserIds.length > 0
    ? await supabase.from('profiles').select('id, username').in('id', importerUserIds)
    : { data: [] };
  const usernameById = new Map(((importerProfiles ?? []) as Array<{ id: string; username: string }>).map((p) => [p.id, p.username]));

  const current = productSignals.current;
  const totalFrictions = current.authErrors + current.noResultSearches + current.importFailures;
  const activationRate = current.onboardings > 0 ? Math.round((current.albumLoggers / current.onboardings) * 100) : 0;

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-page px-6 py-6 lg:py-8 space-y-6">

        {/* ── 0. Alerte cron ───────────────────────────────────────────── */}
        {unhealthyCrons.length > 0 && (
          <section className="rounded-[20px] border border-[#E0A399] bg-[#FBEEEC] p-5">
            <div className="flex flex-wrap items-start gap-3">
              <Tag tone="critical">Cron en souffrance</Tag>
              <div className="space-y-1">
                {unhealthyCrons.map(({ jobName, row, isStale, isFailing }) => (
                  <p key={jobName} className="text-[13px] text-[#7A3C32]">
                    <span className="font-medium">{jobName}</span>
                    {!row && ' — aucun ping reçu (jamais exécuté depuis l\'ajout du monitoring, ou échec avant l\'étape de reporting).'}
                    {row && isFailing && ` — dernière exécution en échec (${new Date(row.last_run_at).toLocaleString('fr-FR')}).`}
                    {row && !isFailing && isStale && ` — dernier succès il y a trop longtemps (${new Date(row.last_run_at).toLocaleString('fr-FR')}).`}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

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

        {/* ── 2. Santé catalogue ───────────────────────────────────────── */}
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

        {/* ── 3. Signaux produit ───────────────────────────────────────── */}
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

        {/* ── 4. Enrichissements recents ───────────────────────────────── */}
        <section>
          <Panel title="Enrichissements recents" subtitle={`Metadonnees recuperees sur ${range.label.toLowerCase()}`}>
            {recentMeta.length > 0 ? (
              <div className="space-y-2">
                {recentMeta.map((meta) => {
                  const album = albums.find((item) => item.id === meta.album_id);
                  if (!album) return null;
                  const importerUsername = album.mbid
                    ? usernameById.get(importerByMbid.get(album.mbid) ?? '')
                    : undefined;
                  return (
                    <AlbumTaskRow key={meta.album_id} album={album} meta={meta}>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Tag tone={genreSet.has(album.id) ? 'success' : 'warning'}>{genreSet.has(album.id) ? 'tags OK' : 'sans tags'}</Tag>
                        {importerUsername && <span className="text-[11px] text-text-tertiary">@{importerUsername}</span>}
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

        {/* ── Modération — signalements ────────────────────────────────── */}
        <section className="rounded-[20px] border border-border bg-background-secondary p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-[20px] font-medium text-text-primary tracking-[-0.01em]">Signalements</h2>
            <Tag tone={reports.length > 0 ? 'warning' : 'success'}>
              {reports.length} en attente
            </Tag>
          </div>

          {reports.length === 0 ? (
            <EmptyState message="Aucun signalement pour l'instant." />
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const contentType = report.content_type as ReportedContentType;
                const textMap = {
                  diary_entry: entryTextMap,
                  diary_comment: commentTextMap,
                  track_diary_entry: trackEntryTextMap,
                  track_diary_comment: trackCommentTextMap,
                }[contentType];
                const text = textMap?.get(report.content_id);

                const TYPE_LABELS: Record<ReportedContentType, string> = {
                  diary_entry: 'Écoute',
                  diary_comment: 'Commentaire',
                  track_diary_entry: 'Écoute (track)',
                  track_diary_comment: 'Commentaire (track)',
                };
                const isEntry = contentType === 'diary_entry' || contentType === 'track_diary_entry';
                const viewHref = contentType === 'diary_entry'
                  ? `/diary/${report.content_id}`
                  : contentType === 'track_diary_entry'
                  ? `/track-diary/${report.content_id}`
                  : null;

                return (
                  <div key={report.id} className="rounded-[14px] border border-border bg-background px-4 py-3 space-y-2">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={isEntry ? 'neutral' : 'warning'}>
                        {TYPE_LABELS[contentType] ?? contentType}
                      </Tag>
                      <span className="text-[12px] text-text-tertiary">
                        signalé par <span className="text-text-secondary">@{reporterMap.get(report.reporter_id) ?? '?'}</span>
                      </span>
                      <span className="text-[11px] text-text-tertiary ml-auto">
                        {new Date(report.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {/* Content preview */}
                    {text ? (
                      <p className="text-[13px] text-text-primary leading-[1.6] line-clamp-3 italic">
                        «&thinsp;{text.trim()}&thinsp;»
                      </p>
                    ) : (
                      <p className="text-[12px] text-text-tertiary italic">Contenu supprimé ou sans texte</p>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <AnalyzeReportButton
                        contentType={contentType}
                        contentId={report.content_id}
                      />
                      {viewHref && (
                        <Link
                          href={viewHref}
                          className="text-[11px] text-text-tertiary hover:text-text-primary border border-border rounded-full px-2.5 py-1 transition-colors duration-150"
                        >
                          Voir
                        </Link>
                      )}
                      <DeleteReportedContentButton
                        reportId={report.id}
                        contentType={contentType}
                        contentId={report.content_id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Catalogue albums ─────────────────────────────────────────── */}
        <CatalogueAlbums albums={albums} />

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
      return { available: false, current: EMPTY_WINDOW, previous: EMPTY_WINDOW, recentEvents: [], frictionByEvent: [], searchBySurface: [] };
    }

    const rows = data as ProductEventRow[];
    const currentBoundary = Date.now() - rangeDays * DAY_MS;
    const currentRows = rows.filter((row) => new Date(row.created_at).getTime() >= currentBoundary);
    const previousRows = rows.filter((row) => new Date(row.created_at).getTime() < currentBoundary);

    return {
      available: true,
      current: computeWindowMetrics(currentRows),
      previous: computeWindowMetrics(previousRows),
      recentEvents: rows.slice(0, 10),
      frictionByEvent: toBreakdown(currentRows.filter((row) => ['auth_error', 'album_import_failed'].includes(row.event_name) || (row.event_name === 'search_no_results' && row.surface === 'internal_search')).map((row) => humanizeEvent(row.event_name))),
      searchBySurface: toBreakdown(currentRows.filter((row) => row.event_name === 'search_used').map((row) => humanizeSurface(row.surface))),
    };
  } catch {
    return { available: false, current: EMPTY_WINDOW, previous: EMPTY_WINDOW, recentEvents: [], frictionByEvent: [], searchBySurface: [] };
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
    noResultSearches: rows.filter((row) => row.event_name === 'search_no_results' && row.surface === 'internal_search').length,
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
