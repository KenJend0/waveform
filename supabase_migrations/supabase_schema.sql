-- ============================================================
-- SCHÉMA DE RÉFÉRENCE — WAVEFORM
-- Généré automatiquement via `npx supabase db dump --linked --schema public`
-- le 2026-06-30, après l'audit pré-V1 (voir AUDIT_SUPABASE_V1.md).
--
-- Ce fichier est un DUMP FIDÈLE de la production (tables, vues, vues
-- matérialisées, fonctions, triggers, policies RLS, index, grants).
-- Contrairement à l'ancienne version maintenue à la main, il ne devrait
-- plus diverger silencieusement de la prod — à régénérer avec la même
-- commande après chaque changement de schéma significatif.
--
-- Ne pas éditer à la main : appliquer les changements via une nouvelle
-- migration dans supabase_migrations/, puis régénérer ce fichier.
-- ============================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."delete_user_account"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fuzzy_search_albums"("query_text" "text", "result_limit" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "cover_url" "text", "release_date" "date", "artist_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT a.id, a.title, a.cover_url, a.release_date, ar.name AS artist_name
  FROM   albums a
  LEFT JOIN artists ar ON ar.id = a.artist_id
  WHERE  similarity(a.title, query_text) > 0.25
  AND    a.type != 'Single'
  ORDER  BY similarity(a.title, query_text) DESC
  LIMIT  result_limit;
$$;


