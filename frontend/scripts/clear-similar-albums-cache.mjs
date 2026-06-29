/**
 * Clears similar_albums_cache after fixing getSimilarAlbums (app/actions/metadata.ts)
 * to exclude same-artist albums from genre-overlap recommendations — albums
 * by a prolific same-genre artist (e.g. Bob Dylan) were dominating their own
 * "similar albums" section since nothing excluded same-artist candidates.
 * Pure derived/cached data — safe to clear, recomputes on next page view.
 *
 * Usage (from frontend/ directory):
 *   node --env-file=.env.local scripts/clear-similar-albums-cache.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { error, count } = await supabase
  .from('similar_albums_cache')
  .delete({ count: 'exact' })
  .not('album_id', 'is', null);

if (error) {
  console.error('✗ delete failed:', error.message);
  process.exit(1);
}
console.log(`✓ cleared ${count ?? 'all'} cached entries`);
