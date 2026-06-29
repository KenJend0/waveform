import { describe, it, expect } from 'vitest';
import { canonicalTrackTitle } from './trackCanonical.mjs';

describe('canonicalTrackTitle', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(canonicalTrackTitle('Café')).toBe(canonicalTrackTitle('CAFE'));
  });

  it('keeps version markers distinct (Live/Acoustic are different performances)', () => {
    expect(canonicalTrackTitle('Riptide')).not.toBe(canonicalTrackTitle('Riptide (Acoustic)'));
  });

  it('does not collapse non-Latin titles to an empty string', () => {
    expect(canonicalTrackTitle('忘れる女')).not.toBe('');
    expect(canonicalTrackTitle('忘れる女')).not.toBe(canonicalTrackTitle('ゴーゴースチーム'));
  });

  it('does not collapse two different punctuation-only titles to the same key', () => {
    expect(canonicalTrackTitle('...')).not.toBe(canonicalTrackTitle('♥'));
  });
});
