export function normalize(str) {
  return str
    .toLowerCase()
    // NFKD (not just NFD) also folds compatibility characters like superscript
    // digits ("²" → "2") into their plain form before the punctuation strip
    // below — otherwise "HHHH²" and "HHHH" collapse to the same string.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Punctuation becomes a SPACE, not nothing — "Vol.1" must not collapse into
    // "vol1" while "Vol. 1" (already spaced) stays "vol 1". Stripping to empty
    // merges tokens inconsistently depending on whether the source had a space.
    // \p{L}/\p{N} (Unicode letter/number) instead of \w — \w is ASCII-only
    // ([A-Za-z0-9_]), so a title written entirely in Japanese, Arabic, Cyrillic...
    // would have every character stripped as "punctuation", collapsing to an
    // empty string. That made canonicalAlbumKey/canonicalTrackTitle collide for
    // every non-Latin title by the same artist — a Japanese-discography artist
    // had 6 different songs all sharing the same (empty) canonical key.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    // Leading zeros on numeric tokens ("01" → "1") so "Vol. 01" and "Vol.1" agree.
    .replace(/\b0+(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripArticle(s) {
  return s.replace(/^(the|a|an) /, "");
}
