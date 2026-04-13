/**
 * Chargement des fonts Inter depuis Google Fonts CSS API.
 *
 * Satori (next/og) supporte TTF, OTF et WOFF — mais PAS WOFF2.
 * - UA moderne Chrome 120  → WOFF2 ❌ ("Unsupported OpenType signature wOF2")
 * - UA ancien IE 7          → EOT   ❌ ("Unsupported OpenType signature p")
 * - UA Chrome 35 (< 36)    → WOFF  ✓  (support WOFF, pas encore WOFF2)
 *
 * Cache module-level : les 3 variants Inter sont fetchés une seule fois
 * par process serveur.
 */

export interface WaveformFonts {
  regular: ArrayBuffer;
  medium: ArrayBuffer;
  italic: ArrayBuffer;
}

let _cache: WaveformFonts | null = null;

export async function loadFonts(): Promise<WaveformFonts> {
  if (_cache) return _cache;

  const [regular, medium, italic] = await Promise.all([
    fetchGoogleFontWoff(400, false),
    fetchGoogleFontWoff(500, false),
    fetchGoogleFontWoff(400, true),
  ]);

  _cache = { regular, medium, italic };
  return _cache;
}

// Chrome 35 : supporte WOFF mais pas encore WOFF2 (WOFF2 ajouté dans Chrome 36)
const WOFF_UA =
  'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36';

async function fetchGoogleFontWoff(weight: 400 | 500, italic: boolean): Promise<ArrayBuffer> {
  const ital = italic ? '1' : '0';
  const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:ital,wght@${ital},${weight}&display=swap`;

  const css = await fetch(cssUrl, {
    headers: { 'User-Agent': WOFF_UA },
  }).then((r) => r.text());

  // Avec ce UA, Google Fonts renvoie des URLs statiques fonts.gstatic.com/*.woff
  // avec format('woff'). On prend le dernier bloc = subset latin.
  const matches = [...css.matchAll(/url\(([^)]+\.woff[^)2]?[^)]*)\)\s*format\('woff'\)/g)];
  const fontUrl = matches.at(-1)?.[1]?.trim();

  if (!fontUrl) {
    // Fallback : toute URL présente dans le CSS (sans filtre de format)
    const allUrls = [...css.matchAll(/url\(([^)]+)\)/g)];
    const fallbackUrl = allUrls.at(-1)?.[1]?.trim();
    if (!fallbackUrl) {
      throw new Error(
        `Aucune URL de font trouvée pour Inter ${weight}${italic ? ' italic' : ''}.\n` +
        `CSS reçu :\n${css.slice(0, 600)}`
      );
    }
    return fetch(fallbackUrl).then((r) => r.arrayBuffer());
  }

  return fetch(fontUrl).then((r) => r.arrayBuffer());
}
