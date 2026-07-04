// Miroir de apps/web/lib/trackCanonical.mjs — module pur, aucune dépendance Deno/Node.
import { normalize, stripArticle } from './textNormalize.ts';

export function canonicalTrackTitle(title: string): string {
  const result = stripArticle(normalize(title));
  return result || title.toLowerCase().trim();
}
