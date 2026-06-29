-- Canonical title+artist key for albums, used to detect "same album, different
-- MusicBrainz release-group" (reissues, remasters, deluxe/anniversary editions)
-- that the existing albums.mbid UNIQUE constraint can't catch since each such
-- edition has its own distinct MBID.
--
-- The value is computed in app code (frontend/lib/albumCanonical.ts) at import
-- time. This migration only adds the column + index; it does NOT backfill
-- existing rows — run frontend/scripts/backfill-canonical-keys.mjs once after
-- applying this migration to populate canonical_key for albums imported before
-- this change.

ALTER TABLE albums ADD COLUMN IF NOT EXISTS canonical_key TEXT;

CREATE INDEX IF NOT EXISTS idx_albums_artist_canonical_key
  ON albums(artist_id, canonical_key);
