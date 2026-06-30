export type CreditedArtistRef = { id: string; name: string };
export type FeaturedCredit = { artist: CreditedArtistRef; joinphrase: string | null };

// Fallback separator when a credit row has no joinphrase (shouldn't normally happen —
// MusicBrainz always supplies one between two credited names).
const DEFAULT_JOINPHRASE = ' feat. ';

/** Builds the ordered list of (separator, artist) pairs for rendering
 *  "Primary & Artist B feat. Artist C" with the exact MB joinphrases. */
export function creditParts(
  primary: CreditedArtistRef,
  featured: FeaturedCredit[]
): Array<{ prefix: string; artist: CreditedArtistRef }> {
  return [
    { prefix: '', artist: primary },
    ...featured.map((f) => ({ prefix: f.joinphrase || DEFAULT_JOINPHRASE, artist: f.artist })),
  ];
}

export type RawFeaturedRow = { position: number; joinphrase: string | null; artists: CreditedArtistRef | null };

/** Turns the raw rows from an `album_featured_artists`/`track_featured_artists` embed
 *  (`select('position, joinphrase, artists(id, name)')`) into ordered FeaturedCredit[]. */
export function parseFeaturedRows(rows: RawFeaturedRow[] | null | undefined): FeaturedCredit[] {
  return (rows ?? [])
    .filter((r): r is RawFeaturedRow & { artists: CreditedArtistRef } => !!r.artists)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ artist: r.artists, joinphrase: r.joinphrase }));
}
