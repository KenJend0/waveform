// Supabase Edge Function: enrich-album
//
// Invocable indépendamment de import-musicbrainz (ex: bouton "rafraîchir les métadonnées"
// sur la page album, ou un futur EnrichmentPoller mobile) — reprend enrichAlbumMetadata
// (voir _shared/metadataEnrich.ts) : liens streaming + genres/tags + description. Le pipeline
// complet est déclenché automatiquement après chaque import par import-musicbrainz ; cette
// fonction sert au ré-enrichissement manuel/à la demande (ex: force=true pour bypasser le TTL
// de 30 jours).
//
// Déploiement : supabase functions deploy enrich-album
// Secrets requis (en plus des secrets par défaut SUPABASE_URL/SUPABASE_ANON_KEY/
// SUPABASE_SERVICE_ROLE_KEY) :
//   supabase secrets set SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... LASTFM_API_KEY=...
// Sans ces secrets, l'enrichissement tourne en dégradé (pas de liens Spotify, pas de tags/bio
// Last.fm) — jamais bloquant.
//
// Body attendu (JSON) : { albumId: string, mbid: string, title: string, artist: string, force?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { enrichAlbumMetadata } from '../_shared/metadataEnrich.ts';

type Body = { albumId: string; mbid: string; title: string; artist: string; force?: boolean };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Vérifie juste que l'appelant est authentifié — l'enrichissement lui-même écrit
  // en service_role (mêmes tables système que le web : album_metadata, genres, album_genres).
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

  if (!body.albumId || !body.mbid || !body.title || !body.artist) {
    return json({ error: 'Missing albumId, mbid, title or artist' }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const result = await enrichAlbumMetadata(supabaseAdmin, body.albumId, body.mbid, body.title, body.artist, body.force ?? false);

  return json(result);
});
