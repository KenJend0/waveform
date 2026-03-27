-- Migration: dénormalisation likes_count / comments_count sur diary_entries
-- + triggers de maintenance automatique

-- 1. Ajout des colonnes
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;

-- 2. Backfill des données existantes
UPDATE diary_entries e
SET likes_count = (SELECT COUNT(*) FROM diary_likes l WHERE l.entry_id = e.id);

UPDATE diary_entries e
SET comments_count = (SELECT COUNT(*) FROM diary_comments c WHERE c.entry_id = e.id);

-- 3. Trigger likes
CREATE OR REPLACE FUNCTION update_entry_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE diary_entries SET likes_count = likes_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE diary_entries SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_likes_count ON diary_likes;
CREATE TRIGGER trg_entry_likes_count
AFTER INSERT OR DELETE ON diary_likes
FOR EACH ROW EXECUTE FUNCTION update_entry_likes_count();

-- 4. Trigger comments
CREATE OR REPLACE FUNCTION update_entry_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE diary_entries SET comments_count = comments_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE diary_entries SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_comments_count ON diary_comments;
CREATE TRIGGER trg_entry_comments_count
AFTER INSERT OR DELETE ON diary_comments
FOR EACH ROW EXECUTE FUNCTION update_entry_comments_count();
