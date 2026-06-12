-- Admin dashboard support: feedback access + user management
-- Run this once in the Supabase SQL Editor.

-- Admins can read all feedback rows (users can already read their own)
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
CREATE POLICY "Admins can view all feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can update feedback (status changes: pending / reviewed / resolved)
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Feedback rows joined with the submitter's email address.
-- SECURITY DEFINER so it can read auth.users; gated by is_admin() inside.
CREATE OR REPLACE FUNCTION admin_list_feedback()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  type text,
  content text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT f.id, f.user_id, u.email::text, f.type, f.content, f.status, f.created_at
  FROM feedback f
  LEFT JOIN auth.users u ON u.id = f.user_id
  ORDER BY f.created_at DESC;
END;
$$;

-- List all registered users for the admin dashboard.
-- SECURITY DEFINER so it can read auth.users; gated by is_admin() inside.
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  created_at timestamptz,
  is_admin_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    (u.raw_user_meta_data->>'username')::text,
    u.created_at,
    EXISTS (SELECT 1 FROM admin_users a WHERE a.user_id = u.id)
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- Replace delete_user so it removes the auth account itself (cascades to
-- all app data via ON DELETE CASCADE foreign keys), not just profile rows.
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account from the dashboard';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
