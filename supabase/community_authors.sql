-- Fixes a live bug: CommunityPage.tsx fetches posts with an embedded
-- `profiles(id, username, avatar_url)` resource, but no `profiles` table
-- or view has ever existed in this schema (confirmed via migration
-- history) — every load of the Community Forum page fails with a 400
-- from PostgREST ("could not find a relationship between posts and
-- profiles").
--
-- Username actually lives on auth.users.raw_user_meta_data->>'username'
-- (set at signup, see AuthPage.tsx) and avatar fields live on
-- user_reputation (avatar_type/avatar_url/avatar_icon_id). A view can't
-- fix this: PostgREST's embedded-resource syntax (`posts.select('*, x(...)')`)
-- requires a real foreign key between the two tables, and posts.user_id
-- only has an FK to auth.users — not to anything we could name `profiles`.
--
-- So instead of an embed, the app now fetches posts plain and calls this
-- function once with the batch of author ids on the page to look up
-- display info. SECURITY DEFINER so it can read auth.users; it only
-- returns username + avatar_url (never email or raw_user_meta_data
-- wholesale) since this is public community-page data. Run this once in
-- the Supabase SQL Editor.
CREATE OR REPLACE FUNCTION get_community_authors(target_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text
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
    CASE WHEN ur.avatar_type = 'icon' THEN ai.icon_url ELSE ur.avatar_url END AS avatar_url
  FROM auth.users u
  LEFT JOIN user_reputation ur ON ur.user_id = u.id
  LEFT JOIN avatar_icons ai ON ai.id = ur.avatar_icon_id
  WHERE u.id = ANY (target_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_community_authors(uuid[]) TO anon, authenticated;
