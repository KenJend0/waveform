import { describe, it, expect } from 'vitest';
import { isAcceptableReleaseGroup, pickBestRelease, releaseSelectionMode } from './musicbrainzReleasePolicy.mjs';

describe('isAcceptableReleaseGroup', () => {
  it('accepts a plain Album', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': [] })).toBe(true);
  });

  it('accepts a plain EP', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'EP', 'secondary-types': [] })).toBe(true);
  });

  it('rejects a Single by default (Album/EP only)', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Single', 'secondary-types': [] })).toBe(false);
  });

  it('accepts a Single when explicitly allowed', () => {
    expect(
      isAcceptableReleaseGroup({ 'primary-type': 'Single', 'secondary-types': [] }, { allowedPrimaryTypes: new Set(['Single']) })
    ).toBe(true);
  });

  it('rejects a Various Artists compilation even though primary-type is Album', () => {
    // Root cause #6 from the MB pipeline handoff: a compilation is primary-type
    // "Album" on MusicBrainz like a real album — only secondary-types distinguish it.
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': ['Compilation'] })).toBe(false);
  });

  it('rejects a Live album by default', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': ['Live'] })).toBe(false);
  });

  it('accepts a Live album when allowLive is set (artist discography page)', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': ['Live'] }, { allowLive: true })).toBe(true);
  });

  it('still rejects a Compilation when allowLive is set', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': ['Compilation'] }, { allowLive: true })).toBe(false);
  });

  it('rejects a Remix release-group', () => {
    expect(isAcceptableReleaseGroup({ 'primary-type': 'Album', 'secondary-types': ['Remix'] })).toBe(false);
  });

  it('treats a missing primary-type as not disqualifying (only secondary-types gate it)', () => {
    expect(isAcceptableReleaseGroup({ 'secondary-types': [] })).toBe(true);
  });
});

describe('releaseSelectionMode', () => {
  it('uses "fewest" for a Single', () => {
    expect(releaseSelectionMode('Single')).toBe('fewest');
  });

  it('uses "fewest" for an EP', () => {
    expect(releaseSelectionMode('EP')).toBe('fewest');
  });

  it('uses "most" for an Album', () => {
    expect(releaseSelectionMode('Album')).toBe('most');
  });

  it('uses "most" for an unknown/null primary-type', () => {
    expect(releaseSelectionMode(null)).toBe('most');
  });
});

describe('pickBestRelease', () => {
  it('returns null for an empty list', () => {
    expect(pickBestRelease([], 'most')).toBeNull();
    expect(pickBestRelease(null, 'most')).toBeNull();
  });

  it('"most" picks the Official release with the most tracks (avoids incomplete promos)', () => {
    const releases = [
      { id: 'promo', status: 'Promotion', trackCount: 1 },
      { id: 'official-short', status: 'Official', trackCount: 8 },
      { id: 'official-full', status: 'Official', trackCount: 12 },
    ];
    expect(pickBestRelease(releases, 'most').id).toBe('official-full');
  });

  it('"fewest" picks the Official release with the fewest tracks (avoids maxi-single bonus tracks)', () => {
    const releases = [
      { id: 'maxi', status: 'Official', trackCount: 5 },
      { id: 'standard', status: 'Official', trackCount: 1 },
    ];
    expect(pickBestRelease(releases, 'fewest').id).toBe('standard');
  });

  it('falls back to non-Official releases when none is Official', () => {
    const releases = [
      { id: 'bootleg', status: 'Bootleg', trackCount: 10 },
      { id: 'promo', status: 'Promotion', trackCount: 4 },
    ];
    expect(pickBestRelease(releases, 'most').id).toBe('bootleg');
  });

  it('never picks a release with zero tracks if a non-empty one exists (root cause of the bulk-import 0-track bug)', () => {
    const releases = [
      { id: 'empty-promo', status: 'Official', trackCount: 0 },
      { id: 'real', status: 'Official', trackCount: 14 },
    ];
    expect(pickBestRelease(releases, 'most').id).toBe('real');
  });

  it('falls back to an empty-track release only when every candidate is empty', () => {
    const releases = [
      { id: 'empty-1', status: 'Official', trackCount: 0 },
      { id: 'empty-2', status: 'Official', trackCount: 0 },
    ];
    expect(pickBestRelease(releases, 'most')).not.toBeNull();
  });
});
