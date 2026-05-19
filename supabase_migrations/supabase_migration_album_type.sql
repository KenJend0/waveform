-- Add type column to albums to distinguish Album / EP / Single
ALTER TABLE albums ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Album';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_albums_type ON albums(type);

-- Update fuzzy_search_albums to exclude singles
CREATE OR REPLACE FUNCTION fuzzy_search_albums(query_text text, result_limit int DEFAULT 5)
RETURNS TABLE(id uuid, title text, cover_url text, release_date date, artist_name text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT a.id, a.title, a.cover_url, a.release_date, ar.name AS artist_name
  FROM   albums a
  LEFT JOIN artists ar ON ar.id = a.artist_id
  WHERE  similarity(a.title, query_text) > 0.25
  AND    a.type != 'Single'
  ORDER  BY similarity(a.title, query_text) DESC
  LIMIT  result_limit;
$$;
