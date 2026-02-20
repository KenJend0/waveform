'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { fetchArtistMetadata } from './musicbrainz';

/**
 * Batch-fetch artist images for search results.
 * 1. Checks DB cache (artists already imported → image_url stored)
 * 2. For MBIDs not in DB, does a single Wikidata SPARQL query (P434=MBID, P18=image)
 * Returns { [mbid]: imageUrl | null }
 */
export async function getArtistImagesByMbids(
  mbids: string[]
): Promise<Record<string, string | null>> {
  if (!mbids.length) return {};
  const supabase = await createSupabaseServer();

  // 1. DB cache
  const { data } = await (supabase
    .from('artists')
    .select('mbid, image_url') as any)
    .in('mbid', mbids);

  const result: Record<string, string | null> = {};
  const cachedMbids = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.mbid) {
      result[row.mbid] = row.image_url || null;
      cachedMbids.add(row.mbid);
    }
  });

  // 2. Wikidata SPARQL for uncached MBIDs
  const uncached = mbids.filter((id) => !cachedMbids.has(id));
  if (uncached.length === 0) return result;

  try {
    const values = uncached.map((id) => `"${id}"`).join(' ');
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
      for (const binding of wdData.results?.bindings || []) {
        const mbid = binding.mbid?.value;
        const imageUrl = binding.image?.value;
        if (mbid && imageUrl && !result[mbid]) {
          // Wikidata returns Wikimedia Commons file URIs — usable directly as img src
          result[mbid] = `${imageUrl}?width=400`;
        }
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
 * - bio = null or ''  → not yet fetched → fetch and store
 * - bio = '_none'     → fetched but nothing found → don't re-fetch
 * - bio = 'actual text' → cached, return it
 */
export async function getOrFetchArtistMeta(
  artistId: string,
  mbid: string | null
): Promise<{ bio: string | null; imageUrl: string | null }> {
  const supabase = await createSupabaseServer();

  // Check DB first (cast to any — columns may not be in generated types yet)
  const { data: artist } = await (supabase
    .from('artists')
    .select('bio, image_url') as any)
    .eq('id', artistId)
    .maybeSingle();

  const row = artist as { bio?: string | null; image_url?: string | null } | null;

  // If bio is cached with actual content, return it
  if (row?.bio && row.bio !== NO_BIO_SENTINEL && row.bio !== '') {
    return {
      bio: row.bio,
      imageUrl: row.image_url || null,
    };
  }

  // If sentinel → we already tried, nothing found
  if (row?.bio === NO_BIO_SENTINEL) {
    return {
      bio: null,
      imageUrl: row.image_url || null,
    };
  }

  // No mbid → can't fetch from MB
  if (!mbid) {
    return { bio: null, imageUrl: row?.image_url || null };
  }

  // Fetch from external APIs
  const meta = await fetchArtistMetadata(mbid);

  // Store sentinel if nothing found, otherwise store the bio
  const bioToStore = meta.bio || NO_BIO_SENTINEL;
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

  // Store in DB for next time
  await (supabase
    .from('artists')
    .update({ bio: bioToStore, image_url: finalImage } as any) as any)
    .eq('id', artistId);

  return {
    bio: meta.bio || null,
    imageUrl: finalImage,
  };
}
