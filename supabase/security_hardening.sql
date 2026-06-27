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
