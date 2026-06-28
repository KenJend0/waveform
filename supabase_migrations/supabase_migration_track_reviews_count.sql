-- Migration: Ajoute reviews_count (critiques écrites) à track_stats
-- Run this in the Supabase SQL editor
--
-- ratings_count compte les entrées avec une note (rating IS NOT NULL) — ce n'est pas
-- le nombre de critiques écrites. La page /tracks affichait ratings_count sous le label
-- "Critiques", ce qui gonflait le chiffre (ex: 4 auditeurs notés, 1 seule critique écrite,
-- mais "4 Critiques" affiché). album_stats a déjà la bonne sémantique (reviews_count =
-- review_body non vide) — on aligne track_stats sur le même calcul.

-- CREATE OR REPLACE VIEW ne permet pas de réordonner/insérer des colonnes au milieu
-- (Postgres le traite comme un renommage de colonne existante, rejeté avec l'erreur 42P16).
-- reviews_count est donc ajoutée à la fin, après les colonnes d'origine.
CREATE OR REPLACE VIEW track_stats AS
SELECT
  track_id,
  COUNT(*) FILTER (WHERE rating IS NOT NULL)                                          AS ratings_count,
  ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL), 1)                             AS avg_rating,
  COUNT(DISTINCT user_id)                                                             AS listeners_count,
  COUNT(*) FILTER (WHERE review_body IS NOT NULL AND review_body <> '')               AS reviews_count
FROM track_diary_entries
GROUP BY track_id;
