-- Fixes a live bug: the Community Forum sidebar's "Top Contributors" list
-- was hardcoded mock data (three made-up usernames, stock Unsplash photos,
-- fabricated reputation numbers) presented as real — a rules violation
-- (fabricated content misrepresented as organic). This adds a real query so
-- the client can show the actual top posters instead.
--
-- Mirrors community_authors.sql's get_community_authors() pattern: username
-- lives on auth.users.raw_user_meta_data (SECURITY DEFINER needed to read
-- it), avatar fields live on user_reputation/avatar_icons. Excludes rows
-- with reputation <= 0 (the signup trigger creates a user_reputation row
-- for every new user at 0 — only +10 on an actual post/comment — so
-- filtering keeps this to people who've actually contributed, not just
-- everyone who's ever signed up).
CREATE OR REPLACE FUNCTION get_top_contributors(result_limit int DEFAULT 3)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  reputation integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) AS username,
    CASE WHEN ur.avatar_type = 'icon' THEN ai.icon_url ELSE ur.avatar_url END AS avatar_url,
    ur.reputation
  FROM user_reputation ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN avatar_icons ai ON ai.id = ur.avatar_icon_id
  WHERE ur.reputation > 0
  ORDER BY ur.reputation DESC
  LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_contributors(int) TO anon, authenticated;
