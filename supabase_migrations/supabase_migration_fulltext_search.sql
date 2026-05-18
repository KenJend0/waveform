-- ============================================================
-- MIGRATION: Full-text search vectors
-- À appliquer via l'éditeur SQL du dashboard Supabase
-- ============================================================
--
-- Prérequis : activer l'extension unaccent dans le dashboard Supabase
-- (Database → Extensions → unaccent → Enable)
--
-- Utilise la config 'simple' + unaccent() plutôt que 'english' :
--   - 'simple' : lowercase uniquement, pas de stemming, pas de stopwords
--   - unaccent() : normalise les accents (café → cafe, Björk → Bjork)
--   - Plus robuste pour les titres d'albums/artistes internationaux
--
-- Les index GIN assurent des recherches O(log n) même sur une grande table.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() est STABLE, pas IMMUTABLE — les colonnes GENERATED le requièrent.
-- Pattern standard PostgreSQL : wrapper IMMUTABLE qui force la résolution du dict.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent'::regdictionary, $1)
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- Albums : on supprime la colonne si elle existe (migration depuis 'english')
-- puis on la recrée avec la config 'simple' + unaccent
ALTER TABLE albums DROP COLUMN IF EXISTS search_vector;
ALTER TABLE albums ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent(coalesce(title, '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_albums_search_vector
  ON albums USING gin(search_vector);

-- Artists
ALTER TABLE artists DROP COLUMN IF EXISTS search_vector;
ALTER TABLE artists ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent(coalesce(name, '')))) STORED;

CREATE INDEX IF NOT EXISTS idx_artists_search_vector
  ON artists USING gin(search_vector);