ALTER FUNCTION "public"."fuzzy_search_albums"("query_text" "text", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fuzzy_search_artists"("query_text" "text", "result_limit" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "name" "text", "image_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT id, name, image_url
  FROM   artists
  WHERE  similarity(name, query_text) > 0.25
  ORDER  BY similarity(name, query_text) DESC
  LIMIT  result_limit;
$$;


ALTER FUNCTION "public"."fuzzy_search_artists"("query_text" "text", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fuzzy_search_tracks"("query_text" "text", "result_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "title" "text", "album_id" "uuid", "album_title" "text", "album_cover" "text", "artist_id" "uuid", "artist_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    t.id,
    t.title,
    a.id          AS album_id,
    a.title       AS album_title,
    a.cover_url   AS album_cover,
    ar.id         AS artist_id,
    ar.name       AS artist_name
  FROM   tracks t
  LEFT JOIN albums  a  ON a.id  = t.album_id
  LEFT JOIN artists ar ON ar.id = a.artist_id
  WHERE  similarity(t.title, query_text) > 0.25
  ORDER  BY similarity(t.title, query_text) DESC
  LIMIT  result_limit;
$$;


ALTER FUNCTION "public"."fuzzy_search_tracks"("query_text" "text", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_albums"("result_limit" integer DEFAULT 20) RETURNS TABLE("album_id" "uuid", "album_title" "text", "artist_name" "text", "cover_url" "text", "activity_count" integer, "unique_users" integer, "reviews_count" integer, "recent_unique_users" integer, "trend_score" double precision, "delta" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH params AS (
    SELECT
      now() - interval '7 days' AS current_start,
      now() - interval '2 days' AS recent_start,
      now() - interval '8 days' AS previous_start,
      now() - interval '1 day' AS previous_end
  ),
  current_activity AS (
    SELECT
      de.album_id,
      count(*)::int AS activity_count,
      count(distinct de.user_id)::int AS unique_users,
      count(*) FILTER (WHERE de.review_body IS NOT NULL AND de.review_body <> '')::int AS reviews_count,
      count(distinct de.user_id) FILTER (WHERE de.created_at >= p.recent_start)::int AS recent_unique_users,
      max(de.created_at) AS latest_activity
    FROM diary_entries de
    CROSS JOIN params p
    WHERE de.created_at >= p.current_start
      AND de.is_public = true
    GROUP BY de.album_id
  ),
  current_scored AS (
    SELECT
      ca.*,
      (
        ca.unique_users * 3.0
        + ca.activity_count * 0.5
        + ca.reviews_count * 1.5
        + ca.recent_unique_users * 1.0
      )::double precision AS score
    FROM current_activity ca
  ),
  previous_activity AS (
    SELECT
      de.album_id,
      count(*)::int AS activity_count,
      count(distinct de.user_id)::int AS unique_users,
      count(*) FILTER (WHERE de.review_body IS NOT NULL AND de.review_body <> '')::int AS reviews_count,
      count(distinct de.user_id) FILTER (WHERE de.created_at >= (SELECT previous_end - interval '2 days' FROM params))::int AS recent_unique_users,
      max(de.created_at) AS latest_activity
    FROM diary_entries de
    CROSS JOIN params p
    WHERE de.created_at >= p.previous_start
      AND de.created_at < p.previous_end
      AND de.is_public = true
    GROUP BY de.album_id
  ),
  previous_scored AS (
    SELECT
      pa.*,
      (
        pa.unique_users * 3.0
        + pa.activity_count * 0.5
        + pa.reviews_count * 1.5
        + pa.recent_unique_users * 1.0
      )::double precision AS score
    FROM previous_activity pa
  ),
  previous_top AS (
    SELECT album_id, rank
    FROM (
      SELECT
        ps.album_id,
        row_number() OVER (
          ORDER BY ps.score DESC, ps.unique_users DESC, ps.activity_count DESC, ps.reviews_count DESC, ps.latest_activity DESC, ps.album_id
        )::int AS rank
      FROM previous_scored ps
    ) ranked
    WHERE rank <= result_limit
  ),
  current_top AS (
    SELECT
      cs.*,
      row_number() OVER (
        ORDER BY cs.score DESC, cs.unique_users DESC, cs.activity_count DESC, cs.reviews_count DESC, cs.latest_activity DESC, cs.album_id
      )::int AS rank
    FROM current_scored cs
  )
  SELECT
    ct.album_id,
    a.title AS album_title,
    ar.name AS artist_name,
    a.cover_url,
    ct.activity_count,
    ct.unique_users,
    ct.reviews_count,
    ct.recent_unique_users,
    ct.score AS trend_score,
    CASE WHEN pt.rank IS NULL THEN NULL ELSE pt.rank - ct.rank END AS delta
  FROM current_top ct
  JOIN albums a ON a.id = ct.album_id
  JOIN artists ar ON ar.id = a.artist_id
  LEFT JOIN previous_top pt ON pt.album_id = ct.album_id
  WHERE ct.rank <= result_limit
  ORDER BY ct.rank;
$$;


ALTER FUNCTION "public"."get_trending_albums"("result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_tracks"("result_limit" integer DEFAULT 20) RETURNS TABLE("track_id" "uuid", "track_title" "text", "artist_id" "uuid", "artist_name" "text", "album_id" "uuid", "album_title" "text", "cover_url" "text", "avg_rating" numeric, "activity_count" integer, "unique_users" integer, "reviews_count" integer, "recent_unique_users" integer, "trend_score" double precision, "delta" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH params AS (
    SELECT
      now() - interval '7 days' AS current_start,
      now() - interval '2 days' AS recent_start,
      now() - interval '8 days' AS previous_start,
      now() - interval '1 day' AS previous_end
  ),
  current_activity AS (
    SELECT
      tde.track_id,
      count(*)::int AS activity_count,
      count(distinct tde.user_id)::int AS unique_users,
      count(*) FILTER (WHERE tde.review_body IS NOT NULL AND tde.review_body <> '')::int AS reviews_count,
      count(distinct tde.user_id) FILTER (WHERE tde.created_at >= p.recent_start)::int AS recent_unique_users,
      round((avg(tde.rating) FILTER (WHERE tde.rating IS NOT NULL))::numeric, 1) AS avg_rating,
      max(tde.created_at) AS latest_activity
    FROM track_diary_entries tde
    CROSS JOIN params p
    WHERE tde.created_at >= p.current_start
      AND tde.is_public = true
    GROUP BY tde.track_id
  ),
  current_scored AS (
    SELECT
      ca.*,
      (
        ca.unique_users * 3.0
        + ca.activity_count * 0.5
        + ca.reviews_count * 1.5
        + ca.recent_unique_users * 1.0
      )::double precision AS score
    FROM current_activity ca
  ),
  previous_activity AS (
    SELECT
      tde.track_id,
      count(*)::int AS activity_count,
      count(distinct tde.user_id)::int AS unique_users,
      count(*) FILTER (WHERE tde.review_body IS NOT NULL AND tde.review_body <> '')::int AS reviews_count,
      count(distinct tde.user_id) FILTER (WHERE tde.created_at >= (SELECT previous_end - interval '2 days' FROM params))::int AS recent_unique_users,
      max(tde.created_at) AS latest_activity
    FROM track_diary_entries tde
    CROSS JOIN params p
    WHERE tde.created_at >= p.previous_start
      AND tde.created_at < p.previous_end
      AND tde.is_public = true
    GROUP BY tde.track_id
  ),
  previous_scored AS (
    SELECT
      pa.*,
      (
        pa.unique_users * 3.0
        + pa.activity_count * 0.5
        + pa.reviews_count * 1.5
        + pa.recent_unique_users * 1.0
      )::double precision AS score
    FROM previous_activity pa
  ),
  previous_top AS (
    SELECT track_id, rank
    FROM (
      SELECT
        ps.track_id,
        row_number() OVER (
          ORDER BY ps.score DESC, ps.unique_users DESC, ps.activity_count DESC, ps.reviews_count DESC, ps.latest_activity DESC, ps.track_id
        )::int AS rank
      FROM previous_scored ps
    ) ranked
    WHERE rank <= result_limit
  ),
  current_top AS (
    SELECT
      cs.*,
      row_number() OVER (
        ORDER BY cs.score DESC, cs.unique_users DESC, cs.activity_count DESC, cs.reviews_count DESC, cs.latest_activity DESC, cs.track_id
      )::int AS rank
    FROM current_scored cs
  )
  SELECT
    ct.track_id,
    t.title AS track_title,
    ar.id AS artist_id,
    ar.name AS artist_name,
    a.id AS album_id,
    a.title AS album_title,
    a.cover_url,
    ct.avg_rating,
    ct.activity_count,
    ct.unique_users,
    ct.reviews_count,
    ct.recent_unique_users,
    ct.score AS trend_score,
    CASE WHEN pt.rank IS NULL THEN NULL ELSE pt.rank - ct.rank END AS delta
  FROM current_top ct
  JOIN tracks t ON t.id = ct.track_id
  JOIN albums a ON a.id = t.album_id
  JOIN artists ar ON ar.id = t.artist_id
  LEFT JOIN previous_top pt ON pt.track_id = ct.track_id
  WHERE ct.rank <= result_limit
  ORDER BY ct.rank;
$$;


ALTER FUNCTION "public"."get_trending_tracks"("result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  SELECT unaccent('unaccent'::regdictionary, $1)
$_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_album_stats_mat"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY album_stats_mat;
END;
$$;


ALTER FUNCTION "public"."refresh_album_stats_mat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_favorite_albums"("p_albums" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
  v_distinct_positions int;
  v_distinct_albums int;
  v_existing_albums int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_albums IS NULL OR jsonb_typeof(p_albums) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  v_count := jsonb_array_length(p_albums);
  IF v_count > 3 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF v_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_albums) elem
      WHERE elem->>'album_id' IS NULL OR elem->>'position' IS NULL
    ) THEN
      RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_albums) elem
      WHERE (elem->>'position')::int NOT BETWEEN 1 AND 3
    ) THEN
      RAISE EXCEPTION 'INVALID_POSITION';
    END IF;

    SELECT count(DISTINCT (elem->>'position')::int)
    INTO v_distinct_positions
    FROM jsonb_array_elements(p_albums) elem;

    IF v_distinct_positions <> v_count THEN
      RAISE EXCEPTION 'DUPLICATE_POSITION';
    END IF;

    SELECT count(DISTINCT (elem->>'album_id')::uuid)
    INTO v_distinct_albums
    FROM jsonb_array_elements(p_albums) elem;

    IF v_distinct_albums <> v_count THEN
      RAISE EXCEPTION 'DUPLICATE_ALBUM';
    END IF;

    SELECT count(*) INTO v_existing_albums
    FROM albums a
    JOIN jsonb_array_elements(p_albums) elem ON a.id = (elem->>'album_id')::uuid;

    IF v_existing_albums <> v_count THEN
      RAISE EXCEPTION 'ALBUM_NOT_FOUND';
    END IF;
  END IF;

  DELETE FROM user_favorite_albums WHERE user_id = v_user_id;

  IF v_count > 0 THEN
    INSERT INTO user_favorite_albums (user_id, album_id, position)
    SELECT v_user_id, (elem->>'album_id')::uuid, (elem->>'position')::int
    FROM jsonb_array_elements(p_albums) elem;
  END IF;
END;
$$;


ALTER FUNCTION "public"."replace_favorite_albums"("p_albums" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.diary_entries SET comments_count = comments_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.diary_entries SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_entry_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.diary_entries SET likes_count = likes_count + 1 WHERE id = NEW.entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.diary_entries SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_entry_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_list_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."update_list_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_track_entry_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."update_track_entry_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_track_entry_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."update_track_entry_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."album_featured_artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "album_id" "uuid" NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "joinphrase" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."album_featured_artists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."album_genre_votes" (
    "user_id" "uuid" NOT NULL,
    "album_id" "uuid" NOT NULL,
    "genre_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."album_genre_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."album_genres" (
    "album_id" "uuid" NOT NULL,
    "genre_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "weight" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "album_genres_source_check" CHECK (("source" = ANY (ARRAY['lastfm'::"text", 'musicbrainz'::"text", 'community'::"text"])))
);


ALTER TABLE "public"."album_genres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."album_metadata" (
    "album_id" "uuid" NOT NULL,
    "description" "text",
    "description_src" "text",
    "lastfm_url" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lastfm_listeners" integer,
    "lastfm_playcount" integer,
    "spotify_url" "text",
    "apple_music_url" "text",
    "deezer_url" "text",
    "streaming_attempts" integer DEFAULT 0 NOT NULL,
    "tag_attempts" integer DEFAULT 0 NOT NULL,
    "tags_checked_at" timestamp with time zone,
    CONSTRAINT "album_metadata_description_src_check" CHECK (("description_src" = ANY (ARRAY['lastfm'::"text", 'wikipedia'::"text"])))
);


ALTER TABLE "public"."album_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diary_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "album_id" "uuid" NOT NULL,
    "listened_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "re_listen" boolean DEFAULT false NOT NULL,
    "rating" smallint,
    "review_title" "text",
    "review_body" "text",
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "rec_source" "text",
    CONSTRAINT "diary_entries_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= 0) AND ("rating" <= 10))))
);


ALTER TABLE "public"."diary_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."album_stats" WITH ("security_invoker"='on') AS
 SELECT "album_id",
    ("count"(*))::integer AS "listeners_count",
    ("count"(*) FILTER (WHERE (("review_body" IS NOT NULL) AND ("review_body" <> ''::"text"))))::integer AS "reviews_count",
    "round"("avg"("rating"), 1) AS "avg_rating"
   FROM ( SELECT DISTINCT ON ("diary_entries"."user_id", "diary_entries"."album_id") "diary_entries"."album_id",
            "diary_entries"."user_id",
            "diary_entries"."rating",
            "diary_entries"."review_body",
            "diary_entries"."created_at"
           FROM "public"."diary_entries"
          ORDER BY "diary_entries"."user_id", "diary_entries"."album_id", "diary_entries"."created_at" DESC) "latest"
  GROUP BY "album_id";


ALTER VIEW "public"."album_stats" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."album_stats_mat" AS
 SELECT "album_id",
    "round"("avg"("rating"), 2) AS "avg_rating",
    "count"(DISTINCT "user_id") AS "listeners_count"
   FROM "public"."diary_entries"
  WHERE ("rating" IS NOT NULL)
  GROUP BY "album_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."album_stats_mat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."albums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "date",
    "cover_url" "text",
    "mbid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", "public"."immutable_unaccent"(COALESCE("title", ''::"text")))) STORED,
    "type" "text" DEFAULT 'Album'::"text" NOT NULL,
    "canonical_key" "text"
);


