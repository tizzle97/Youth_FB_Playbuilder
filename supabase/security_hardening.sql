-- Security hardening: pin search_path on SECURITY DEFINER functions.
-- Run this once in the Supabase SQL Editor.
--
-- Why: is_admin() and is_pro() run with SECURITY DEFINER (the function
-- owner's privileges) but never pinned search_path. A function in this
-- mode resolves unqualified identifiers using the caller's search_path,
-- so a caller who can create objects earlier in their own search_path
-- (e.g. a same-named table/function in a schema they control) could in
-- principle shadow what the function resolves. Pinning search_path
-- closes that off. admin_list_feedback / admin_list_users / delete_user
-- already do this correctly — this brings the older functions in line.

ALTER FUNCTION is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION is_pro(uuid) SET search_path = public, pg_temp;

-- ------------------------------------------------------------------
-- Fix: user_reputation had a public, unrestricted write policy.
--
-- "System can manage user reputation" was created `FOR ALL USING (true)
-- WITH CHECK (true)` with no `TO` clause, so it applies to every role —
-- including `anon`. That means anyone holding the public anon key (i.e.
-- anyone, since it ships in the client bundle) could directly INSERT,
-- UPDATE, or DELETE any row in user_reputation, e.g.:
--   supabase.from('user_reputation').update({ reputation: 999999 }).eq('user_id', anyId)
-- Reputation is actually maintained by the update_user_reputation()
-- trigger function, which is SECURITY DEFINER and therefore bypasses RLS
-- on its own — the catch-all policy was never needed for that path to
-- work, it only opened a hole for direct client writes. The existing
-- "Users can update their own avatar settings" policy already covers
-- the one legitimate direct-write case (a user editing their own avatar).
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "System can manage user reputation" ON user_reputation;

-- ------------------------------------------------------------------
-- Fix: image_reports moderator policies trusted a self-controlled field.
--
-- The "Moderators can view/update all reports" policies checked
-- auth.users.raw_user_meta_data->>'role' = 'moderator'. raw_user_meta_data
-- is the same data a user can set on themselves via
--   supabase.auth.updateUser({ data: { role: 'moderator' } })
-- so any signed-in user could grant themselves moderator access to every
-- abuse report (privilege escalation). Replaced with is_admin(), the same
-- vetted, server-only-writable check used everywhere else in this app
-- (admin_users table — never client-writable).
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Moderators can view all reports" ON image_reports;
CREATE POLICY "Moderators can view all reports"
  ON image_reports FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Moderators can update reports" ON image_reports;
CREATE POLICY "Moderators can update reports"
  ON image_reports FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
