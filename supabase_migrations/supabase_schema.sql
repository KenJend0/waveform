-- ============================================================
-- WAVEFORM — Supabase Schema
-- ============================================================
-- Source de vérité : généré depuis les types TypeScript produits
-- par `npx supabase gen types typescript --project-id aypyrwqghxkgehibkfob`
-- (Docker non requis)
--
-- Pour régénérer les types :
--   powershell -File scripts/generate-supabase-types.ps1
-- ============================================================

-- Extensions (déjà activées en production — à activer manuellement si fresh install)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- FONCTION utilitaire : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username     TEXT UNIQUE,
    display_name TEXT,
    bio          TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username      ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_trgm  ON profiles USING gin (display_name gin_trgm_ops);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. ARTISTS
-- Colonnes production : id, name, mbid, bio, image_url, created_at, updated_at
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    mbid       UUID UNIQUE,
    bio        TEXT,
    image_url  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artists_mbid      ON artists(mbid);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING gin (name gin_trgm_ops);

CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. ALBUMS
-- ============================================================
CREATE TABLE IF NOT EXISTS albums (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id    UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    release_date DATE,
    cover_url    TEXT,
    mbid         UUID UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_albums_artist_id  ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_mbid        ON albums(mbid);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm  ON albums USING gin (title gin_trgm_ops);

CREATE TRIGGER trg_albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. TRACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tracks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id    UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    duration_ms INTEGER,
    track_no    INTEGER,
    disc_no     INTEGER,
    mbid        UUID UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id   ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_mbid        ON tracks(mbid);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm  ON tracks USING gin (title gin_trgm_ops);

CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. EXTERNAL_IDS
-- ============================================================
CREATE TABLE IF NOT EXISTS external_ids (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('artist', 'album', 'track')),
    entity_id   UUID NOT NULL,
    source      TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_type, source, value)
);

CREATE INDEX IF NOT EXISTS idx_external_ids_entity       ON external_ids(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_source_value ON external_ids(source, value);

-- ============================================================
-- 6. DIARY_ENTRIES
-- Colonne production supplémentaire : re_listen (boolean)
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id     UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    listened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    rating       INTEGER CHECK (rating >= 0 AND rating <= 10),
    review_title TEXT,
    review_body  TEXT,
    re_listen    BOOLEAN NOT NULL DEFAULT false,
    is_public    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_user_id    ON diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_album_id   ON diary_entries(album_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created_at ON diary_entries(created_at DESC);

CREATE TRIGGER trg_diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6B. VUES
-- ============================================================

-- album_stats : statistiques agrégées par album
CREATE OR REPLACE VIEW album_stats AS
SELECT
    latest.album_id,
    COUNT(*)::int                                              AS listeners_count,
    COUNT(*) FILTER (
        WHERE latest.review_body IS NOT NULL
          AND latest.review_body <> ''
    )::int                                                     AS reviews_count,
    ROUND(AVG(latest.rating)::numeric, 1)                     AS avg_rating
FROM (
    SELECT DISTINCT ON (user_id, album_id)
        album_id, user_id, rating, review_body, created_at
    FROM diary_entries
    ORDER BY user_id, album_id, created_at DESC
) AS latest
GROUP BY latest.album_id;

-- diary_entry_stats : likes et commentaires par entrée
CREATE OR REPLACE VIEW diary_entry_stats AS
SELECT
    e.id                                                       AS entry_id,
    COUNT(DISTINCT l.user_id)::int                            AS likes_count,
    COUNT(DISTINCT c.id)::int                                 AS comments_count
FROM diary_entries e
LEFT JOIN diary_likes    l ON l.entry_id = e.id
LEFT JOIN diary_comments c ON c.entry_id = e.id
GROUP BY e.id;

-- ============================================================
-- 7. DIARY_LIKES
-- PK composite en production (pas de colonne id)
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_likes (
    entry_id   UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_likes_entry_id ON diary_likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_likes_user_id  ON diary_likes(user_id);

-- ============================================================
-- 8. DIARY_COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id   UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_comments_entry_id ON diary_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_comments_user_id  ON diary_comments(user_id);

CREATE TRIGGER trg_diary_comments_updated_at
  BEFORE UPDATE ON diary_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. FOLLOWS
-- PK composite en production (pas de colonne id)
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON follows(followee_id);

-- ============================================================
-- 10. FEED_EVENTS
-- Colonnes production : + comment_id, actor_id NOT NULL, created_at nullable
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    followee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,
    entry_id    UUID REFERENCES diary_entries(id) ON DELETE CASCADE,
    album_id    UUID REFERENCES albums(id) ON DELETE SET NULL,
    comment_id  UUID REFERENCES diary_comments(id) ON DELETE SET NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_events_user_id    ON feed_events(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_actor_id   ON feed_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_created_at ON feed_events(created_at DESC);

-- ============================================================
-- 11. SAVED_ALBUMS
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_albums (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, album_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_albums_user_id ON saved_albums(user_id);

-- ============================================================
-- 12. USER_FAVORITE_ALBUMS
-- Colonne production supplémentaire : updated_at
-- ============================================================
CREATE TABLE IF NOT EXISTS user_favorite_albums (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id   UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, album_id),
    UNIQUE(user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_albums_user_id ON user_favorite_albums(user_id);

CREATE TRIGGER trg_user_favorite_albums_updated_at
  BEFORE UPDATE ON user_favorite_albums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 13. IMPORT_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS import_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    artist_id   UUID,
    artist_mbid UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_requests_user_created_at ON import_requests(user_id, created_at DESC);

-- ============================================================
-- TABLES NON PRÉSENTES EN PRODUCTION (à créer si besoin)
-- saved_tracks, notifications, recommendations,
-- recommendation_likes, discover_items
-- ============================================================


-- ============================================================
-- ROW LEVEL SECURITY
--
-- Règles :
--   - (SELECT auth.uid()) évite la réévaluation par ligne
--   - Une seule policy permissive par rôle/action
--   - Catalogue : lecture publique, écritures via admin client
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_public" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self"   ON profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "profiles_update_self"   ON profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

-- ── diary_entries ─────────────────────────────────────────────
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_select_public_or_owner" ON diary_entries FOR SELECT
  USING (is_public = true OR (SELECT auth.uid()) = user_id);
CREATE POLICY "diary_insert_owner" ON diary_entries FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "diary_update_owner" ON diary_entries FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "diary_delete_owner" ON diary_entries FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── diary_likes ───────────────────────────────────────────────
ALTER TABLE diary_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_likes_select_visible_entry" ON diary_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM diary_entries de
      WHERE de.id = diary_likes.entry_id
        AND (de.is_public = true OR de.user_id = (SELECT auth.uid()))
    )
  );
CREATE POLICY "diary_likes_insert_self" ON diary_likes FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "diary_likes_delete_self" ON diary_likes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── diary_comments ────────────────────────────────────────────
ALTER TABLE diary_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_comments_select" ON diary_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM diary_entries de
      WHERE de.id = diary_comments.entry_id
        AND (de.is_public = true OR de.user_id = (SELECT auth.uid()))
    )
  );
CREATE POLICY "diary_comments_insert_self_on_public" ON diary_comments FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM diary_entries de
      WHERE de.id = diary_comments.entry_id AND de.is_public = true
    )
  );
