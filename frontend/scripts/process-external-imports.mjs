/**
 * Reprise serveur des imports historiques Last.fm/RYM (external_imports).
 *
 * Les imports sont normalement traités par polling côté client (/settings —
 * `processImportBatch` server action) tant que l'onglet reste ouvert. Si
 * l'utilisateur quitte l'app avant la fin (cas fréquent quand il y a beaucoup
 * d'albums à traiter), la ligne reste bloquée en `matching` indéfiniment —
 * ce script reprend ces imports "stale" en arrière-plan, indépendamment du
 * navigateur.
 *
 * Réimplémente volontairement (pas d'import des Server Actions Next.js) la
 * logique de résolution/import d'album : les Server Actions dépendent de
 * `getAuthUser()`/`cookies()`, indisponibles hors contexte de requête HTTP —
 * même convention que `enrich-missing.mjs` dans ce repo.
 *
 * Usage:
 *   node --env-file=.env.local scripts/process-external-imports.mjs
 *   node --env-file=.env.local scripts/process-external-imports.mjs --dry-run
 *   node --env-file=.env.local scripts/process-external-imports.mjs --limit 5
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { looseNormalize, isArtistMatch, searchReleaseGroupCascade, pickCandidate } from '../lib/musicbrainzMatch.mjs';
import { enrichOneAlbum } from '../lib/albumEnrichment.mjs';
import { canonicalAlbumKey } from '../lib/albumCanonical.mjs';
import { canonicalTrackTitle } from '../lib/trackCanonical.mjs';

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_UA = 'Waveform/1.0 (https://waveformapp.online)';
const CAA_URL = 'https://coverartarchive.org/release-group';
const DELAY_MS = 1250; // safely above MB's 1 req/s limit
const STALE_MINUTES = 3;

const DRY_RUN = process.argv.includes('--dry-run');
const DEBUG = process.argv.includes('--debug');
const limitArg = process.argv.indexOf('--limit');
const MAX_IMPORTS = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 20;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function mbFetch(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': MB_UA }, signal: AbortSignal.timeout(10_000) });
    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await delay((attempt + 2) * 2000);
      return mbFetch(url, attempt + 1);
    }
    return res;
  } catch (err) {
    if (attempt < 2) { await delay(2000); return mbFetch(url, attempt + 1); }
    throw err;
  }
}

// ── Matching local ───────────────────────────────────────────────────────────────

function escapeILike(str) {
  return str.replace(/[%_]/g, '\\$&');
}

async function findLocalAlbumId(item) {
  const { data } = await supabase
    .from('albums')
    .select('id, title, artists(name)')
    .ilike('title', `%${escapeILike(item.album)}%`)
    .limit(20);

  if (!data) return null;
  const match = data.find(
    (a) => looseNormalize(a.title) === looseNormalize(item.album) && isArtistMatch(a.artists?.name || '', item.artist)
  );
  return match?.id || null;
}

async function runReleaseGroupQuery(query) {
  if (!query) return [];
  const url = `${MB_API}/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
  const res = await mbFetch(url);
  if (DEBUG) console.log(`    [debug] query="${query}" → HTTP ${res.status}`);
  if (!res.ok) return [];
  const data = await res.json();
  const results = (data['release-groups'] || []).map((rg) => ({
    id: rg.id,
    title: rg.title,
    artistName: rg['artist-credit']?.[0]?.name || rg['artist-credit']?.[0]?.artist?.name || '',
    score: parseInt(rg.score, 10) || 0,
  }));
  if (DEBUG) console.log(`    [debug] ${results.length} résultat(s): ${results.map((r) => `${r.title} — ${r.artistName} (${r.score})`).join(' | ')}`);
  return results;
}

async function resolveMbid(item) {
  if (item.mbid) return item.mbid;

  for (let attempt = 0; attempt < 3; attempt++) {
    const results = await searchReleaseGroupCascade(runReleaseGroupQuery, item.artist, item.album, { delayMs: DELAY_MS });
    if (results.length === 0) continue;

    const candidate = pickCandidate(results, item);
    return candidate?.id || null; // résultats présents mais aucun candidat fiable — pas la peine de retenter
  }
  return null;
}

// ── Import d'album (port minimal de importAlbumFromMusicBrainz) ───────────────

async function fetchReleasePreview(mbid) {
  let releaseRes = await mbFetch(
    `${MB_API}/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+release-groups&fmt=json`
  );

  let rgPrimaryType = null;
  if (releaseRes.status === 404) {
    const rgRes = await mbFetch(`${MB_API}/release-group/${encodeURIComponent(mbid)}?inc=releases&fmt=json`);
    if (!rgRes.ok) return null;
    const rgData = await rgRes.json();
    rgPrimaryType = rgData['primary-type'] || null;
    const releases = rgData.releases ?? [];
    if (releases.length === 0) return null;
    const officialRelease = releases.find((r) => r.status === 'Official') ?? releases[0];
    releaseRes = await mbFetch(
      `${MB_API}/release/${encodeURIComponent(officialRelease.id)}?inc=artist-credits+recordings+release-groups&fmt=json`
    );
  }

  if (!releaseRes.ok) return null;
  const data = await releaseRes.json();

  const artistCredit = data['artist-credit']?.[0];
  const artist = artistCredit?.artist || { id: null, name: 'Unknown' };
  // MUST fail explicitly if MB doesn't give us a release-group — falling back to `mbid`
  // here would silently store a release MBID as if it were a release-group MBID, the
  // same defect found (and fixed) in app/actions/musicbrainz.ts's previewAlbumFromMusicBrainz.
  const releaseGroupId = data['release-group']?.id;
  if (!releaseGroupId) {
    console.warn(`  ⚠ release ${data.id} has no release-group on MusicBrainz — skipping`);
    return null;
  }
  const primaryType = rgPrimaryType || data['release-group']?.['primary-type'] || null;

  const tracks = (data.media || []).flatMap((m) =>
    (m.tracks || []).map((t) => ({
      mbid: t.id,
      title: t.title,
      position: t.position,
      discNo: m.position ?? 1,
      duration: t.length ?? t['track_or_recording_length'] ?? t.recording?.length ?? null,
    }))
  );

  return {
    releaseGroupMbid: releaseGroupId,
    primaryType,
    title: data.title,
    artist: artist.name,
    artistMbid: artist.id,
    date: data.date || null,
    tracks,
  };
}

function normalizeReleaseDate(date) {
  if (!date) return null;
  const trimmed = date.trim();
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

async function uploadCover(rgMbid) {
  try {
    const res = await fetch(`${CAA_URL}/${rgMbid}/front`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `${rgMbid}.jpg`;
    const { error } = await supabase.storage.from('covers').upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) return null;
    const { data } = supabase.storage.from('covers').getPublicUrl(filename);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Idempotent par mbid (release-group). Retourne l'albumId local. */
