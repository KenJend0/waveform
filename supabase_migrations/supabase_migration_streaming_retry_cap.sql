-- ============================================================
-- WAVEFORM — Migration : cap sur les retries de liens streaming
-- À exécuter via le Supabase SQL Editor (une seule fois en production)
--
-- Problème : Phase 2 de enrich-missing.mjs réinitialise fetched_at à chaque
-- tentative, même en échec total, et la retente indéfiniment toutes les
-- 7 jours sans jamais s'arrêter. Sur un album dont le titre/artiste ne
-- matche aucune API de streaming, ça consomme du quota d'API chaque
-- semaine pour toujours échouer.
--
-- Ce compteur permet de stopper les tentatives après N échecs et de
-- distinguer dans l'admin "jamais tenté" vs "tenté N fois, introuvable".
-- ============================================================

ALTER TABLE album_metadata
  ADD COLUMN IF NOT EXISTS streaming_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS album_metadata_streaming_attempts_idx
  ON album_metadata (streaming_attempts)
  WHERE spotify_url IS NULL AND apple_music_url IS NULL AND deezer_url IS NULL;