ALTER TABLE "public"."albums" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "mbid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "image_url" "text",
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", "public"."immutable_unaccent"(COALESCE("name", ''::"text")))) STORED
);


ALTER TABLE "public"."artists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "reason" "text" DEFAULT 'inappropriate'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_reports_content_type_check" CHECK (("content_type" = ANY (ARRAY['diary_entry'::"text", 'diary_comment'::"text", 'track_diary_entry'::"text", 'track_diary_comment'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_health" (
    "job_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "last_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "detail" "text",
    CONSTRAINT "cron_health_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failure'::"text"])))
);


ALTER TABLE "public"."cron_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curator_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "album_id" "uuid" NOT NULL,
    "curator_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curator_picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diary_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "parent_comment_id" "uuid",
    CONSTRAINT "diary_comments_body_check" CHECK (("length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."diary_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diary_likes" (
    "user_id" "uuid" NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."diary_likes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."diary_entry_stats" WITH ("security_invoker"='on') AS
 SELECT "e"."id" AS "entry_id",
    COALESCE("l"."likes_count", 0) AS "likes_count",
    COALESCE("c"."comments_count", 0) AS "comments_count"
   FROM (("public"."diary_entries" "e"
     LEFT JOIN ( SELECT "diary_likes"."entry_id",
            ("count"(*))::integer AS "likes_count"
           FROM "public"."diary_likes"
          GROUP BY "diary_likes"."entry_id") "l" ON (("l"."entry_id" = "e"."id")))
     LEFT JOIN ( SELECT "diary_comments"."entry_id",
            ("count"(*))::integer AS "comments_count"
           FROM "public"."diary_comments"
          GROUP BY "diary_comments"."entry_id") "c" ON (("c"."entry_id" = "e"."id")));


ALTER VIEW "public"."diary_entry_stats" OWNER TO "authenticated";


CREATE TABLE IF NOT EXISTS "public"."external_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "source_label" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "raw_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "processed_count" integer DEFAULT 0 NOT NULL,
    "matched_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "list_id" "uuid",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "last_processed_at" timestamp with time zone,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "external_imports_source_check" CHECK (("source" = ANY (ARRAY['lastfm'::"text", 'rym'::"text"]))),
    CONSTRAINT "external_imports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'matching'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."external_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "entry_id" "uuid",
    "album_id" "uuid",
    "comment_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "followee_id" "uuid",
    "track_comment_id" "uuid",
    CONSTRAINT "feed_events_type_check" CHECK (("type" = ANY (ARRAY['diary_entry'::"text", 'like'::"text", 'comment'::"text", 'follow'::"text", 'comment_reply'::"text", 'track_diary_entry'::"text", 'track_like'::"text", 'track_comment'::"text"])))
);


ALTER TABLE "public"."feed_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "followee_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_follow_self" CHECK (("follower_id" <> "followee_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."genres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."genres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "artist_id" "uuid",
    "artist_mbid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "album_id" "uuid",
    "track_id" "uuid",
    "position" integer,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "list_items_one_type" CHECK ((((("album_id" IS NOT NULL))::integer + (("track_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "public"."list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."list_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."list_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "event_name" "text" NOT NULL,
    "surface" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."product_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "username_changed" boolean DEFAULT false,
    "last_seen_activity_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_feedback" (
    "user_id" "uuid" NOT NULL,
    "album_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "track_id" "uuid",
    CONSTRAINT "recommendation_feedback_one_target" CHECK (((("album_id" IS NOT NULL) AND ("track_id" IS NULL)) OR (("album_id" IS NULL) AND ("track_id" IS NOT NULL))))
);


ALTER TABLE "public"."recommendation_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "method" "text" NOT NULL,
    "k" integer NOT NULL,
    "precision_at_k" double precision,
    "recall_at_k" double precision,
    "ndcg_at_k" double precision,
    "n_users" integer,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recommendation_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_cache" (
    "key" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."similar_albums_cache" (
    "album_id" "uuid" NOT NULL,
    "similar_albums" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."similar_albums_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_diary_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."track_diary_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_diary_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "album_id" "uuid" NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "rating" smallint,
    "review_title" "text",
    "review_body" "text",
    "listened_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rec_source" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "track_diary_entries_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 10)))
);


ALTER TABLE "public"."track_diary_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."track_diary_entry_stats" AS
 SELECT "id" AS "entry_id",
    ("likes_count")::bigint AS "likes_count",
    ("comments_count")::bigint AS "comments_count"
   FROM "public"."track_diary_entries";


ALTER VIEW "public"."track_diary_entry_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_diary_likes" (
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."track_diary_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_featured_artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "track_id" "uuid" NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "joinphrase" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."track_featured_artists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_metadata" (
    "track_id" "uuid" NOT NULL,
    "spotify_url" "text",
    "apple_music_url" "text",
    "deezer_url" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."track_metadata" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."track_stats" AS
 SELECT "track_id",
    "count"(*) FILTER (WHERE ("rating" IS NOT NULL)) AS "ratings_count",
    "round"("avg"("rating") FILTER (WHERE ("rating" IS NOT NULL)), 1) AS "avg_rating",
    "count"(DISTINCT "user_id") AS "listeners_count",
    "count"(*) FILTER (WHERE (("review_body" IS NOT NULL) AND ("review_body" <> ''::"text"))) AS "reviews_count"
   FROM "public"."track_diary_entries"
  GROUP BY "track_id";


ALTER VIEW "public"."track_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "album_id" "uuid" NOT NULL,
    "artist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "duration_ms" integer,
    "track_no" integer,
    "disc_no" integer,
    "mbid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "canonical_title" "text"
);


ALTER TABLE "public"."tracks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "no_self_block" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorite_albums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "album_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_favorite_albums_position_check" CHECK ((("position" >= 1) AND ("position" <= 3)))
);


ALTER TABLE "public"."user_favorite_albums" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."user_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_recommendations" (
    "user_id" "uuid" NOT NULL,
    "album_id" "uuid" NOT NULL,
    "score" double precision NOT NULL,
    "method" "text" NOT NULL,
    "rank" integer NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_similarity" (
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "score" double precision NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_similarity_check" CHECK (("user_a" <> "user_b")),
    CONSTRAINT "user_similarity_score_check" CHECK ((("score" >= (0)::double precision) AND ("score" <= (1)::double precision)))
);


ALTER TABLE "public"."user_similarity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_taste_vectors" (
    "user_id" "uuid" NOT NULL,
    "vector" double precision[] NOT NULL,
    "album_index" "jsonb" NOT NULL,
    "n_ratings" integer DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_taste_vectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_track_recommendations" (
    "user_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "score" double precision NOT NULL,
    "method" "text" NOT NULL,
    "rank" integer NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_track_recommendations" OWNER TO "postgres";


ALTER TABLE ONLY "public"."album_featured_artists"
    ADD CONSTRAINT "album_featured_artists_album_id_artist_id_key" UNIQUE ("album_id", "artist_id");



ALTER TABLE ONLY "public"."album_featured_artists"
    ADD CONSTRAINT "album_featured_artists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."album_genre_votes"
    ADD CONSTRAINT "album_genre_votes_pkey" PRIMARY KEY ("user_id", "album_id", "genre_id");



ALTER TABLE ONLY "public"."album_genres"
    ADD CONSTRAINT "album_genres_pkey" PRIMARY KEY ("album_id", "genre_id");



ALTER TABLE ONLY "public"."album_metadata"
    ADD CONSTRAINT "album_metadata_pkey" PRIMARY KEY ("album_id");



ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "artists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_content_type_content_id_key" UNIQUE ("reporter_id", "content_type", "content_id");



ALTER TABLE ONLY "public"."cron_health"
    ADD CONSTRAINT "cron_health_pkey" PRIMARY KEY ("job_name");



ALTER TABLE ONLY "public"."curator_picks"
    ADD CONSTRAINT "curator_picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diary_comments"
    ADD CONSTRAINT "diary_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_user_id_album_id_listened_at_key" UNIQUE ("user_id", "album_id", "listened_at");



ALTER TABLE ONLY "public"."diary_likes"
    ADD CONSTRAINT "diary_likes_pkey" PRIMARY KEY ("user_id", "entry_id");



ALTER TABLE ONLY "public"."external_imports"
    ADD CONSTRAINT "external_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "followee_id");



ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."import_requests"
    ADD CONSTRAINT "import_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_likes"
    ADD CONSTRAINT "list_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."list_likes"
    ADD CONSTRAINT "list_likes_user_id_list_id_key" UNIQUE ("user_id", "list_id");



ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_metrics"
    ADD CONSTRAINT "recommendation_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_lists"
    ADD CONSTRAINT "saved_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_lists"
    ADD CONSTRAINT "saved_lists_user_id_list_id_key" UNIQUE ("user_id", "list_id");



ALTER TABLE ONLY "public"."search_cache"
    ADD CONSTRAINT "search_cache_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."similar_albums_cache"
    ADD CONSTRAINT "similar_albums_cache_pkey" PRIMARY KEY ("album_id");



ALTER TABLE ONLY "public"."track_diary_comments"
    ADD CONSTRAINT "track_diary_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_user_id_track_id_listened_at_key" UNIQUE ("user_id", "track_id", "listened_at");



ALTER TABLE ONLY "public"."track_diary_likes"
    ADD CONSTRAINT "track_diary_likes_pkey" PRIMARY KEY ("entry_id", "user_id");



ALTER TABLE ONLY "public"."track_featured_artists"
    ADD CONSTRAINT "track_featured_artists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."track_featured_artists"
    ADD CONSTRAINT "track_featured_artists_track_id_artist_id_key" UNIQUE ("track_id", "artist_id");



ALTER TABLE ONLY "public"."track_metadata"
    ADD CONSTRAINT "track_metadata_pkey" PRIMARY KEY ("track_id");



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "uq_albums_mbid" UNIQUE ("mbid");



ALTER TABLE ONLY "public"."artists"
    ADD CONSTRAINT "uq_artists_mbid" UNIQUE ("mbid");



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "uq_diary_user_album_day" UNIQUE ("user_id", "album_id", "listened_at");



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "uq_tracks_mbid" UNIQUE ("mbid");



ALTER TABLE ONLY "public"."user_favorite_albums"
    ADD CONSTRAINT "uq_user_album_favorite" UNIQUE ("user_id", "album_id");



ALTER TABLE ONLY "public"."user_favorite_albums"
    ADD CONSTRAINT "uq_user_favorite_albums" UNIQUE ("user_id", "position");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_favorite_albums"
    ADD CONSTRAINT "user_favorite_albums_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_lists"
    ADD CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recommendations"
    ADD CONSTRAINT "user_recommendations_pkey" PRIMARY KEY ("user_id", "album_id");



ALTER TABLE ONLY "public"."user_similarity"
    ADD CONSTRAINT "user_similarity_pkey" PRIMARY KEY ("user_a", "user_b");



ALTER TABLE ONLY "public"."user_taste_vectors"
    ADD CONSTRAINT "user_taste_vectors_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_track_recommendations"
    ADD CONSTRAINT "user_track_recommendations_pkey" PRIMARY KEY ("user_id", "track_id");



CREATE INDEX "album_metadata_spotify_url_idx" ON "public"."album_metadata" USING "btree" ("spotify_url") WHERE ("spotify_url" IS NULL);



CREATE INDEX "album_metadata_streaming_attempts_idx" ON "public"."album_metadata" USING "btree" ("streaming_attempts") WHERE (("spotify_url" IS NULL) AND ("apple_music_url" IS NULL) AND ("deezer_url" IS NULL));



CREATE INDEX "album_metadata_tag_retry_idx" ON "public"."album_metadata" USING "btree" ("tags_checked_at", "tag_attempts");



CREATE UNIQUE INDEX "album_stats_mat_album_id_idx" ON "public"."album_stats_mat" USING "btree" ("album_id");



CREATE INDEX "curator_picks_created_at_idx" ON "public"."curator_picks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_album_featured_artists_album_id" ON "public"."album_featured_artists" USING "btree" ("album_id");



CREATE INDEX "idx_album_featured_artists_artist_id" ON "public"."album_featured_artists" USING "btree" ("artist_id");



CREATE INDEX "idx_album_genres_album_id" ON "public"."album_genres" USING "btree" ("album_id");



CREATE INDEX "idx_album_genres_genre_id" ON "public"."album_genres" USING "btree" ("genre_id");



CREATE UNIQUE INDEX "idx_album_stats_mat_album_id" ON "public"."album_stats_mat" USING "btree" ("album_id");



CREATE INDEX "idx_albums_artist" ON "public"."albums" USING "btree" ("artist_id");



CREATE INDEX "idx_albums_artist_canonical_key" ON "public"."albums" USING "btree" ("artist_id", "canonical_key");



CREATE INDEX "idx_albums_artist_id" ON "public"."albums" USING "btree" ("artist_id");



CREATE INDEX "idx_albums_mbid" ON "public"."albums" USING "btree" ("mbid");



CREATE INDEX "idx_albums_search_vector" ON "public"."albums" USING "gin" ("search_vector");



CREATE INDEX "idx_albums_title_trgm" ON "public"."albums" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_albums_type" ON "public"."albums" USING "btree" ("type");



CREATE INDEX "idx_artists_mbid" ON "public"."artists" USING "btree" ("mbid");



CREATE INDEX "idx_artists_name" ON "public"."artists" USING "btree" ("name");



CREATE INDEX "idx_artists_name_trgm" ON "public"."artists" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_artists_search_vector" ON "public"."artists" USING "gin" ("search_vector");



CREATE INDEX "idx_content_reports_created" ON "public"."content_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_diary_comments_entry" ON "public"."diary_comments" USING "btree" ("entry_id");



CREATE INDEX "idx_diary_comments_entry_id" ON "public"."diary_comments" USING "btree" ("entry_id");



CREATE INDEX "idx_diary_comments_parent" ON "public"."diary_comments" USING "btree" ("parent_comment_id") WHERE ("parent_comment_id" IS NOT NULL);



CREATE INDEX "idx_diary_comments_user" ON "public"."diary_comments" USING "btree" ("user_id");



CREATE INDEX "idx_diary_comments_user_id" ON "public"."diary_comments" USING "btree" ("user_id");



CREATE INDEX "idx_diary_entries_album_user" ON "public"."diary_entries" USING "btree" ("album_id", "user_id");



CREATE INDEX "idx_diary_entries_public_created" ON "public"."diary_entries" USING "btree" ("is_public", "created_at" DESC) WHERE ("is_public" = true);



CREATE INDEX "idx_diary_entries_user_listened" ON "public"."diary_entries" USING "btree" ("user_id", "listened_at" DESC);



CREATE INDEX "idx_diary_entries_user_rating" ON "public"."diary_entries" USING "btree" ("user_id", "rating");



CREATE INDEX "idx_diary_likes_entry" ON "public"."diary_likes" USING "btree" ("entry_id");



CREATE INDEX "idx_diary_likes_entry_id" ON "public"."diary_likes" USING "btree" ("entry_id");



CREATE INDEX "idx_diary_likes_user" ON "public"."diary_likes" USING "btree" ("user_id");



CREATE INDEX "idx_diary_likes_user_entry" ON "public"."diary_likes" USING "btree" ("user_id", "entry_id");



CREATE INDEX "idx_diary_likes_user_id" ON "public"."diary_likes" USING "btree" ("user_id");



CREATE INDEX "idx_external_imports_user_source_created" ON "public"."external_imports" USING "btree" ("user_id", "source", "created_at");



CREATE INDEX "idx_feed_events_actor_id" ON "public"."feed_events" USING "btree" ("actor_id");



CREATE INDEX "idx_feed_events_comment_id" ON "public"."feed_events" USING "btree" ("comment_id") WHERE ("comment_id" IS NOT NULL);



CREATE INDEX "idx_feed_events_created_at" ON "public"."feed_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feed_events_followee_id" ON "public"."feed_events" USING "btree" ("followee_id") WHERE ("followee_id" IS NOT NULL);



CREATE INDEX "idx_feed_events_track_comment_id" ON "public"."feed_events" USING "btree" ("track_comment_id") WHERE ("track_comment_id" IS NOT NULL);



CREATE INDEX "idx_feed_events_user_created" ON "public"."feed_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_feed_user_created" ON "public"."feed_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_follows_followee" ON "public"."follows" USING "btree" ("followee_id");



CREATE INDEX "idx_follows_followee_id" ON "public"."follows" USING "btree" ("followee_id");



CREATE INDEX "idx_follows_follower" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_follower_id" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_import_requests_user_created_at" ON "public"."import_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_list_items_album_id" ON "public"."list_items" USING "btree" ("album_id");



CREATE INDEX "idx_list_items_list_id" ON "public"."list_items" USING "btree" ("list_id");



CREATE INDEX "idx_list_items_track_id" ON "public"."list_items" USING "btree" ("track_id");



CREATE INDEX "idx_list_likes_list_id" ON "public"."list_likes" USING "btree" ("list_id");



CREATE INDEX "idx_list_likes_user_id" ON "public"."list_likes" USING "btree" ("user_id");



CREATE INDEX "idx_product_events_event_name_created_at" ON "public"."product_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_product_events_user_id_created_at" ON "public"."product_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_saved_lists_user_id" ON "public"."saved_lists" USING "btree" ("user_id");



CREATE INDEX "idx_search_cache_expires" ON "public"."search_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_track_diary_comments_entry_id" ON "public"."track_diary_comments" USING "btree" ("entry_id");



CREATE INDEX "idx_track_diary_comments_parent" ON "public"."track_diary_comments" USING "btree" ("parent_comment_id") WHERE ("parent_comment_id" IS NOT NULL);



CREATE INDEX "idx_track_diary_comments_user_id" ON "public"."track_diary_comments" USING "btree" ("user_id");



CREATE INDEX "idx_track_diary_entries_album_id" ON "public"."track_diary_entries" USING "btree" ("album_id");



CREATE INDEX "idx_track_diary_entries_created_at" ON "public"."track_diary_entries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_track_diary_entries_public_created" ON "public"."track_diary_entries" USING "btree" ("created_at" DESC) WHERE ("is_public" = true);



CREATE INDEX "idx_track_diary_entries_track_id" ON "public"."track_diary_entries" USING "btree" ("track_id");



CREATE INDEX "idx_track_diary_entries_user_id" ON "public"."track_diary_entries" USING "btree" ("user_id");



CREATE INDEX "idx_track_diary_likes_entry_id" ON "public"."track_diary_likes" USING "btree" ("entry_id");



CREATE INDEX "idx_track_diary_likes_user_id" ON "public"."track_diary_likes" USING "btree" ("user_id");



CREATE INDEX "idx_track_featured_artists_artist_id" ON "public"."track_featured_artists" USING "btree" ("artist_id");



CREATE INDEX "idx_track_featured_artists_track_id" ON "public"."track_featured_artists" USING "btree" ("track_id");



CREATE INDEX "idx_track_metadata_fetched_at" ON "public"."track_metadata" USING "btree" ("fetched_at");



CREATE INDEX "idx_tracks_album" ON "public"."tracks" USING "btree" ("album_id");



CREATE INDEX "idx_tracks_album_id" ON "public"."tracks" USING "btree" ("album_id");



CREATE INDEX "idx_tracks_artist" ON "public"."tracks" USING "btree" ("artist_id");



CREATE INDEX "idx_tracks_artist_canonical_title" ON "public"."tracks" USING "btree" ("artist_id", "canonical_title");



CREATE INDEX "idx_tracks_artist_id" ON "public"."tracks" USING "btree" ("artist_id");



CREATE INDEX "idx_tracks_mbid" ON "public"."tracks" USING "btree" ("mbid");



CREATE INDEX "idx_tracks_title_trgm" ON "public"."tracks" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_trgm_albums_title" ON "public"."albums" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_trgm_artists_name" ON "public"."artists" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_trgm_tracks_title" ON "public"."tracks" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_user_blocks_blocked" ON "public"."user_blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_user_blocks_blocker" ON "public"."user_blocks" USING "btree" ("blocker_id");



CREATE INDEX "idx_user_favorite_albums_album_id" ON "public"."user_favorite_albums" USING "btree" ("album_id");



CREATE INDEX "idx_user_favorite_albums_position" ON "public"."user_favorite_albums" USING "btree" ("user_id", "position");



CREATE INDEX "idx_user_favorite_albums_user_id" ON "public"."user_favorite_albums" USING "btree" ("user_id");



CREATE INDEX "idx_user_lists_user_id" ON "public"."user_lists" USING "btree" ("user_id");



CREATE INDEX "idx_user_similarity_user_b_score" ON "public"."user_similarity" USING "btree" ("user_b", "score" DESC);



CREATE INDEX "ix_diary_album_date" ON "public"."diary_entries" USING "btree" ("album_id", "listened_at" DESC);



CREATE INDEX "ix_diary_user_date" ON "public"."diary_entries" USING "btree" ("user_id", "listened_at" DESC);



CREATE UNIQUE INDEX "list_items_album_unique" ON "public"."list_items" USING "btree" ("list_id", "album_id") WHERE ("album_id" IS NOT NULL);



CREATE UNIQUE INDEX "list_items_track_unique" ON "public"."list_items" USING "btree" ("list_id", "track_id") WHERE ("track_id" IS NOT NULL);



CREATE UNIQUE INDEX "recommendation_feedback_user_album_idx" ON "public"."recommendation_feedback" USING "btree" ("user_id", "album_id");



CREATE UNIQUE INDEX "recommendation_feedback_user_track_idx" ON "public"."recommendation_feedback" USING "btree" ("user_id", "track_id");



CREATE INDEX "similar_albums_cache_computed_at_idx" ON "public"."similar_albums_cache" USING "btree" ("computed_at");



CREATE UNIQUE INDEX "user_lists_one_default" ON "public"."user_lists" USING "btree" ("user_id") WHERE ("is_default" = true);



CREATE INDEX "user_recommendations_user_rank_idx" ON "public"."user_recommendations" USING "btree" ("user_id", "rank");



CREATE INDEX "user_similarity_user_a_score_idx" ON "public"."user_similarity" USING "btree" ("user_a", "score" DESC);



CREATE INDEX "user_track_recs_user_rank_idx" ON "public"."user_track_recommendations" USING "btree" ("user_id", "rank");



CREATE OR REPLACE TRIGGER "set_diary_updated_at" BEFORE UPDATE ON "public"."diary_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_entry_comments_count" AFTER INSERT OR DELETE ON "public"."diary_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_comments_count"();



CREATE OR REPLACE TRIGGER "trg_entry_likes_count" AFTER INSERT OR DELETE ON "public"."diary_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_likes_count"();



CREATE OR REPLACE TRIGGER "trg_list_likes_count" AFTER INSERT OR DELETE ON "public"."list_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_list_likes_count"();



CREATE OR REPLACE TRIGGER "trg_track_diary_entries_updated_at" BEFORE UPDATE ON "public"."track_diary_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_track_entry_comments_count" AFTER INSERT OR DELETE ON "public"."track_diary_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_track_entry_comments_count"();



CREATE OR REPLACE TRIGGER "trg_track_entry_likes_count" AFTER INSERT OR DELETE ON "public"."track_diary_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_track_entry_likes_count"();



ALTER TABLE ONLY "public"."album_featured_artists"
    ADD CONSTRAINT "album_featured_artists_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_featured_artists"
    ADD CONSTRAINT "album_featured_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_genre_votes"
    ADD CONSTRAINT "album_genre_votes_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_genre_votes"
    ADD CONSTRAINT "album_genre_votes_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_genre_votes"
    ADD CONSTRAINT "album_genre_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_genres"
    ADD CONSTRAINT "album_genres_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_genres"
    ADD CONSTRAINT "album_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."album_metadata"
    ADD CONSTRAINT "album_metadata_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curator_picks"
    ADD CONSTRAINT "curator_picks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curator_picks"
    ADD CONSTRAINT "curator_picks_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_comments"
    ADD CONSTRAINT "diary_comments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."diary_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_comments"
    ADD CONSTRAINT "diary_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."diary_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_likes"
    ADD CONSTRAINT "diary_likes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."diary_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_likes"
    ADD CONSTRAINT "diary_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_imports"
    ADD CONSTRAINT "external_imports_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."external_imports"
    ADD CONSTRAINT "external_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."diary_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."diary_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_track_comment_id_fkey" FOREIGN KEY ("track_comment_id") REFERENCES "public"."track_diary_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_events"
    ADD CONSTRAINT "feed_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_requests"
    ADD CONSTRAINT "import_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_items"
    ADD CONSTRAINT "list_items_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_likes"
    ADD CONSTRAINT "list_likes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."list_likes"
    ADD CONSTRAINT "list_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_lists"
    ADD CONSTRAINT "saved_lists_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_lists"
    ADD CONSTRAINT "saved_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."similar_albums_cache"
    ADD CONSTRAINT "similar_albums_cache_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_comments"
    ADD CONSTRAINT "track_diary_comments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."track_diary_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_comments"
    ADD CONSTRAINT "track_diary_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."track_diary_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_comments"
    ADD CONSTRAINT "track_diary_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_entries"
    ADD CONSTRAINT "track_diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_likes"
    ADD CONSTRAINT "track_diary_likes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."track_diary_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_diary_likes"
    ADD CONSTRAINT "track_diary_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_featured_artists"
    ADD CONSTRAINT "track_featured_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_featured_artists"
    ADD CONSTRAINT "track_featured_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_metadata"
    ADD CONSTRAINT "track_metadata_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorite_albums"
    ADD CONSTRAINT "user_favorite_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorite_albums"
    ADD CONSTRAINT "user_favorite_albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_lists"
    ADD CONSTRAINT "user_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recommendations"
    ADD CONSTRAINT "user_recommendations_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recommendations"
    ADD CONSTRAINT "user_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_similarity"
    ADD CONSTRAINT "user_similarity_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_similarity"
    ADD CONSTRAINT "user_similarity_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_taste_vectors"
    ADD CONSTRAINT "user_taste_vectors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_track_recommendations"
    ADD CONSTRAINT "user_track_recommendations_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_track_recommendations"
    ADD CONSTRAINT "user_track_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Lecture publique des votes" ON "public"."album_genre_votes" FOR SELECT USING (true);



CREATE POLICY "Users can insert their own feed events" ON "public"."feed_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs gèrent leurs propres votes" ON "public"."album_genre_votes" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."album_featured_artists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "album_featured_artists_select" ON "public"."album_featured_artists" FOR SELECT USING (true);



ALTER TABLE "public"."album_genre_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."album_genres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "album_genres_select" ON "public"."album_genres" FOR SELECT USING (true);



ALTER TABLE "public"."album_metadata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "album_metadata_select" ON "public"."album_metadata" FOR SELECT USING (true);



ALTER TABLE "public"."albums" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "albums_read_public" ON "public"."albums" FOR SELECT USING (true);



CREATE POLICY "albums_write_service" ON "public"."albums" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "allow authenticated album insert" ON "public"."albums" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "allow authenticated artist insert" ON "public"."artists" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "allow authenticated track insert" ON "public"."tracks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."artists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "artists_read_public" ON "public"."artists" FOR SELECT USING (true);



CREATE POLICY "artists_write_service" ON "public"."artists" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cron_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cron_health_select" ON "public"."cron_health" FOR SELECT USING (true);



ALTER TABLE "public"."curator_picks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diary_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diary_comments_delete_self" ON "public"."diary_comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "diary_comments_insert_self_on_public" ON "public"."diary_comments" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."diary_entries" "de"
  WHERE (("de"."id" = "diary_comments"."entry_id") AND ("de"."is_public" = true))))));



CREATE POLICY "diary_comments_select" ON "public"."diary_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."diary_entries" "de"
  WHERE (("de"."id" = "diary_comments"."entry_id") AND (("de"."is_public" = true) OR ("de"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "diary_comments_update_self" ON "public"."diary_comments" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "diary_delete_owner" ON "public"."diary_entries" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."diary_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diary_insert_owner" ON "public"."diary_entries" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."diary_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diary_likes_delete_self" ON "public"."diary_likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "diary_likes_insert_self" ON "public"."diary_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "diary_likes_select_visible_entry" ON "public"."diary_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."diary_entries" "de"
  WHERE (("de"."id" = "diary_likes"."entry_id") AND (("de"."is_public" = true) OR ("de"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "diary_select_public_or_owner" ON "public"."diary_entries" FOR SELECT USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "diary_update_owner" ON "public"."diary_entries" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."external_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "external_imports_select" ON "public"."external_imports" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "favorites_delete_owner" ON "public"."user_favorite_albums" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "favorites_insert_owner" ON "public"."user_favorite_albums" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "favorites_select_public" ON "public"."user_favorite_albums" FOR SELECT USING (true);



CREATE POLICY "favorites_update_owner" ON "public"."user_favorite_albums" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."feed_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_insert_as_actor" ON "public"."feed_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "actor_id"));



CREATE POLICY "feed_read_own" ON "public"."feed_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "feed_write_service" ON "public"."feed_events" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete_self" ON "public"."follows" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "follows_insert_self" ON "public"."follows" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "follows_read_public" ON "public"."follows" FOR SELECT USING (true);



ALTER TABLE "public"."genres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "genres_select" ON "public"."genres" FOR SELECT USING (true);



ALTER TABLE "public"."import_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_requests_insert_own" ON "public"."import_requests" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "import_requests_select_own" ON "public"."import_requests" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."list_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "list_items_delete" ON "public"."list_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_lists" "ul"
  WHERE (("ul"."id" = "list_items"."list_id") AND ("ul"."user_id" = "auth"."uid"())))));



CREATE POLICY "list_items_insert" ON "public"."list_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_lists" "ul"
  WHERE (("ul"."id" = "list_items"."list_id") AND ("ul"."user_id" = "auth"."uid"())))));



CREATE POLICY "list_items_select" ON "public"."list_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_lists" "ul"
  WHERE (("ul"."id" = "list_items"."list_id") AND (("ul"."is_public" = true) OR ("ul"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."list_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "list_likes_delete" ON "public"."list_likes" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "list_likes_insert" ON "public"."list_likes" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "list_likes_select" ON "public"."list_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_lists" "ul"
  WHERE (("ul"."id" = "list_likes"."list_id") AND (("ul"."is_public" = true) OR ("ul"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."product_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_events_insert_authenticated" ON "public"."product_events" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "product_events_read_own" ON "public"."product_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_read_public" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public read curator picks" ON "public"."curator_picks" FOR SELECT USING (true);



CREATE POLICY "public read metrics" ON "public"."recommendation_metrics" FOR SELECT USING (true);



CREATE POLICY "public read similarity" ON "public"."user_similarity" FOR SELECT USING (true);



ALTER TABLE "public"."recommendation_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_lists_delete_owner" ON "public"."saved_lists" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "saved_lists_insert_owner" ON "public"."saved_lists" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "saved_lists_select_owner" ON "public"."saved_lists" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."search_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "search_cache_read" ON "public"."search_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "search_cache_write_service" ON "public"."search_cache" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text")) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



ALTER TABLE "public"."similar_albums_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "similar_albums_cache_read" ON "public"."similar_albums_cache" FOR SELECT USING (true);



CREATE POLICY "similar_albums_cache_write" ON "public"."similar_albums_cache" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."track_diary_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "track_diary_comments_delete" ON "public"."track_diary_comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "track_diary_comments_insert" ON "public"."track_diary_comments" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."track_diary_entries" "entry"
  WHERE (("entry"."id" = "track_diary_comments"."entry_id") AND (("entry"."is_public" = true) OR ("entry"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "track_diary_comments_read" ON "public"."track_diary_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."track_diary_entries" "entry"
  WHERE (("entry"."id" = "track_diary_comments"."entry_id") AND (("entry"."is_public" = true) OR ("entry"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "track_diary_delete_owner" ON "public"."track_diary_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."track_diary_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "track_diary_insert_owner" ON "public"."track_diary_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."track_diary_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "track_diary_likes_delete" ON "public"."track_diary_likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "track_diary_likes_insert" ON "public"."track_diary_likes" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."track_diary_entries" "entry"
  WHERE (("entry"."id" = "track_diary_likes"."entry_id") AND (("entry"."is_public" = true) OR ("entry"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "track_diary_likes_read" ON "public"."track_diary_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."track_diary_entries" "entry"
  WHERE (("entry"."id" = "track_diary_likes"."entry_id") AND (("entry"."is_public" = true) OR ("entry"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "track_diary_select_public_or_owner" ON "public"."track_diary_entries" FOR SELECT USING ((("is_public" = true) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "track_diary_update_owner" ON "public"."track_diary_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."track_featured_artists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "track_featured_artists_select" ON "public"."track_featured_artists" FOR SELECT USING (true);



ALTER TABLE "public"."track_metadata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "track_metadata_select" ON "public"."track_metadata" FOR SELECT USING (true);



ALTER TABLE "public"."tracks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tracks_read_public" ON "public"."tracks" FOR SELECT USING (true);



CREATE POLICY "tracks_write_service" ON "public"."tracks" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_favorite_albums" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_lists_delete" ON "public"."user_lists" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND ("is_default" = false)));



CREATE POLICY "user_lists_insert" ON "public"."user_lists" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_lists_select" ON "public"."user_lists" FOR SELECT USING ((("is_public" = true) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "user_lists_update" ON "public"."user_lists" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_similarity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_taste_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_track_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage own feedback" ON "public"."recommendation_feedback" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own recs" ON "public"."user_recommendations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own track recs" ON "public"."user_track_recommendations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own vector" ON "public"."user_taste_vectors" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_insert_own_reports" ON "public"."content_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "users_manage_own_blocks" ON "public"."user_blocks" USING (("auth"."uid"() = "blocker_id")) WITH CHECK (("auth"."uid"() = "blocker_id"));



CREATE POLICY "users_read_own_reports" ON "public"."content_reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fuzzy_search_albums"("query_text" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fuzzy_search_albums"("query_text" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fuzzy_search_albums"("query_text" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fuzzy_search_artists"("query_text" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fuzzy_search_artists"("query_text" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fuzzy_search_artists"("query_text" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fuzzy_search_tracks"("query_text" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fuzzy_search_tracks"("query_text" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fuzzy_search_tracks"("query_text" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_albums"("result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_albums"("result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_albums"("result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_tracks"("result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_tracks"("result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_tracks"("result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_album_stats_mat"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_album_stats_mat"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_album_stats_mat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_album_stats_mat"() TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_favorite_albums"("p_albums" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_favorite_albums"("p_albums" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_favorite_albums"("p_albums" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_list_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_list_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_list_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_track_entry_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_track_entry_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_track_entry_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_track_entry_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_track_entry_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_track_entry_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."album_featured_artists" TO "anon";
GRANT ALL ON TABLE "public"."album_featured_artists" TO "authenticated";
GRANT ALL ON TABLE "public"."album_featured_artists" TO "service_role";



GRANT ALL ON TABLE "public"."album_genre_votes" TO "anon";
GRANT ALL ON TABLE "public"."album_genre_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."album_genre_votes" TO "service_role";



GRANT ALL ON TABLE "public"."album_genres" TO "anon";
GRANT ALL ON TABLE "public"."album_genres" TO "authenticated";
GRANT ALL ON TABLE "public"."album_genres" TO "service_role";



GRANT ALL ON TABLE "public"."album_metadata" TO "anon";
GRANT ALL ON TABLE "public"."album_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."album_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."diary_entries" TO "anon";
GRANT ALL ON TABLE "public"."diary_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."diary_entries" TO "service_role";



GRANT ALL ON TABLE "public"."album_stats" TO "anon";
GRANT ALL ON TABLE "public"."album_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."album_stats" TO "service_role";



GRANT ALL ON TABLE "public"."album_stats_mat" TO "anon";
GRANT ALL ON TABLE "public"."album_stats_mat" TO "authenticated";
GRANT ALL ON TABLE "public"."album_stats_mat" TO "service_role";



GRANT ALL ON TABLE "public"."albums" TO "anon";
GRANT ALL ON TABLE "public"."albums" TO "authenticated";
GRANT ALL ON TABLE "public"."albums" TO "service_role";



GRANT ALL ON TABLE "public"."artists" TO "anon";
GRANT ALL ON TABLE "public"."artists" TO "authenticated";
GRANT ALL ON TABLE "public"."artists" TO "service_role";



GRANT ALL ON TABLE "public"."content_reports" TO "anon";
GRANT ALL ON TABLE "public"."content_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reports" TO "service_role";



GRANT ALL ON TABLE "public"."cron_health" TO "anon";
GRANT ALL ON TABLE "public"."cron_health" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_health" TO "service_role";



GRANT ALL ON TABLE "public"."curator_picks" TO "anon";
GRANT ALL ON TABLE "public"."curator_picks" TO "authenticated";
GRANT ALL ON TABLE "public"."curator_picks" TO "service_role";



GRANT ALL ON TABLE "public"."diary_comments" TO "anon";
GRANT ALL ON TABLE "public"."diary_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."diary_comments" TO "service_role";



GRANT ALL ON TABLE "public"."diary_likes" TO "anon";
GRANT ALL ON TABLE "public"."diary_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."diary_likes" TO "service_role";



GRANT ALL ON TABLE "public"."external_imports" TO "anon";
GRANT ALL ON TABLE "public"."external_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."external_imports" TO "service_role";



GRANT ALL ON TABLE "public"."feed_events" TO "anon";
GRANT ALL ON TABLE "public"."feed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_events" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."genres" TO "anon";
GRANT ALL ON TABLE "public"."genres" TO "authenticated";
GRANT ALL ON TABLE "public"."genres" TO "service_role";



GRANT ALL ON TABLE "public"."import_requests" TO "anon";
GRANT ALL ON TABLE "public"."import_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."import_requests" TO "service_role";



GRANT ALL ON TABLE "public"."list_items" TO "anon";
GRANT ALL ON TABLE "public"."list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."list_items" TO "service_role";



GRANT ALL ON TABLE "public"."list_likes" TO "anon";
GRANT ALL ON TABLE "public"."list_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."list_likes" TO "service_role";



GRANT ALL ON TABLE "public"."product_events" TO "anon";
GRANT ALL ON TABLE "public"."product_events" TO "authenticated";
GRANT ALL ON TABLE "public"."product_events" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_metrics" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."saved_lists" TO "anon";
GRANT ALL ON TABLE "public"."saved_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_lists" TO "service_role";



GRANT ALL ON TABLE "public"."search_cache" TO "anon";
GRANT ALL ON TABLE "public"."search_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."search_cache" TO "service_role";



GRANT ALL ON TABLE "public"."similar_albums_cache" TO "anon";
GRANT ALL ON TABLE "public"."similar_albums_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."similar_albums_cache" TO "service_role";



GRANT ALL ON TABLE "public"."track_diary_comments" TO "anon";
GRANT ALL ON TABLE "public"."track_diary_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."track_diary_comments" TO "service_role";



GRANT ALL ON TABLE "public"."track_diary_entries" TO "anon";
GRANT ALL ON TABLE "public"."track_diary_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."track_diary_entries" TO "service_role";



GRANT ALL ON TABLE "public"."track_diary_entry_stats" TO "anon";
GRANT ALL ON TABLE "public"."track_diary_entry_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."track_diary_entry_stats" TO "service_role";



GRANT ALL ON TABLE "public"."track_diary_likes" TO "anon";
GRANT ALL ON TABLE "public"."track_diary_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."track_diary_likes" TO "service_role";



GRANT ALL ON TABLE "public"."track_featured_artists" TO "anon";
GRANT ALL ON TABLE "public"."track_featured_artists" TO "authenticated";
GRANT ALL ON TABLE "public"."track_featured_artists" TO "service_role";



GRANT ALL ON TABLE "public"."track_metadata" TO "anon";
GRANT ALL ON TABLE "public"."track_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."track_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."track_stats" TO "anon";
GRANT ALL ON TABLE "public"."track_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."track_stats" TO "service_role";



GRANT ALL ON TABLE "public"."tracks" TO "anon";
GRANT ALL ON TABLE "public"."tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."tracks" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorite_albums" TO "anon";
GRANT ALL ON TABLE "public"."user_favorite_albums" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorite_albums" TO "service_role";



GRANT ALL ON TABLE "public"."user_lists" TO "anon";
GRANT ALL ON TABLE "public"."user_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."user_lists" TO "service_role";



GRANT ALL ON TABLE "public"."user_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."user_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."user_similarity" TO "anon";
GRANT ALL ON TABLE "public"."user_similarity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_similarity" TO "service_role";



GRANT ALL ON TABLE "public"."user_taste_vectors" TO "anon";
GRANT ALL ON TABLE "public"."user_taste_vectors" TO "authenticated";
GRANT ALL ON TABLE "public"."user_taste_vectors" TO "service_role";



GRANT ALL ON TABLE "public"."user_track_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."user_track_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_track_recommendations" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