async function importAlbum(mbid) {
  const preview = await fetchReleasePreview(mbid);
  if (!preview) return null;

  const canonicalMbid = preview.releaseGroupMbid || mbid;

  const { data: existingAlbum } = await supabase.from('albums').select('id').eq('mbid', canonicalMbid).maybeSingle();
  if (existingAlbum) return existingAlbum.id;

  // Dry-run : ne crée rien, mais le match MusicBrainz a réussi — sentinel distinct
  // de `null` (qui signifie "aucun candidat trouvé") pour ne pas compter ce cas en échec.
  if (DRY_RUN) return 'WOULD_IMPORT';

  let artistId;
  const { data: existingArtist } = await supabase
    .from('artists')
    .select('id')
    .eq('mbid', preview.artistMbid)
    .maybeSingle();

  if (existingArtist) {
    artistId = existingArtist.id;
  } else {
    const { data: newArtist, error: artistError } = await supabase
      .from('artists')
      .insert({ name: preview.artist, mbid: preview.artistMbid })
      .select('id')
      .single();
    if (artistError) return null;
    artistId = newArtist.id;
  }

  // Canonical-title duplicate check — mirroir du même check dans
  // importAlbumFromMusicBrainz (app/actions/musicbrainz.ts). Sans lui, ce worker
  // recréait un album séparé (sans canonical_key) pour toute réédition/remaster
  // dont le titre brut Last.fm/RYM ("Title (Deluxe Edition)") matchait un
  // release-group MusicBrainz différent de celui déjà en base.
  const canonicalKey = canonicalAlbumKey(preview.title, preview.artist);
  const { data: canonicalMatch } = await supabase
    .from('albums')
    .select('id')
    .eq('artist_id', artistId)
    .eq('canonical_key', canonicalKey)
    .limit(1)
    .maybeSingle();
  if (canonicalMatch) return canonicalMatch.id;

  const coverUrl = await uploadCover(canonicalMbid);

  const { data: newAlbum, error: albumError } = await supabase
    .from('albums')
    .insert({
      title: preview.title,
      artist_id: artistId,
      mbid: canonicalMbid,
      release_date: normalizeReleaseDate(preview.date),
      cover_url: coverUrl,
      type: preview.primaryType ?? 'Album',
      canonical_key: canonicalKey,
    })
    .select('id')
    .single();
  if (albumError) return null;

  if (preview.tracks.length > 0) {
    const trackRows = preview.tracks.map((t) => ({
      album_id: newAlbum.id,
      artist_id: artistId,
      title: t.title,
      track_no: t.position,
      disc_no: t.discNo,
      duration_ms: t.duration,
      mbid: t.mbid,
      canonical_title: canonicalTrackTitle(t.title),
    }));
    await supabase.from('tracks').insert(trackRows);
  }

  await supabase.from('external_ids').insert({
    entity_type: 'album',
    entity_id: newAlbum.id,
    source: 'musicbrainz',
    value: mbid,
  });

  // Enrichit immédiatement (genres + bio + streaming) au lieu d'attendre le cron
  // nocturne — sinon un gros import (RYM/Last.fm) reste sans métadonnées jusqu'à
  // 3h du matin. Best-effort : un échec ici ne doit jamais faire échouer l'import.
  await delay(DELAY_MS);
  const enrichResult = await enrichOneAlbum(supabase, {
    id: newAlbum.id,
    mbid: canonicalMbid,
    title: preview.title,
    artistName: preview.artist,
  }).catch((err) => ({ ok: false, error: err.message }));
  if (enrichResult.ok) {
    console.log(`    ↳ enrichi à la volée (${enrichResult.genreCount} genre(s))`);
  } else {
    console.log(`    ↳ enrichissement à la volée échoué (${enrichResult.error}) — repris par le cron nocturne`);
  }

  return newAlbum.id;
}

