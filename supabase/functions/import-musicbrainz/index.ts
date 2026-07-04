// Supabase Edge Function: import-musicbrainz
//
// Miroir server-side de importAlbumFromMusicBrainz / importArtistFromMusicBrainz /
// importTrackFromMusicBrainz (apps/web/app/actions/musicbrainz.ts), pour que le mobile
// puisse importer EXACTEMENT comme le web sans Server Action ni clé service_role côté
// client. Le déclencheur mobile (SearchOverlay) appelle cette fonction au clic sur un
// résultat MusicBrainz non encore en DB, et navigue directement vers la page créée
// (redirectUrl) — même flux qu'en web : le clic déclenche l'import ET la redirection,
// il n'y a pas d'étape de "preview" visible côté utilisateur.
//
// Déploiement : supabase functions deploy import-musicbrainz
// Secrets requis : aucun en plus des secrets par défaut (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY) — l'enrichissement post-import (voir enrich-album) a besoin
// de SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / LASTFM_API_KEY, à configurer séparément.
//
// Body attendu (JSON) :
//   { kind: 'album', mbid: string }
//   { kind: 'artist', mbid: string, name: string }
//   { kind: 'track', recordingMbid: string, releaseId: string, trackTitle?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import {
  importAlbumFromMusicBrainz,
  importArtistFromMusicBrainz,
  importTrackFromMusicBrainz,
} from '../_shared/musicbrainzImport.ts';
import { enrichAlbumMetadata } from '../_shared/metadataEnrich.ts';

type Body =
  | { kind: 'album'; mbid: string }
  | { kind: 'artist'; mbid: string; name: string }
  | { kind: 'track'; recordingMbid: string; releaseId: string; trackTitle?: string };

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  // Client user-level (respecte la RLS) — reflète createSupabaseServer() côté web.
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  // Client service_role — upload cover, featured artists, enrichissement. Mêmes usages
  // que createSupabaseAdmin() côté web, jamais exposé au client.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  if (body.kind === 'album') {
    if (!body.mbid) return json({ error: 'Missing mbid' }, 400);

    const result = await importAlbumFromMusicBrainz(supabaseUser, supabaseAdmin, body.mbid);

    // Enrichissement (liens streaming + tags/genres + description) en tâche de fond —
    // ne bloque pas la réponse, comme after() côté web mais avec le pipeline complet
    // (voir _shared/metadataEnrich.ts pour la différence assumée avec le web).
    if (result.success && 'albumId' in result && result.albumId && 'mbid' in result && result.mbid) {
      const albumId = result.albumId;
      const mbid = result.mbid;
      const title = 'title' in result ? result.title : undefined;
      const artist = 'artist' in result ? result.artist : undefined;
      if (title && artist) {
        EdgeRuntime.waitUntil(
          enrichAlbumMetadata(supabaseAdmin, albumId, mbid, title, artist).catch((err) => {
            console.error('[import-musicbrainz] enrichAlbumMetadata failed:', err);
          })
        );
      }
    }

    return json(result, result.success ? 200 : 400);
  }

  if (body.kind === 'artist') {
    if (!body.mbid || !body.name) return json({ error: 'Missing mbid or name' }, 400);
    const result = await importArtistFromMusicBrainz(supabaseUser, body.mbid, body.name);
    return json(result, result.success ? 200 : 400);
  }

  if (body.kind === 'track') {
    if (!body.recordingMbid || !body.releaseId) return json({ error: 'Missing recordingMbid or releaseId' }, 400);
    const result = await importTrackFromMusicBrainz(
      supabaseUser,
      supabaseAdmin,
      body.recordingMbid,
      body.releaseId,
      body.trackTitle
    );
    return json(result, result.success ? 200 : 400);
  }

  return json({ error: 'Invalid kind' }, 400);
});
