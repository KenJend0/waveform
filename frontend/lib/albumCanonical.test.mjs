import { describe, it, expect } from 'vitest';
import { canonicalAlbumKey, stripEditionSuffix } from './albumCanonical.mjs';

describe('stripEditionSuffix', () => {
  it('strips a bracketed Deluxe Edition suffix', () => {
    expect(stripEditionSuffix('Title (Deluxe Edition)')).toBe('Title');
  });

  it('strips a dash-separated Remastered suffix', () => {
    expect(stripEditionSuffix('Title - Remastered')).toBe('Title');
  });

  it('strips a year-prefixed remaster suffix', () => {
    expect(stripEditionSuffix('Title (2009 Remaster)')).toBe('Title');
  });

  it('strips a numbered anniversary edition suffix', () => {
    expect(stripEditionSuffix('Title (20th Anniversary Edition)')).toBe('Title');
  });

  it('strips stacked suffixes', () => {
    expect(stripEditionSuffix('Title (Deluxe) (Remastered)')).toBe('Title');
  });

  it('leaves a title with no edition suffix untouched', () => {
    expect(stripEditionSuffix('Title')).toBe('Title');
  });

  it('does not strip a parenthetical that is not an edition keyword', () => {
    // Real album titles can legitimately end in parentheses unrelated to editions
    // (soundtrack subtitles, featured artists) — must not be treated as noise.
    expect(stripEditionSuffix('Title (Original Motion Picture Soundtrack)')).toBe(
      'Title (Original Motion Picture Soundtrack)'
    );
  });
});

describe('canonicalAlbumKey', () => {
  it('treats a base title and its Deluxe Edition as the same album', () => {
    expect(canonicalAlbumKey('Title', 'Artist')).toBe(
      canonicalAlbumKey('Title (Deluxe Edition)', 'Artist')
    );
  });

  it('treats a base title and its remaster as the same album', () => {
    expect(canonicalAlbumKey('Nevermind', 'Nirvana')).toBe(
      canonicalAlbumKey('Nevermind (2009 Remaster)', 'Nirvana')
    );
  });

  it('is case- and accent-insensitive', () => {
    expect(canonicalAlbumKey('IPSÉITÉ', 'Damso')).toBe(canonicalAlbumKey('Ipséité', 'damso'));
  });

  it('strips leading articles from the title', () => {
    expect(canonicalAlbumKey('The Suburbs', 'Arcade Fire')).toBe(
      canonicalAlbumKey('Suburbs', 'Arcade Fire')
    );
  });

  it('does not collide two genuinely different albums by the same artist', () => {
    expect(canonicalAlbumKey('Currents', 'Tame Impala')).not.toBe(
      canonicalAlbumKey('Lonerism', 'Tame Impala')
    );
  });

  it('does not collide same-titled albums by different artists', () => {
    expect(canonicalAlbumKey('Cross', 'Justice')).not.toBe(canonicalAlbumKey('Cross', 'Someone Else'));
  });

  it('does not collapse two different punctuation-only titles to the same key', () => {
    expect(canonicalAlbumKey('...', 'Artist')).not.toBe(canonicalAlbumKey('♥', 'Artist'));
  });

  it('does not collapse non-Latin titles to an empty/identical key', () => {
    // Regression: \w in the old normalize() is ASCII-only, so a title written
    // entirely in Japanese/Arabic/etc. had every character stripped as
    // "punctuation", collapsing to an empty string — making every non-Latin
    // title by the same artist collide on the same canonical key.
    const a = canonicalAlbumKey('忘れる女', 'Artist');
    const b = canonicalAlbumKey('ゴーゴースチーム', 'Artist');
    expect(a).not.toBe('');
    expect(b).not.toBe('');
    expect(a).not.toBe(b);
  });
});
