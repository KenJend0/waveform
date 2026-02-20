"use server";

import { importAlbumFromMusicBrainz, previewArtistFromMusicBrainz } from './musicbrainz';
// Note: `@/lib/supabase/server` is server-only. Load it dynamically inside
// the server action to avoid TypeScript/Next import issues and to keep this
// module usable from Client Components.

/**
 * Import all missing albums for an artist from MusicBrainz
 *
 * Allows any authenticated user to trigger a bulk import, but enforces a
 * per-user rate limit (default 10 requests per 24 hours) stored in
 * `import_requests` (see `supabase_schema.sql`). The limit is configurable
 * via `IMPORTS_PER_DAY` environment variable.
 */
export async function importAllArtistAlbums(artistId: string, artistMbid: string) {
  try {
    // Dynamically import server-only helpers to avoid leaking server-only
    // modules into client bundles and to keep Next/TS happy.
    const { getAuthUser, createSupabaseServer } = await import('@/lib/supabase/server');

    const user = await getAuthUser();
    if (!user) return { success: false, error: 'not_authenticated' };

    const supabase = await createSupabaseServer();

    // Fetch existing albums for this artist in DB
    const { data: existingAlbums } = await supabase
      .from('albums')
      .select('title, mbid')
      .eq('artist_id', artistId);

    const existingTitles = new Set(
      existingAlbums?.map((a: any) => a.title.toLowerCase()) || []
    );
    const existingMbids = new Set(
      existingAlbums?.filter((a: any) => a.mbid).map((a: any) => a.mbid) || []
    );

    // Fetch all releases from MusicBrainz preview
    const result = await previewArtistFromMusicBrainz(artistMbid);
    if (!result.success || !result.preview) {
      return { success: false, error: 'Failed to fetch artist releases' };
    }

    const releases = result.preview.releases || [];

    // Filter out albums that are already imported (by title or MBID)
    const missingReleases = releases.filter((release: any) => {
      if (existingMbids.has(release.mbid)) return false;
      if (existingTitles.has(release.title.toLowerCase())) return false;
      return true;
    });

    if (missingReleases.length === 0) {
      return { success: true, imported: 0, message: 'All albums already imported' };
    }

    // Rate limit: default 10 imports per 24h (configurable)
    const perDay = parseInt(process.env.IMPORTS_PER_DAY || '10', 10) || 10;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('import_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', cutoff);

    if ((count || 0) >= perDay) {
      // Calculate next reset (hours remaining)
      const oldestWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // We don't fetch the exact timestamps here; provide a friendly message
      return {
        success: false,
        error: 'rate_limited',
        limit: perDay,
        remaining: 0,
        message: `Vous avez atteint la limite d'import (${perDay} demandes / 24h). Réessayez plus tard.`,
      };
    }

    // Record the import request (this counts as one usage)
    const { error: insertReqError } = await supabase.from('import_requests').insert({ user_id: user.id, artist_id: artistId, artist_mbid: artistMbid });
    if (insertReqError) {
      return { success: false, error: 'failed_to_record_request' };
    }

    const used = (count || 0) + 1;
    const remaining = Math.max(0, perDay - used);

    // Import each missing release sequentially (keeps MusicBrainz friendly)
    let imported = 0;
    const errors: string[] = [];

    for (const release of missingReleases) {
      try {
        const importResult = await importAlbumFromMusicBrainz(release.mbid);
        if (importResult.success && (importResult as any).albumId) imported++;
        // Small delay to avoid rate limiting upstream
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        errors.push(`${release.title}: ${String(err)}`);
      }
    }

    return {
      success: true,
      imported,
      total: missingReleases.length,
      errors: errors.length > 0 ? errors : undefined,
      quota: { limit: perDay, used, remaining },
      message: remaining > 0 ? `Import lancé — il vous reste ${remaining} import(s) aujourd'hui.` : `Import lancé — vous avez atteint la limite quotidienne (${perDay}).`,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
