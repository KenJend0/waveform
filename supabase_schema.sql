-- ============================================================
-- WAVEFORM — Supabase Schema
-- ============================================================
-- Ce fichier reflète le schéma RÉEL de la base de production.
-- Pour régénérer depuis Supabase :
--   supabase db dump --file supabase_schema_current.sql
--
-- Extensions requises
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
-- Source de vérité unique pour les métadonnées utilisateur.
-- Lié à auth.users — créé automatiquement à l'inscription.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username       TEXT UNIQUE NOT NULL
                     CHECK (username ~ '^[a-zA-Z0-9_\.\-]{2,32}$'),
    display_name   TEXT,
    bio            TEXT,
    avatar_url     TEXT,
    username_changed BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username       ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm  ON profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_trgm   ON profiles USING gin (display_name gin_trgm_ops);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. ARTISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    mbid       UUID UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artists_mbid       ON artists(mbid);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm  ON artists USING gin (name gin_trgm_ops);

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

CREATE INDEX IF NOT EXISTS idx_albums_artist_id   ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_mbid         ON albums(mbid);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm   ON albums USING gin (title gin_trgm_ops);

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

CREATE INDEX IF NOT EXISTS idx_tracks_album_id    ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_mbid         ON tracks(mbid);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm   ON tracks USING gin (title gin_trgm_ops);

CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. EXTERNAL_IDS
-- Liens vers des sources externes (MusicBrainz, Spotify, etc.)
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

CREATE INDEX IF NOT EXISTS idx_external_ids_entity        ON external_ids(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_source_value  ON external_ids(source, value);

-- ============================================================
-- 6. DIARY_ENTRIES
-- Une entrée = un album écouté par un utilisateur.
-- Peut contenir une note, une review, ou rien (simple log).
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id     UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    listened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    rating       INTEGER CHECK (rating >= 0 AND rating <= 10),
    review_title TEXT,
    review_body  TEXT,
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
-- 6B. ALBUM_STATS (vue)
-- Statistiques par album : auditeurs uniques, reviews, note moyenne.
-- Se base sur la dernière entrée de chaque user par album.
-- ============================================================
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
        album_id,
        user_id,
        rating,
        review_body,
        created_at
    FROM diary_entries
    ORDER BY user_id, album_id, created_at DESC
) AS latest
GROUP BY latest.album_id;

-- ============================================================
-- 7. DIARY_LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_likes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id   UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_likes_entry_id  ON diary_likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_likes_user_id   ON diary_likes(user_id);

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

CREATE INDEX IF NOT EXISTS idx_diary_comments_entry_id  ON diary_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_comments_user_id   ON diary_comments(user_id);

CREATE TRIGGER trg_diary_comments_updated_at
  BEFORE UPDATE ON diary_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id  ON follows(followee_id);

-- ============================================================
-- 10. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type       TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'recommendation')),
    related_id UUID,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- 11. FEED_EVENTS
