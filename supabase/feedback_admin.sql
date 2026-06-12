-- Admin access to website feedback
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
