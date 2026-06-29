import { describe, it, expect } from 'vitest';
import {
  isArtistMatch,
  hasArtistTokenOverlap,
  looseNormalize,
  pickCandidate,
  NON_ORIGINAL_TITLE_PATTERN,
} from './musicbrainzMatch.mjs';

describe('looseNormalize', () => {
  it('treats "&" and "+" as equivalent punctuation (per the documented Hotel example)', () => {
    expect(looseNormalize('Hotel & Casino')).toBe(looseNormalize('Hotel + Casino'));
  });

  it('ignores slash punctuation', () => {
    expect(looseNormalize('Either/Or')).toBe(looseNormalize('Either Or'));
  });

  it('does not collapse non-Latin titles to an empty string', () => {
    // Regression: [^a-z0-9]+ is ASCII-only, so a Japanese/Arabic title had
    // every character stripped, collapsing to empty and falsely matching any
    // other non-Latin title via isArtistMatch's exact-equality branch.
    expect(looseNormalize('忘れる女')).not.toBe('');
    expect(looseNormalize('忘れる女')).not.toBe(looseNormalize('ゴーゴースチーム'));
  });
});

describe('isArtistMatch', () => {
  it('matches identical names', () => {
    expect(isArtistMatch('Daft Punk', 'Daft Punk')).toBe(true);
  });

  it('matches names differing only by punctuation/case', () => {
    expect(isArtistMatch('AC/DC', 'ac dc')).toBe(true);
  });

  it('rejects a tribute band containing the real artist name as a substring', () => {
    // Containment alone is too permissive — a tribute band name contains the
    // original artist's name but is a different act entirely.
    expect(isArtistMatch('Kanye West Tribute Band Live Revue', 'Kanye West')).toBe(false);
  });

  it('rejects two unrelated artist names', () => {
    expect(isArtistMatch('Radiohead', 'Daft Punk')).toBe(false);
  });
});

describe('hasArtistTokenOverlap', () => {
  it('matches when one artist credit is a subset of a multi-artist credit', () => {
    expect(hasArtistTokenOverlap('Freddie Gibbs & The Alchemist', 'Freddie Gibbs')).toBe(true);
  });

  it('returns false for completely disjoint artist names', () => {
    expect(hasArtistTokenOverlap('Freddie Gibbs', 'Daft Punk')).toBe(false);
  });
});

describe('NON_ORIGINAL_TITLE_PATTERN', () => {
  it('flags tribute/karaoke renditions', () => {
    expect(NON_ORIGINAL_TITLE_PATTERN.test('Bohemian Rhapsody (Karaoke Version)')).toBe(true);
    expect(NON_ORIGINAL_TITLE_PATTERN.test('Songs in the Style of Queen')).toBe(true);
  });

  it('does not flag an ordinary title', () => {
    expect(NON_ORIGINAL_TITLE_PATTERN.test('Bohemian Rhapsody')).toBe(false);
  });
});

describe('pickCandidate', () => {
  const item = { artist: 'Daft Punk', album: 'Discovery' };

  it('prefers an exact title + artist-token-overlap match over a fuzzy one', () => {
    const results = [
      { id: 'fuzzy', title: 'Discovery (Remixes)', artistName: 'Daft Punk', score: 95 },
      { id: 'exact', title: 'Discovery', artistName: 'Daft Punk', score: 80 },
    ];
    expect(pickCandidate(results, item).id).toBe('exact');
  });

  it('falls back to a high-score fuzzy match when no exact title match exists', () => {
    const results = [{ id: 'fuzzy', title: 'Discoveries', artistName: 'Daft Punk', score: 92 }];
    expect(pickCandidate(results, item).id).toBe('fuzzy');
  });

  it('rejects a fuzzy match whose title looks like a tribute/karaoke rendition', () => {
    const results = [{ id: 'karaoke', title: 'Discovery (Karaoke Version)', artistName: 'Daft Punk', score: 95 }];
    expect(pickCandidate(results, item)).toBeNull();
  });

  it('rejects a fuzzy match below the score threshold', () => {
    const results = [{ id: 'weak', title: 'Discoveries', artistName: 'Daft Punk', score: 50 }];
    expect(pickCandidate(results, item)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(pickCandidate([], item)).toBeNull();
  });
});
