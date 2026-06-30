-- ============================================================
-- Migration : corrige le search_path mutable des triggers de comptage
-- ajoutés dans supabase_migration_harmonize_counts.sql.
-- À exécuter dans le dashboard Supabase → SQL Editor.
--
-- Bug : ces 3 fonctions ne fixaient pas search_path et référençaient leurs
-- tables sans préfixe de schéma (contrairement à update_entry_likes_count/
-- update_entry_comments_count, déjà correctes dans le schéma de prod).
-- Pendant la suppression d'un compte (DELETE FROM auth.users), Supabase
-- exécute la cascade avec un search_path vide par sécurité — les triggers
-- ne trouvaient alors plus track_diary_entries/user_lists, faisant
-- échouer toute la transaction ("Database error deleting user").
-- ============================================================

CREATE OR REPLACE FUNCTION update_track_entry_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.track_diary_entries SET likes_count = likes_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.track_diary_entries SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION update_track_entry_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.track_diary_entries SET comments_count = comments_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.track_diary_entries SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION update_list_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_lists SET likes_count = likes_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_lists SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$;
