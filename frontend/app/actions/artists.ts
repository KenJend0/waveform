'use server';

import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { fetchArtistMetadata } from './musicbrainz';

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';

export type SimilarArtist = {
    id: string | null;   // null si pas dans notre DB
    name: string;
    imageUrl: string | null;
    mbid: string | null;
};

/**
 * Récupère les artistes similaires depuis Last.fm, puis tente de les matcher
 * avec les artistes de notre DB (par MBID ou par nom normalisé).
 * Retourne au max 6 artistes, ceux dans la DB en priorité.
 */
export async function getSimilarArtists(
    artistName: string,
    artistMbid: string | null,
): Promise<SimilarArtist[]> {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) return [];

    try {
        const params = new URLSearchParams({
            method: 'artist.getSimilar',
            api_key: apiKey,
            format: 'json',
            limit: '20',
            autocorrect: '1',
            ...(artistMbid ? { mbid: artistMbid } : { artist: artistName }),
        });

        const res = await fetch(`${LASTFM_API}/?${params}`, {
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return [];

        const data = await res.json();
        const similar: Array<{ name: string; mbid?: string }> =
            data?.similarartists?.artist ?? [];

        if (similar.length === 0) return [];

        const supabase = await createSupabaseServer();

        // Tenter de matcher par MBID d'abord
        const lfmMbids = similar.map(a => a.mbid).filter(Boolean) as string[];
        const lfmNames = similar.map(a => a.name.toLowerCase());

        const [mbidMatch, nameMatch] = await Promise.all([
            lfmMbids.length > 0
                ? supabase.from('artists').select('id, name, mbid, image_url').in('mbid', lfmMbids)
                : Promise.resolve({ data: [] }),
            supabase
                .from('artists')
                .select('id, name, mbid, image_url')
                .in('name', similar.map(a => a.name)),
        ]);

        const dbByMbid = new Map((mbidMatch.data ?? []).map(a => [a.mbid, a]));
        const dbByName = new Map((nameMatch.data ?? []).map(a => [a.name.toLowerCase(), a]));

        const results: SimilarArtist[] = similar.slice(0, 12).map(a => {
            const db = (a.mbid ? dbByMbid.get(a.mbid) : null) ?? dbByName.get(a.name.toLowerCase()) ?? null;
            return {
                id: db?.id ?? null,
                name: db?.name ?? a.name,
                imageUrl: (db as any)?.image_url ?? null,
                mbid: db?.mbid ?? a.mbid ?? null,
            };
        });

        // DB artists first, then others — max 6
        const inDb = results.filter(a => a.id !== null);
        const notInDb = results.filter(a => a.id === null);
        return [...inDb, ...notInDb].slice(0, 6);
    } catch {
        return [];
    }
}

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

      // Persist via admin client (bypasses RLS on artists table) — single upsert batch
      if (toSave.length > 0) {
        (supabaseAdmin
          .from('artists')
          .upsert(
            toSave.map(({ mbid, imageUrl }) => ({ mbid, image_url: imageUrl } as any)),
            { onConflict: 'mbid' }
          ) as any
        ).catch(() => {/* ignore write errors */});
      }
    }
  } catch {
    // Wikidata timeout or error — return what we have from DB
  }

  return result;
}

/**
 * Get artist image from DB cache, or fetch from MusicBrainz/Wikidata
 * and store in DB for future requests.
 *
 * All writes use supabaseAdmin to bypass RLS on the artists table.
 */
export async function getOrFetchArtistMeta(
  artistId: string,
  mbid: string | null
): Promise<{ imageUrl: string | null }> {
  const supabase = await createSupabaseServer();
  const supabaseAdmin = createSupabaseAdmin();

  // Check DB first
  const { data: artist } = await (supabase
    .from('artists')
    .select('image_url') as any)
    .eq('id', artistId)
    .maybeSingle();

  const row = artist as { image_url?: string | null } | null;

  // Image cached → return immediately
  if (row?.image_url) {
    return { imageUrl: row.image_url };
  }

  // No mbid → can't fetch from external APIs
  if (!mbid) {
    return { imageUrl: row?.image_url ?? null };
  }

  // Fetch from external APIs
  const meta = await fetchArtistMetadata(mbid);
  let finalImage = meta.imageUrl || null;

  // If no Wikidata image, fallback to first album cover
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
    .update({ image_url: finalImage } as any) as any)
    .eq('id', artistId);

  return { imageUrl: finalImage };
}
