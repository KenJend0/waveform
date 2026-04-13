import { createClient } from '@supabase/supabase-js';

export interface OgEntryData {
  albumTitle: string;
  artistName: string;
  year: number | null;
  /** Data URI base64 de la cover, ou null */
  coverDataUri: string | null;
  authorName: string;
  reviewBody: string | null;
  reviewTitle: string | null;
  rating: number | null;
  listenedAt: string;
  reListenLabel: string | null;
}

/**
 * Coupe le texte à la première frontière sémantique propre avant maxLen.
 * Priorité : fin de phrase → virgule → dernier mot.
 */
export function truncateSemantic(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const sub = text.slice(0, maxLen);

  // 1. Fin de phrase
  const sentenceEnd = Math.max(
    sub.lastIndexOf('. '),
    sub.lastIndexOf('.\n'),
    sub.lastIndexOf('! '),
    sub.lastIndexOf('? '),
  );
  if (sentenceEnd > maxLen * 0.55) {
    return sub.slice(0, sentenceEnd + 1).trim() + '\u2026';
  }

  // 2. Virgule / point-virgule
  const commaEnd = Math.max(sub.lastIndexOf(', '), sub.lastIndexOf(' ; '));
  if (commaEnd > maxLen * 0.65) {
    return sub.slice(0, commaEnd).trim() + '\u2026';
  }

  // 3. Dernier espace
  const spaceEnd = sub.trimEnd().lastIndexOf(' ');
  return (spaceEnd > maxLen * 0.65 ? sub.slice(0, spaceEnd) : sub).trim() + '\u2026';
}

/** Coupe le texte au dernier mot avant maxLen. */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen).trimEnd();
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.65 ? cut.slice(0, lastSpace) : cut) + '\u2026';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function getOgEntryData(entryId: string): Promise<OgEntryData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: entry } = await supabase
    .from('diary_entries')
    .select('rating, review_title, review_body, listened_at, re_listen, is_public, user_id, album_id')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry || !entry.is_public) return null;

  const [{ data: album }, { data: profile }] = await Promise.all([
    supabase
      .from('albums')
      .select('title, cover_url, release_date, artist_id')
      .eq('id', entry.album_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', entry.user_id)
      .maybeSingle(),
  ]);

  let artistName = '';
  if (album?.artist_id) {
    const { data: artist } = await supabase
      .from('artists')
      .select('name')
      .eq('id', album.artist_id)
      .maybeSingle();
    artistName = artist?.name ?? '';
  }

  // Fetch cover → data URI pour éviter les redirects 307 CoverArt dans Satori
  let coverDataUri: string | null = null;
  if (album?.cover_url) {
    try {
      const res = await fetch(album.cover_url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') ?? 'image/jpeg';
        const buffer = await res.arrayBuffer();
        coverDataUri = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
      }
    } catch {
      coverDataUri = null;
    }
  }

  const year = album?.release_date ? new Date(album.release_date).getFullYear() : null;
  const authorName =
    profile?.display_name ||
    (profile?.username ? `@${profile.username}` : 'Quelqu\u2019un');

  return {
    albumTitle: album?.title ?? 'Album inconnu',
    artistName,
    year,
    coverDataUri,
    authorName,
    reviewBody: entry.review_body ?? null,
    reviewTitle: entry.review_title ?? null,
    rating: entry.rating,
    listenedAt: entry.listened_at,
    reListenLabel: entry.re_listen ? '\u00a0· ré-écoute' : null,
  };
}
