-- Migration: atomic replacement of a user's Top 3 favorite albums
-- Run this in the Supabase SQL editor.
--
-- Context: POST /api/me/favorite-albums used to delete the user's existing
-- favorites and then insert the new ones as two separate requests. If the
-- insert failed after the delete succeeded, the user lost their Top 3 with
-- no rollback. A single PL/pgSQL function runs in one implicit transaction:
-- any RAISE EXCEPTION aborts the whole function, so delete+insert either
-- both happen or neither does.
--
-- SECURITY INVOKER (default) is used on purpose: the function relies on the
-- existing RLS policies on user_favorite_albums (owner-only insert/update/
-- delete) and on auth.uid() for identity, so it never trusts a client-
-- supplied user_id and never needs elevated privileges.

CREATE OR REPLACE FUNCTION replace_favorite_albums(p_albums jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
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

GRANT EXECUTE ON FUNCTION replace_favorite_albums TO authenticated;
