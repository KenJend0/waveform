import { GENRE_FAMILIES } from './genre-families';

// Inverted index: any genre slug (family or subgenre) → parent family
const SLUG_TO_FAMILY = new Map<string, { slug: string; label: string }>();
for (const family of GENRE_FAMILIES) {
  SLUG_TO_FAMILY.set(family.slug, { slug: family.slug, label: family.label });
  for (const sub of family.subgenres) {
    SLUG_TO_FAMILY.set(sub.slug, { slug: family.slug, label: family.label });
  }
}

export type FamilyWeight = { slug: string; label: string; weight: number };

export function buildFamilyWeights(
  genreData: Array<{ genre_slug: string; weight: number }>
): FamilyWeight[] {
  const map = new Map<string, FamilyWeight>();
  for (const { genre_slug, weight } of genreData) {
    const family = SLUG_TO_FAMILY.get(genre_slug);
    if (!family) continue;
    const existing = map.get(family.slug);
    if (existing) {
      existing.weight += weight;
    } else {
      map.set(family.slug, { slug: family.slug, label: family.label, weight });
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

export function getTopFamilySlugs(
  genreData: Array<{ genre_slug: string; weight: number }>,
  n = 3
): string[] {
  return buildFamilyWeights(genreData).slice(0, n).map((f) => f.slug);
}
