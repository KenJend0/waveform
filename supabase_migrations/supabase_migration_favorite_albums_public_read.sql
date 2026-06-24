-- Align Top 3 albums with the product model: favorite albums are public
-- profile data, while writes remain owner-only.

DROP POLICY IF EXISTS "favorites_select_owner" ON user_favorite_albums;
DROP POLICY IF EXISTS "favorites_select_public" ON user_favorite_albums;

CREATE POLICY "favorites_select_public" ON user_favorite_albums
  FOR SELECT
  USING (true);
