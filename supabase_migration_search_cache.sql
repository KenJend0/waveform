-- ============================================================
-- MIGRATION: Cache des résultats de recherche MusicBrainz
-- À appliquer via l'éditeur SQL du dashboard Supabase
-- ============================================================
--
-- Table servant de cache partagé entre tous les utilisateurs.
-- Une même recherche (ex: "beyonce") n'appelle MB qu'une fois
-- toutes les 24h, peu importe combien d'utilisateurs la font.
--
-- Nettoyage automatique via pg_cron ou via la requête DELETE
-- déclenchée à chaque écriture (supprime les entrées expirées).
-- ============================================================

CREATE TABLE IF NOT EXISTS search_cache (
  key        TEXT PRIMARY KEY,           -- hash de la requête: md5(query || ':' || type)
  data       JSONB NOT NULL,             -- résultats sérialisés
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la purge rapide des entrées expirées
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- RLS : la table est en lecture publique (authentifiés) et écriture publique
-- car le cache est partagé et ne contient pas de données sensibles
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_cache_read" ON search_cache;
CREATE POLICY "search_cache_read" ON search_cache
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "search_cache_write" ON search_cache;
CREATE POLICY "search_cache_write" ON search_cache
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "search_cache_update" ON search_cache;
CREATE POLICY "search_cache_update" ON search_cache
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "search_cache_delete" ON search_cache;
CREATE POLICY "search_cache_delete" ON search_cache
  FOR DELETE TO authenticated USING (true);
