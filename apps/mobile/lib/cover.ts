const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

function storageUrl(mbid: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/covers/${mbid}.jpg`;
}

/**
 * Construit src + fallback pour CoverImage — miroir de coverSrcWithFallback
 * (web, apps/web/lib/cover.ts). Priorité : Supabase Storage (par mbid) →
 * cover_url de la DB → hotlink direct CoverArt Archive → null.
 *
 * Le dernier tier couvre le cas d'un album fraîchement importé : le job backend
 * qui mirror la cover vers Supabase Storage (et remplit cover_url) est asynchrone,
 * donc juste après l'import ni le storage ni cover_url ne sont encore prêts. Sans
 * ce fallback, la cover restait sur le placeholder jusqu'à ce que l'utilisateur
 * force un remount (pull-to-refresh) — le hotlink CoverArt Archive, lui, est
 * disponible immédiatement (même source que l'import) et c'est déjà le pattern
 * utilisé ailleurs dans le code pour les résultats pas encore en DB (recherche,
 * découverte artiste — cf. apps/mobile/lib/musicbrainz.ts).
 */
export function coverSrcWithFallback(
  mbid: string | null | undefined,
  coverUrl: string | null | undefined
): { src: string | null; fallback: string | undefined } {
  const isSupabase = (url: string) => url.includes('supabase.co/storage');

  if (mbid) {
    const storageSrc = storageUrl(mbid);
    const fallback = coverUrl && !isSupabase(coverUrl)
      ? coverUrl
      : coverUrl
        ? undefined
        : `https://coverartarchive.org/release-group/${mbid}/front`;
    return { src: storageSrc, fallback };
  }

  return { src: coverUrl ?? null, fallback: undefined };
}
