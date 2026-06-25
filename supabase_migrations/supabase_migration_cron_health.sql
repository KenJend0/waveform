-- ============================================================
-- WAVEFORM — Migration : santé des jobs cron (GitHub Actions)
-- À exécuter via le Supabase SQL Editor (une seule fois en production)
--
-- Contexte : daily-enrich.yml a échoué silencieusement 5 nuits de suite
-- (15 → 19 juin 2026) à cause d'un package-lock.json désynchronisé — `npm ci`
-- plantait avant même que le script Node ne démarre. Personne n'a eu de
-- signal côté admin, le souci n'a été découvert qu'en creusant les logs
-- GitHub Actions a posteriori.
--
-- Ce ping est envoyé en `curl` direct depuis le workflow (étape `if: always()`),
-- donc il survit même si `npm ci` échoue avant que le script Node ne tourne.
-- ============================================================

CREATE TABLE IF NOT EXISTS cron_health (
    job_name     TEXT PRIMARY KEY,
    status       TEXT NOT NULL CHECK (status IN ('success', 'failure')),
    last_run_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    detail       TEXT
);

ALTER TABLE cron_health ENABLE ROW LEVEL SECURITY;

-- Lecture publique (affichage admin) ; écriture réservée au service-role (bypass RLS).
CREATE POLICY "cron_health_select" ON cron_health FOR SELECT USING (true);
