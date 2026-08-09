-- Admin feedback console: replies + triage visibility. Idempotent.
-- Run this once in the Supabase SQL Editor.
--
-- ⚠ Run `supabase/feedback_capture.sql` FIRST — admin_list_feedback() below
-- selects `feedback.page_path`, which that file adds. Running this one first
-- fails with "column f.page_path does not exist".
--
-- Additive: two new nullable columns and a re-created reader function. No RLS
-- change is needed — the existing "Admins can update feedback" policy from
-- feedback_admin.sql already covers writing these columns, and the existing
-- "Users can view their own feedback" SELECT policy already lets a submitter
-- read the reply written to their own row.

-- The admin's written response to the submitter. Shown back to that user in
-- Account Settings → My Feedback; never shown to anyone else.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_reply text;

-- Separate from `updated_at` (which the existing trigger bumps on *any*
-- update, including a status change), so "has this person been answered?" is
-- answerable without guessing.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- Re-create the admin reader to include the triage columns, page_path, and the
-- reply. Until now the agent's decisions were invisible to the admin UI: a
-- human could mark something "resolved" with no idea the triage routine had
-- already opened a PR for it, or that it had been flagged as a prompt
-- injection attempt awaiting exactly their attention.
--
-- DROP first — Postgres won't let CREATE OR REPLACE change a function's return
-- type, and adding columns to RETURNS TABLE does exactly that.
DROP FUNCTION IF EXISTS admin_list_feedback();

CREATE OR REPLACE FUNCTION admin_list_feedback()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  type text,
  content text,
  page_path text,
  status text,
  admin_reply text,
  replied_at timestamptz,
  triage_class text,
  triage_state text,
  triage_ref text,
  triage_notes text,
  triaged_at timestamptz,
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
  SELECT
    f.id, f.user_id, u.email::text, f.type, f.content, f.page_path, f.status,
    f.admin_reply, f.replied_at,
    f.triage_class, f.triage_state, f.triage_ref, f.triage_notes, f.triaged_at,
    f.created_at
  FROM feedback f
  LEFT JOIN auth.users u ON u.id = f.user_id
  ORDER BY f.created_at DESC;
END;
$$;
