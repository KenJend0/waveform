-- Canonical title key for tracks, used to detect "same song, different
-- MusicBrainz container" (Album vs EP vs Single all carrying the same
-- recording under their own release-group) that tracks.mbid UNIQUE can't
-- catch since each container stores its own track-position id, not the
-- shared recording id.
--
-- The value is computed in app code (frontend/lib/trackCanonical.mjs) at
-- import time. This migration only adds the column + index; it does NOT
-- backfill existing rows — run
-- frontend/scripts/backfill-canonical-track-titles.mjs once after applying
-- this migration to populate canonical_title for tracks imported before
-- this change.

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS canonical_title TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_artist_canonical_title
  ON tracks(artist_id, canonical_title);
