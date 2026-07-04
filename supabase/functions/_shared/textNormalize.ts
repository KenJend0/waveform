// Miroir de apps/web/lib/textNormalize.mjs — module pur, aucune dépendance Deno/Node.
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b0+(\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripArticle(s: string): string {
  return s.replace(/^(the|a|an) /, '');
}
