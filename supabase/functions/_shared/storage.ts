// Miroir de apps/web/lib/storage.ts — upload de cover vers le bucket Supabase Storage "covers".
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'covers';
const USER_AGENT = 'Waveform/1.0 (https://waveformapp.online)';
const SUPABASE_STORAGE_HOST = 'supabase.co/storage';

/**
 * Télécharge imageUrl et l'upload dans le bucket "covers". Retourne l'URL CDN
 * publique, ou null en cas d'échec (l'import ne doit jamais être bloqué par ça).
 * Nom de fichier = MBID du release-group → ré-import idempotent (upsert: true).
 */
export async function uploadCoverToSupabase(
  imageUrl: string,
  albumMbid: string,
  supabaseAdmin: SupabaseClient
): Promise<string | null> {
  try {
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
  } catch (err) {
    console.warn('[storage] uploadCoverToSupabase error:', err instanceof Error ? err.message : err);
    return null;
  }
}