async function resolveAlbumId(item) {
  const localId = await findLocalAlbumId(item);
  if (localId) return localId;

  const mbid = await resolveMbid(item);
  if (!mbid) return null;

  return importAlbum(mbid);
}

// ── Traitement d'une ligne external_imports ─────────────────────────────────────

async function processRow(row) {
  const items = row.raw_items || [];
  let matched = row.matched_count;
  let skipped = row.skipped_count ?? 0;
  let failed = row.failed_count;

  console.log(`\n→ Import ${row.id} (${row.source}, ${row.source_label}) — ${items.length - row.processed_count} item(s) restant(s)`);

  for (let i = row.processed_count; i < items.length; i++) {
    const item = items[i];
    try {
      const albumId = await resolveAlbumId(item);

      if (!albumId) {
        failed++;
        console.log(`  ✗ ${item.artist} — ${item.album} (non trouvé)`);
      } else if (DRY_RUN) {
        matched++;
        console.log(`  ✓ [dry-run] ${item.artist} — ${item.album}`);
      } else if (row.source === 'lastfm') {
        const [{ data: existingItem }, { data: alreadyDiaried }] = await Promise.all([
          supabase.from('list_items').select('id').eq('list_id', row.list_id).eq('album_id', albumId).maybeSingle(),
          supabase.from('diary_entries').select('id').eq('user_id', row.user_id).eq('album_id', albumId).maybeSingle(),
        ]);
        if (alreadyDiaried) {
          skipped++; // déjà noté dans le journal — pas besoin de l'ajouter à la liste de triage
          console.log(`  ↷ ${item.artist} — ${item.album} (déjà dans le journal)`);
        } else {
          if (!existingItem) await supabase.from('list_items').insert({ list_id: row.list_id, album_id: albumId });
          matched++;
          console.log(`  ✓ ${item.artist} — ${item.album}`);
        }
      } else {
        const { data: alreadyDiaried } = await supabase
          .from('diary_entries')
          .select('id')
          .eq('user_id', row.user_id)
          .eq('album_id', albumId)
          .maybeSingle();
        if (alreadyDiaried) {
          skipped++; // déjà une note dans le journal — on ne l'écrase pas avec celle de l'import
          console.log(`  ↷ ${item.artist} — ${item.album} (déjà dans le journal)`);
        } else {
          await supabase.from('diary_entries').insert({
            user_id: row.user_id,
            album_id: albumId,
            listened_at: item.listenedAt || new Date().toISOString().slice(0, 10),
            rating: item.rating ?? null,
            review_title: item.reviewTitle || null,
            review_body: item.reviewBody || null,
            is_public: true,
          });
          matched++;
          console.log(`  ✓ ${item.artist} — ${item.album}`);
        }
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${item.artist} — ${item.album} (erreur: ${err.message})`);
    }

    if (!DRY_RUN) {
      const { error: progressError } = await supabase
        .from('external_imports')
        .update({
          processed_count: i + 1,
          matched_count: matched,
          skipped_count: skipped,
          failed_count: failed,
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (progressError) console.error(`  ⚠ Échec de la mise à jour de progression (item ${i + 1}): ${progressError.message}`);
    }

    await delay(DELAY_MS);
  }

  if (!DRY_RUN) {
    const { error: doneError } = await supabase
      .from('external_imports')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', row.id);
    if (doneError) console.error(`  ⚠ Échec du passage au statut "done": ${doneError.message}`);
  }

  console.log(`  Terminé — ${matched} ajouté(s), ${skipped} déjà présent(s), ${failed} échoué(s).`);
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis.');
    process.exit(1);
  }

  console.log('🎵 Waveform — Reprise des imports externes (Last.fm/RYM)');
  if (DRY_RUN) console.log('   Mode dry-run activé — aucune écriture en BDD.');
  console.log('');

  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from('external_imports')
    .select('*')
    .in('status', ['pending', 'matching'])
    .or(`last_processed_at.is.null,last_processed_at.lt.${staleCutoff}`)
    .order('created_at', { ascending: true })
    .limit(MAX_IMPORTS);

  if (error) {
    console.error('❌  Erreur de lecture:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('Rien à traiter — aucun import stale.');
    return;
  }

  console.log(`${rows.length} import(s) stale à traiter.`);

  for (const row of rows) {
    // Verrou optimiste : même mécanisme que processImportBatch côté app — si un poller
    // client (onglet rouvert juste à ce moment) a déjà touché la ligne entre notre lecture
    // et maintenant, on laisse tomber cette ligne plutôt que de la traiter en double.
    if (!DRY_RUN) {
      let claimQuery = supabase
        .from('external_imports')
        .update({ last_processed_at: new Date().toISOString() })
        .eq('id', row.id);
      claimQuery = row.last_processed_at
        ? claimQuery.eq('last_processed_at', row.last_processed_at)
        : claimQuery.is('last_processed_at', null);
      const { data: claimed, error: claimError } = await claimQuery.select('id');

      if (claimError) {
        console.error(`\n→ Import ${row.id} — échec du verrou de reprise: ${claimError.message}`);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        console.log(`\n→ Import ${row.id} déjà repris ailleurs entre-temps — ignoré.`);
        continue;
      }
    }
    await processRow(row);
  }

  console.log('\n✅  Reprise terminée.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
