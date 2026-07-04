// Supabase Edge Function: similar-artists
//
// Miroir server-side de getSimilarArtists (apps/web/app/actions/artists.ts) — appelle
// Last.fm artist.getSimilar (clé API secrète, jamais exposable côté client) puis tente de
// matcher chaque résultat avec un artiste déjà en DB (par MBID ou nom normalisé). Permet à
// la section "Artistes similaires" de la page artiste mobile (6.5) de fonctionner sans
// embarquer LASTFM_API_KEY dans l'app.
//
// Déploiement : supabase functions deploy similar-artists
// Secret requis : LASTFM_API_KEY (déjà configuré pour enrich-album, cf. son en-tête).
// Sans le secret, retourne simplement une liste vide (jamais bloquant).
//
// Body attendu (JSON) : { artistName: string, artistMbid: string | null }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { arrayValue, logInvalidExternalResponse, recordValue, stringValue } from '../_shared/externalValidation.ts';

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0';

type Body = { artistName: string; artistMbid: string | null };

type SimilarArtist = {
  id: string | null; // null si pas dans notre DB
  name: string;
  imageUrl: string | null;
  mbid: string | null;
};

function parseLastfmSimilarArtists(raw: unknown): Array<{ name: string; mbid: string | null }> {
  const similarArtists = recordValue(recordValue(raw)?.similarartists);
  if (!similarArtists) {
    logInvalidExternalResponse('lastfm.similarartists', 'missing similarartists');
    return [];
  }

  return arrayValue(similarArtists.artist).flatMap((item) => {
    const artist = recordValue(item);
    const name = stringValue(artist?.name)?.trim() ?? '';
    if (!name) return [];
    return [{ name, mbid: stringValue(artist?.mbid)?.trim() || null }];
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  if (!body.artistName) return json({ error: 'Missing artistName' }, 400);

  const apiKey = Deno.env.get('LASTFM_API_KEY');
  if (!apiKey) return json({ artists: [] as SimilarArtist[] });

  try {
    const params = new URLSearchParams({
      method: 'artist.getSimilar',
      api_key: apiKey,
      format: 'json',
      limit: '20',
      autocorrect: '1',
      ...(body.artistMbid ? { mbid: body.artistMbid } : { artist: body.artistName }),
    });

    const res = await fetch(`${LASTFM_API}/?${params}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return json({ artists: [] as SimilarArtist[] });

    const raw: unknown = await res.json();
    const similar = parseLastfmSimilarArtists(raw);
    if (similar.length === 0) return json({ artists: [] as SimilarArtist[] });

    // Tenter de matcher par MBID d'abord, puis par nom normalisé.
    const lfmMbids = similar.flatMap((a) => (a.mbid ? [a.mbid] : []));

    const [mbidMatch, nameMatch] = await Promise.all([
      lfmMbids.length > 0
        ? supabaseUser.from('artists').select('id, name, mbid, image_url').in('mbid', lfmMbids)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; mbid: string | null; image_url: string | null }> }),
      supabaseUser
        .from('artists')
        .select('id, name, mbid, image_url')
        .in('name', similar.map((a) => a.name)),
    ]);

    const dbByMbid = new Map((mbidMatch.data ?? []).map((a) => [a.mbid, a]));
    const dbByName = new Map((nameMatch.data ?? []).map((a) => [a.name.toLowerCase(), a]));

    const results: SimilarArtist[] = similar.slice(0, 12).map((a) => {
      const db = (a.mbid ? dbByMbid.get(a.mbid) : null) ?? dbByName.get(a.name.toLowerCase()) ?? null;
      return {
        id: db?.id ?? null,
        name: db?.name ?? a.name,
        imageUrl: db?.image_url ?? null,
        mbid: db?.mbid ?? a.mbid ?? null,
      };
    });

    // Artistes déjà en DB en priorité — max 6.
    const inDb = results.filter((a) => a.id !== null);
    const notInDb = results.filter((a) => a.id === null);
    return json({ artists: [...inDb, ...notInDb].slice(0, 6) });
  } catch {
    return json({ artists: [] as SimilarArtist[] });
  }
});
