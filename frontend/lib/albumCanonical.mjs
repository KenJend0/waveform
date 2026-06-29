import { normalize, stripArticle } from "./textNormalize.mjs";

// Edition/repackage suffixes that should be ignored when deciding whether two
// MusicBrainz release-groups represent "the same album" (e.g. "Title" vs
// "Title (Deluxe Edition)" vs "Title - Remastered" are the same work for our
// purposes, even though MB models them as distinct release-groups).
const EDITION_KEYWORDS = [
  "super deluxe( edition)?",
  "deluxe( edition)?",
  "remaster(ed)?( version)?",
  "\\d{4}\\s*remaster(ed)?",
  "\\d+(st|nd|rd|th)\\s*anniversary( edition)?",
  "anniversary( edition)?",
  "expanded( edition)?",
  "extended( edition)?",
  "bonus track(s)?( version)?",
  "special edition",
  "collector'?s? edition",
  "legacy edition",
  "mono( version)?",
  "stereo( version)?",
  "reissue",
].join("|");

const BRACKETED_SUFFIX_RE = new RegExp(`\\s*[(\\[][^()\\[\\]]*(?:${EDITION_KEYWORDS})[^()\\[\\]]*[)\\]]\\s*$`, "i");
const DASH_SUFFIX_RE = new RegExp(`\\s*[-–:]\\s*(?:${EDITION_KEYWORDS})\\s*$`, "i");

/** Strips known edition/repackage suffixes from an album title, repeatedly
 *  (handles stacked suffixes like "Title (Deluxe) (Remastered)"). */
export function stripEditionSuffix(title) {
  let t = title;
  let prev;
  do {
    prev = t;
    t = t.replace(BRACKETED_SUFFIX_RE, "").replace(DASH_SUFFIX_RE, "").trim();
  } while (t !== prev && t.length > 0);
  return t;
}

/** Canonical key for "is this the same album as that one", ignoring edition
 *  suffixes, articles, accents and punctuation. Used at import time to avoid
 *  creating duplicate albums for reissues/remasters, and at display time to
 *  merge search/discography results pointing at the same underlying work. */
export function canonicalAlbumKey(title, artistName) {
  // A title/name made entirely of punctuation/symbols normalizes to empty —
  // fall back to the raw lowercased value so two different albums/artists
  // sharing such a title don't collide on the same (empty) key part.
  const t = stripArticle(normalize(stripEditionSuffix(title))) || title.toLowerCase().trim();
  const a = stripArticle(normalize(artistName)) || artistName.toLowerCase().trim();
  return `${t}|||${a}`;
}
