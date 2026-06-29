import { normalize, stripArticle } from './textNormalize.mjs';

/**
 * Canonical title for "is this the same song", scoped per-artist (the caller
 * always filters by artist_id alongside this key — no need to fold the
 * artist name into the string itself).
 *
 * Unlike canonicalAlbumKey, this does NOT strip version markers like "(Live)"
 * or "(Acoustic)" — those genuinely are different recordings/performances a
 * user may want to rate separately. It only normalizes case/accents/
 * punctuation/articles, the same way two containers (Album vs EP vs Single)
 * spell the exact same song title slightly differently.
 */
export function canonicalTrackTitle(title) {
  const result = stripArticle(normalize(title));
  // A title made entirely of punctuation/symbols ("...", "♥") normalizes to
  // empty — fall back to the raw lowercased title so two different tracks
  // sharing such a title don't collide on the same (empty) key.
  return result || title.toLowerCase().trim();
}
