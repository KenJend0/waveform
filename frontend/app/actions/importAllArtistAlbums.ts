'use server';

import { importAlbumFromMusicBrainz, previewArtistFromMusicBrainz } from './musicbrainz';
import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * Import all missing albums for an artist from MusicBrainz
 */
export async function importAllArtistAlbums(artistId: string, artistMbid: string) {
  try {
    const supabase = await createSupabaseServer();

    // Get existing albums for this artist
    const { data: existingAlbums } = await supabase
      .from('albums')
      .select('title, mbid')
      .eq('artist_id', artistId);

    const existingTitles = new Set(
      existingAlbums?.map(a => a.title.toLowerCase()) || []
    );
    const existingMbids = new Set(
      existingAlbums?.filter(a => a.mbid).map(a => a.mbid!) || []
    );

    // Fetch all releases from MusicBrainz
    const result = await previewArtistFromMusicBrainz(artistMbid);
    if (!result.success || !result.preview) {
      return { success: false, error: 'Failed to fetch artist releases' };
    }

    const releases = result.preview.releases || [];
    
    // Filter out albums that are already imported (by title or MBID)
    const missingReleases = releases.filter(release => {
      if (existingMbids.has(release.mbid)) return false;
      if (existingTitles.has(release.title.toLowerCase())) return false;
      return true;
    });

    if (missingReleases.length === 0) {
      return { success: true, imported: 0, message: 'All albums already imported' };
    }

    // Import each missing release
    let imported = 0;
    const errors: string[] = [];

    for (const release of missingReleases) {
      try {
        const importResult = await importAlbumFromMusicBrainz(release.mbid);
        if (importResult.success) {
          // Check if albumId is present (means it was newly imported or already existed)
          if ('albumId' in importResult && importResult.albumId) {
            imported++;
          }
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        errors.push(`${release.title}: ${err}`);
      }
    }

    return {
      success: true,
      imported,
      total: missingReleases.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
