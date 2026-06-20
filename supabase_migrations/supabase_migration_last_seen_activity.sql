-- ============================================================
-- MIGRATION: Indicateur "non lu" sur la page Activité (ex-Feed)
-- À appliquer via l'éditeur SQL du dashboard Supabase
-- ============================================================
--
-- Stocke la dernière fois où l'utilisateur a consulté sa page
-- Activité (/feed). Comparé au plus récent feed_events.created_at
-- pour savoir s'il y a du contenu non vu (badge sur la nav).
-- Nullable : NULL = jamais visité, traité comme "tout est non lu".
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_activity_at TIMESTAMPTZ;
