// Supabase Edge Function: toggle-like
//
// Bascule un like (diary_entries ou track_diary_entries) et fait le fanout dans
// feed_events — miroir server-side de toggleDiaryLike/toggleTrackDiaryLike (apps/web/app/actions/diary.ts
// et track-diary.ts), pour que le mobile bénéficie du même fanout que le web sans embarquer
// la clé service_role côté client.
//
// Déploiement : supabase functions deploy toggle-like
// Requiert les secrets par défaut fournis par la plateforme (SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY) — pas de config manuelle nécessaire.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Kind = 'diary' | 'track';

type Body = {
  kind: Kind;
  entryId: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  // Client user-level (respecte la RLS) — pour lire/écrire les tables de like et vérifier
  // les droits (visibilité de l'entrée, blocages) avec l'identité réelle de l'appelant.
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

  const { kind, entryId } = body;
  if (kind !== 'diary' && kind !== 'track') return json({ error: 'Invalid kind' }, 400);
  if (!entryId) return json({ error: 'Missing entryId' }, 400);

  // Client service_role — uniquement pour le fanout feed_events (table système append-only,
  // écrite pour le compte d'autres utilisateurs que l'acteur). Jamais exposé au client.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const entryTable = kind === 'diary' ? 'diary_entries' : 'track_diary_entries';
  const likeTable = kind === 'diary' ? 'diary_likes' : 'track_diary_likes';
  const feedType = kind === 'diary' ? 'like' : 'track_like';

  const { data: entry, error: entryError } = await supabaseUser
    .from(entryTable)
    .select('user_id, is_public')
    .eq('id', entryId)
    .maybeSingle();

  if (entryError || !entry) return json({ error: 'Entry not found' }, 404);
  if (!entry.is_public && entry.user_id !== user.id) return json({ error: 'Entry not found' }, 404);

  if (entry.user_id !== user.id) {
    const { data: block } = await supabaseUser
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', entry.user_id)
      .maybeSingle();
    if (block) return json({ error: 'Action impossible' }, 403);
  }

  const { data: existing } = await supabaseUser
    .from(likeTable)
    .select('user_id')
    .eq('entry_id', entryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error: deleteError } = await supabaseUser
      .from(likeTable)
      .delete()
      .eq('entry_id', entryId)
      .eq('user_id', user.id);
    if (deleteError) return json({ error: 'An error occurred' }, 500);

    if (kind === 'diary') {
      await supabaseAdmin.from('feed_events').delete().eq('type', feedType).eq('actor_id', user.id).eq('entry_id', entryId);
    } else {
      await supabaseAdmin
        .from('feed_events')
        .delete()
        .eq('type', feedType)
        .eq('actor_id', user.id)
        .eq('payload->>trackEntryId', entryId);
    }

    return json({ liked: false });
  }

  const { error: insertError } = await supabaseUser.from(likeTable).insert({ entry_id: entryId, user_id: user.id });
  if (insertError) return json({ error: 'An error occurred' }, 500);

  // Purge d'éventuels doublons avant le fanout (idempotence en cas de double-tap concurrent).
  if (kind === 'diary') {
    await supabaseAdmin.from('feed_events').delete().eq('type', feedType).eq('actor_id', user.id).eq('entry_id', entryId);
  } else {
    await supabaseAdmin
      .from('feed_events')
      .delete()
      .eq('type', feedType)
      .eq('actor_id', user.id)
      .eq('payload->>trackEntryId', entryId);
  }

  try {
    const { data: actorFollowers } = await supabaseUser.from('follows').select('follower_id').eq('followee_id', user.id);
    const targetSet = new Set<string>([entry.user_id]);
    (actorFollowers ?? []).forEach((f: { follower_id: string }) => targetSet.add(f.follower_id));
    targetSet.delete(user.id);
    targetSet.add(user.id); // l'acteur voit aussi l'événement dans son propre feed

    const recipientIds = [...targetSet].slice(0, 5000);

    let payload: Record<string, unknown> = { userId: user.id, entryId };

    if (kind === 'track') {
      const { data: trackEntry } = await supabaseUser
        .from('track_diary_entries')
        .select('user_id, track_id, album_id, tracks(title, albums(id, title, cover_url))')
        .eq('id', entryId)
        .maybeSingle();
      const track = (trackEntry as any)?.tracks;
      const album = track?.albums;
      payload = {
        userId: user.id,
        trackEntryId: entryId,
        trackId: (trackEntry as any)?.track_id ?? null,
        trackTitle: track?.title || '',
        albumId: (trackEntry as any)?.album_id ?? null,
        albumTitle: album?.title || '',
        coverUrl: album?.cover_url || null,
        entryOwnerId: entry.user_id,
      };
    }

    const events = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      actor_id: user.id,
      type: feedType,
      entry_id: kind === 'diary' ? entryId : null,
      payload,
    }));

    const { error: fanoutError } = await supabaseAdmin.from('feed_events').insert(events);
    if (fanoutError) console.error('toggle-like fanout error:', fanoutError.message);
  } catch (fanoutErr) {
    console.error('toggle-like fanout exception:', fanoutErr);
    // Le like reste acquis même si le fanout échoue.
  }

  return json({ liked: true });
});