CREATE POLICY "diary_comments_update_self" ON diary_comments FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "diary_comments_delete_self" ON diary_comments FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── follows ───────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read_public" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON follows FOR INSERT WITH CHECK ((SELECT auth.uid()) = follower_id);
CREATE POLICY "follows_delete_self" ON follows FOR DELETE USING ((SELECT auth.uid()) = follower_id);

-- ── feed_events ───────────────────────────────────────────────
ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_read_own" ON feed_events FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert their own feed events" ON feed_events FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "feed_write_service" ON feed_events FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ── saved_albums ──────────────────────────────────────────────
ALTER TABLE saved_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_albums_select_owner" ON saved_albums FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "saved_albums_insert_owner" ON saved_albums FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "saved_albums_delete_owner" ON saved_albums FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ── user_favorite_albums ──────────────────────────────────────
ALTER TABLE user_favorite_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_select_public" ON user_favorite_albums FOR SELECT
  USING (true);
CREATE POLICY "favorites_insert_owner" ON user_favorite_albums FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "favorites_update_owner" ON user_favorite_albums FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "favorites_delete_owner" ON user_favorite_albums FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── import_requests ───────────────────────────────────────────
ALTER TABLE import_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_requests_insert_own" ON import_requests FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "import_requests_select_own" ON import_requests FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ── catalogue (albums / artists / tracks / external_ids) ──────
ALTER TABLE albums       ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ids ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "albums_read_public"       ON albums       FOR SELECT USING (true);
CREATE POLICY "artists_read_public"      ON artists      FOR SELECT USING (true);
CREATE POLICY "tracks_read_public"       ON tracks       FOR SELECT USING (true);
CREATE POLICY "external_ids_read_public" ON external_ids FOR SELECT USING (true);

-- Service role : accès complet aux métadonnées catalogue
CREATE POLICY "albums_write_service"       ON albums       FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "artists_write_service"      ON artists      FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "tracks_write_service"       ON tracks       FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "external_ids_write_service" ON external_ids FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Utilisateurs authentifiés : peuvent insérer des entrées de catalogue
CREATE POLICY "allow authenticated album insert"  ON albums  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "allow authenticated artist insert" ON artists FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "allow authenticated track insert"  ON tracks  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
