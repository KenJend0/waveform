// Miroir de apps/web/lib/musicbrainzReleasePolicy.mjs — module pur, aucune dépendance Deno/Node.
type ReleaseGroupTypeInfo = {
  'primary-type'?: string;
  'secondary-types'?: string[];
};

export const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live', 'Compilation', 'Remix', 'Demo',
  'Spokenword', 'Interview',
  'Audiobook', 'Audio drama', 'Field recording',
]);

const EXCLUDED_SECONDARY_TYPES_ALLOWING_LIVE = new Set(
  [...EXCLUDED_SECONDARY_TYPES].filter((t) => t !== 'Live')
);

const DEFAULT_ALLOWED_PRIMARY_TYPES = new Set(['Album', 'EP']);

export function isAcceptableReleaseGroup(
  rg: ReleaseGroupTypeInfo,
  { allowLive = false, allowedPrimaryTypes = DEFAULT_ALLOWED_PRIMARY_TYPES }: { allowLive?: boolean; allowedPrimaryTypes?: Set<string> } = {}
): boolean {
  const primary = rg['primary-type'];
  if (primary && !allowedPrimaryTypes.has(primary)) return false;
  const secondaryTypes = rg['secondary-types'] || [];
  const excluded = allowLive ? EXCLUDED_SECONDARY_TYPES_ALLOWING_LIVE : EXCLUDED_SECONDARY_TYPES;
  return !secondaryTypes.some((t) => excluded.has(t));
}

export type ReleaseCandidate = { id: string; status?: string; trackCount: number };

/** Choisit la meilleure release concrète au sein d'un release-group. */
export function pickBestRelease(releases: ReleaseCandidate[], mode: 'fewest' | 'most' = 'most'): ReleaseCandidate | null {
  if (!releases || releases.length === 0) return null;
  const official = releases.filter((r) => r.status === 'Official');
  const candidates = official.length > 0 ? official : releases;
  const withTracks = candidates.filter((r) => r.trackCount > 0);
  const pool = withTracks.length > 0 ? withTracks : candidates;
  return [...pool].sort((a, b) =>
    mode === 'fewest' ? a.trackCount - b.trackCount : b.trackCount - a.trackCount
  )[0];
}

export function releaseSelectionMode(primaryType: string | null | undefined): 'fewest' | 'most' {
  return primaryType === 'Single' || primaryType === 'EP' ? 'fewest' : 'most';
}
