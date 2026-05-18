-- Enable pg_trgm extension (may already be enabled in Supabase dashboard)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes already exist in schema.sql:
--   idx_albums_title_trgm  ON albums  USING gin (title gin_trgm_ops)
--   idx_artists_name_trgm  ON artists USING gin (name  gin_trgm_ops)
--   idx_tracks_title_trgm  ON tracks  USING gin (title gin_trgm_ops)
-- Run this migration only if they are missing:
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm  ON albums  USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm  ON artists USING gin (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm  ON tracks  USING gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- RPC: fuzzy_search_albums
-- Returns albums whose title is similar to the query (typo-tolerant fallback).
-- Called by searchInternal() when FTS + ILIKE return 0 results.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fuzzy_search_albums(query_text text, result_limit int DEFAULT 5)
RETURNS TABLE(id uuid, title text, cover_url text, release_date date, artist_name text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT a.id, a.title, a.cover_url, a.release_date, ar.name AS artist_name
  FROM   albums a
  LEFT JOIN artists ar ON ar.id = a.artist_id
  WHERE  similarity(a.title, query_text) > 0.25
  ORDER  BY similarity(a.title, query_text) DESC
  LIMIT  result_limit;
$$;

-- ---------------------------------------------------------------------------
-- RPC: fuzzy_search_artists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fuzzy_search_artists(query_text text, result_limit int DEFAULT 5)
RETURNS TABLE(id uuid, name text, image_url text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT id, name, image_url
  FROM   artists
  WHERE  similarity(name, query_text) > 0.25
  ORDER  BY similarity(name, query_text) DESC
  LIMIT  result_limit;
$$;

-- ---------------------------------------------------------------------------
-- RPC: fuzzy_search_tracks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fuzzy_search_tracks(query_text text, result_limit int DEFAULT 10)
RETURNS TABLE(
  id          uuid,
  title       text,
  album_id    uuid,
  album_title text,
  album_cover text,
  artist_id   uuid,
  artist_name text
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    t.id,
    t.title,
    a.id          AS album_id,
    a.title       AS album_title,
    a.cover_url   AS album_cover,
    ar.id         AS artist_id,
    ar.name       AS artist_name
  FROM   tracks t
  LEFT JOIN albums  a  ON a.id  = t.album_id
  LEFT JOIN artists ar ON ar.id = a.artist_id
  WHERE  similarity(t.title, query_text) > 0.25
  ORDER  BY similarity(t.title, query_text) DESC
  LIMIT  result_limit;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION fuzzy_search_albums  TO authenticated;
GRANT EXECUTE ON FUNCTION fuzzy_search_artists TO authenticated;
GRANT EXECUTE ON FUNCTION fuzzy_search_tracks  TO authenticated;
