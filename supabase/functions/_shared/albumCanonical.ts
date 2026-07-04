// Miroir de apps/web/lib/albumCanonical.mjs — module pur, aucune dépendance Deno/Node.
import { normalize, stripArticle } from './textNormalize.ts';

const EDITION_KEYWORDS = [
  'super deluxe( edition)?',
  'deluxe( edition)?',
  'remaster(ed)?( version)?',
  '\\d{4}\\s*remaster(ed)?',
  '\\d+(st|nd|rd|th)\\s*anniversary( edition)?',
  'anniversary( edition)?',
  'expanded( edition)?',
  'extended( edition)?',
  'bonus track(s)?( version)?',
  'special edition',
  "collector'?s? edition",
  'legacy edition',
  'mono( version)?',
  'stereo( version)?',
  'reissue',
].join('|');

const BRACKETED_SUFFIX_RE = new RegExp(`\\s*[(\\[][^()\\[\\]]*(?:${EDITION_KEYWORDS})[^()\\[\\]]*[)\\]]\\s*$`, 'i');
const DASH_SUFFIX_RE = new RegExp(`\\s*[-–:]\\s*(?:${EDITION_KEYWORDS})\\s*$`, 'i');

export function stripEditionSuffix(title: string): string {
  let t = title;
  let prev;
  do {
    prev = t;
    t = t.replace(BRACKETED_SUFFIX_RE, '').replace(DASH_SUFFIX_RE, '').trim();
  } while (t !== prev && t.length > 0);
  return t;
}

export function canonicalAlbumKey(title: string, artistName: string): string {
  const t = stripArticle(normalize(stripEditionSuffix(title))) || title.toLowerCase().trim();
  const a = stripArticle(normalize(artistName)) || artistName.toLowerCase().trim();
  return `${t}|||${a}`;
}
