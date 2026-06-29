export function normalize(str: string): string {
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
    .replace(/[^\w\s]/g, " ")
    // Leading zeros on numeric tokens ("01" → "1") so "Vol. 01" and "Vol.1" agree.
    .replace(/\b0+(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripArticle(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}
