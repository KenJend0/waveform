'use server';

import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { fetchArtistMetadata } from './musicbrainz';

/**
 * Batch-fetch artist images for search results.
 * 1. Checks DB cache — only considers an artist "resolved" if image_url is non-null
 * 2. For all other MBIDs (not in DB OR in DB with null image_url), queries Wikidata SPARQL
 * 3. Saves found images back to DB via admin client (bypasses RLS)
 * Returns { [mbid]: imageUrl | null }
 */
export async function getArtistImagesByMbids(
  mbids: string[]
): Promise<Record<string, string | null>> {
  if (!mbids.length) return {};
  const supabase = await createSupabaseServer();
  const supabaseAdmin = createSupabaseAdmin();

  // 1. DB lookup (read — user client is fine)
  const { data } = await (supabase
    .from('artists')
    .select('mbid, image_url') as any)
    .in('mbid', mbids);

  const result: Record<string, string | null> = {};
  // MBIDs that already have an image in DB → skip Wikidata
  const resolvedMbids = new Set<string>();
  // MBIDs that ARE in DB but have no image → query Wikidata + save back
  const inDbWithoutImage = new Set<string>();

  (data || []).forEach((row: any) => {
    if (!row.mbid) return;
    if (row.image_url) {
      result[row.mbid] = row.image_url;
      resolvedMbids.add(row.mbid);
    } else {
      inDbWithoutImage.add(row.mbid);
    }
  });

  // 2. Wikidata SPARQL for every MBID that doesn't have an image yet
  const needsWikidata = mbids.filter((id) => !resolvedMbids.has(id));
  if (needsWikidata.length === 0) return result;

  try {
    const values = needsWikidata.map((id) => `"${id}"`).join(' ');
    const sparql = `SELECT ?mbid ?image WHERE {
      ?artist wdt:P434 ?mbid.
      ?artist wdt:P18 ?image.
      VALUES ?mbid { ${values} }
    }`;

    const resp = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
      {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'Waveform/1.0 (musicboxd)',
        },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (resp.ok) {
      const wdData = await resp.json();
      const toSave: Array<{ mbid: string; imageUrl: string }> = [];

      for (const binding of wdData.results?.bindings || []) {
        const mbid = binding.mbid?.value;
        const imageUrl = binding.image?.value;
        if (mbid && imageUrl && !result[mbid]) {
          const finalUrl = `${imageUrl.replace(/^http:\/\//, 'https://')}?width=400`;
          result[mbid] = finalUrl;
          // If this artist is in DB but had no image_url, save it for next time
          if (inDbWithoutImage.has(mbid)) {
            toSave.push({ mbid, imageUrl: finalUrl });
          }
        }
      }

      // Persist via admin client (bypasses RLS on artists table)
      if (toSave.length > 0) {
        Promise.all(
          toSave.map(({ mbid, imageUrl }) =>
            (supabaseAdmin
              .from('artists')
              .update({ image_url: imageUrl } as any) as any)
              .eq('mbid', mbid)
          )
        ).catch(() => {/* ignore write errors */});
      }
    }
  } catch {
    // Wikidata timeout or error — return what we have from DB
  }

  return result;
}

const NO_BIO_SENTINEL = '_none';

/**
 * Get artist bio + image from DB cache, or fetch from MusicBrainz/Wikipedia/Wikidata
 * and store in DB for future requests.
 *
 * Cache strategy:
 * - bio = null or ''   → not yet fetched → fetch everything
 * - bio = '_none'      → fetched, no bio found → don't re-fetch bio
 *                        but re-fetch image if image_url is still null
 * - bio = 'actual text'→ cached bio — still fetch image if image_url is null
 *
 * All writes use supabaseAdmin to bypass RLS on the artists table.
 */
export async function getOrFetchArtistMeta(
  artistId: string,
  mbid: string | null
): Promise<{ bio: string | null; imageUrl: string | null }> {
  const supabase = await createSupabaseServer();
  const supabaseAdmin = createSupabaseAdmin();

  // Check DB first
  const { data: artist } = await (supabase
    .from('artists')
    .select('bio, image_url') as any)
    .eq('id', artistId)
    .maybeSingle();

  const row = artist as { bio?: string | null; image_url?: string | null } | null;

  const hasBio = !!(row?.bio && row.bio !== NO_BIO_SENTINEL && row.bio !== '');
  const isSentinel = row?.bio === NO_BIO_SENTINEL;
  const hasImage = !!(row?.image_url);

  // Everything is cached → return immediately
  if ((hasBio || isSentinel) && hasImage) {
    return {
      bio: hasBio ? (row!.bio ?? null) : null,
      imageUrl: row!.image_url ?? null,
    };
  }

  // No mbid → can't fetch from external APIs
  if (!mbid) {
    return {
      bio: hasBio ? (row!.bio ?? null) : null,
      imageUrl: row?.image_url ?? null,
    };
  }

  // Fetch from external APIs
  const meta = await fetchArtistMetadata(mbid);

  // Preserve existing bio if already cached
  const bioToStore = (hasBio || isSentinel)
    ? (row!.bio ?? NO_BIO_SENTINEL)
    : (meta.bio || NO_BIO_SENTINEL);

  let finalImage = meta.imageUrl || row?.image_url || null;

  // If no Wikidata image and no existing image, fallback to first album cover
  if (!finalImage) {
    const { data: firstAlbum } = await supabase
      .from('albums')
      .select('cover_url')
      .eq('artist_id', artistId)
      .not('cover_url', 'is', null)
      .limit(1)
      .maybeSingle();

    finalImage = firstAlbum?.cover_url || null;
  }

  // Store via admin client (bypasses RLS on artists table)
  await (supabaseAdmin
    .from('artists')
    .update({ bio: bioToStore, image_url: finalImage } as any) as any)
    .eq('id', artistId);

  return {
    bio: hasBio ? (row!.bio ?? null) : (meta.bio || null),
    imageUrl: finalImage,
  };
}
