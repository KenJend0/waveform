import 'server-only';
import { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'covers';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
// URLs already in Supabase Storage — skip re-upload
const SUPABASE_STORAGE_HOST = 'supabase.co/storage';

/**
 * Download an image from imageUrl and upload it to the `covers` Supabase Storage bucket.
 * Returns the public CDN URL, or null if anything fails (import must not be blocked).
 *
 * Uses the album release-group MBID as filename so re-importing the same album
 * is idempotent (upsert: true).
 */
export async function uploadCoverToSupabase(
  imageUrl: string,
  albumMbid: string,
  supabaseAdmin: SupabaseClient,
): Promise<string | null> {
  try {
    // Already in Supabase Storage — nothing to do
    if (imageUrl.includes(SUPABASE_STORAGE_HOST)) return imageUrl;

    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const filename = `${albumMbid}.jpg`;

    const buffer = await response.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType, upsert: true });

    if (error) {
      console.warn('[storage] upload failed:', error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  } catch (err: any) {
    console.warn('[storage] uploadCoverToSupabase error:', err?.message ?? err);
    return null;
  }
}