-- Fan-out en écriture : chaque événement est dupliqué pour
-- chaque destinataire (followers + acteur lui-même).
-- ============================================================
CREATE TABLE IF NOT EXISTS feed_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    followee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,
    entry_id    UUID REFERENCES diary_entries(id) ON DELETE CASCADE,
    album_id    UUID REFERENCES albums(id) ON DELETE SET NULL,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_events_user_id     ON feed_events(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_actor_id    ON feed_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_feed_events_created_at  ON feed_events(created_at DESC);

-- ============================================================
-- 12. SAVED_ALBUMS
-- Albums sauvegardés / wishlist de l'utilisateur.
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_albums (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id  UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, album_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_albums_user_id  ON saved_albums(user_id);

-- ============================================================
-- 13. SAVED_TRACKS
-- Tracks sauvegardées individuellement.
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_tracks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_tracks_user_id  ON saved_tracks(user_id);

-- ============================================================
-- 14. RECOMMENDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommended_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recommended_to_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    album_id          UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    message           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_by_id  ON recommendations(recommended_by_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_to_id  ON recommendations(recommended_to_id);

-- ============================================================
-- 15. RECOMMENDATION_LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_likes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(recommendation_id, user_id)
);

-- ============================================================
-- 16. USER_FAVORITE_ALBUMS
-- Top 3 albums mis en avant sur le profil.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_favorite_albums (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id   UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, album_id),
    UNIQUE(user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_albums_user_id  ON user_favorite_albums(user_id);

-- ============================================================
-- 17. DISCOVER_ITEMS
-- Albums recommandés à l'utilisateur par l'algo de découverte.
-- ============================================================
CREATE TABLE IF NOT EXISTS discover_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    album_id   UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    category   TEXT,
    score      FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, album_id)
);

CREATE INDEX IF NOT EXISTS idx_discover_items_user_id   ON discover_items(user_id);
CREATE INDEX IF NOT EXISTS idx_discover_items_score     ON discover_items(score DESC);

-- ============================================================
-- import_requests
-- Tracks user-initiated bulk import requests to enforce per-user rate limits
-- ============================================================
CREATE TABLE IF NOT EXISTS import_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_id  UUID,
  artist_mbid UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_requests_user_created_at ON import_requests(user_id, created_at DESC);

ALTER TABLE import_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_requests_insert_own" ON import_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "import_requests_select_own" ON import_requests FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- À activer sur chaque table dans le dashboard Supabase.
-- Exemples de policies minimales :
-- ============================================================

-- profiles : lecture publique, écriture owner uniquement
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_public"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"     ON profiles FOR UPDATE USING (auth.uid() = id);

-- diary_entries : lecture si publique OU owner, écriture owner
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_select"  ON diary_entries FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "diary_insert"  ON diary_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diary_update"  ON diary_entries FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "diary_delete"  ON diary_entries FOR DELETE
  USING (auth.uid() = user_id);

-- diary_likes : lecture publique, insert/delete owner
ALTER TABLE diary_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_likes_select" ON diary_likes FOR SELECT USING (true);
CREATE POLICY "diary_likes_insert" ON diary_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diary_likes_delete" ON diary_likes FOR DELETE USING (auth.uid() = user_id);

-- diary_comments : lecture publique (la privacy est héritée de l'entrée parent), write owner
ALTER TABLE diary_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_comments_select" ON diary_comments FOR SELECT USING (true);
CREATE POLICY "diary_comments_insert" ON diary_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diary_comments_update" ON diary_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "diary_comments_delete" ON diary_comments FOR DELETE USING (auth.uid() = user_id);

-- follows : lecture publique, write owner
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- notifications : lecture owner uniquement
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- feed_events : lecture owner uniquement, écriture via service role (fan-out)
ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_events_select" ON feed_events FOR SELECT USING (auth.uid() = user_id);

-- saved_albums / saved_tracks : owner only
ALTER TABLE saved_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_albums_select" ON saved_albums FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_albums_insert" ON saved_albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_albums_delete" ON saved_albums FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE saved_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_tracks_select" ON saved_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_tracks_insert" ON saved_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_tracks_delete" ON saved_tracks FOR DELETE USING (auth.uid() = user_id);

-- user_favorite_albums : lecture publique, write owner
ALTER TABLE user_favorite_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_albums_select" ON user_favorite_albums FOR SELECT USING (true);
CREATE POLICY "fav_albums_insert" ON user_favorite_albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fav_albums_update" ON user_favorite_albums FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fav_albums_delete" ON user_favorite_albums FOR DELETE USING (auth.uid() = user_id);

-- recommendations : lecture sender ou destinataire, insert owner
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reco_select" ON recommendations FOR SELECT
  USING (auth.uid() = recommended_by_id OR auth.uid() = recommended_to_id OR recommended_to_id IS NULL);
CREATE POLICY "reco_insert" ON recommendations FOR INSERT WITH CHECK (auth.uid() = recommended_by_id);
CREATE POLICY "reco_delete" ON recommendations FOR DELETE USING (auth.uid() = recommended_by_id);

-- discover_items : lecture owner, écriture service role uniquement
ALTER TABLE discover_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discover_select" ON discover_items FOR SELECT USING (auth.uid() = user_id);

-- albums, artists, tracks, external_ids : lecture publique (catalogue)
ALTER TABLE albums       ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "albums_select"       ON albums       FOR SELECT USING (true);
CREATE POLICY "artists_select"      ON artists      FOR SELECT USING (true);
CREATE POLICY "tracks_select"       ON tracks       FOR SELECT USING (true);
CREATE POLICY "external_ids_select" ON external_ids FOR SELECT USING (true);
