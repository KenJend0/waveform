-- Provenance des notes : permet de savoir si une note vient d'une suggestion
-- "Pour toi" (ML ou fallback Jaccard), pour mesurer la vraie performance du
-- modèle en prod (note moyenne post-recommandation) plutôt que seulement
-- via l'évaluation offline (recommendation_metrics).
-- Run this in the Supabase SQL editor.

ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS rec_source TEXT;
ALTER TABLE track_diary_entries ADD COLUMN IF NOT EXISTS rec_source TEXT;
