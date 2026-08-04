-- Automated feedback triage (B-35). Idempotent — safe to re-run.
-- Run this once in the Supabase SQL Editor.
--
-- Adds agent-owned triage columns to `feedback`. These are deliberately
-- SEPARATE from the existing `status` column: `status`
-- ('pending'|'reviewed'|'resolved') is the *human* admin workflow shown in
-- src/components/admin/FeedbackManagement.tsx, and overloading it would make
-- that UI lie about what a human has actually looked at. Everything here is
-- purely additive — no existing column, policy, or UI behavior changes.

-- The scheduled triage agent's own classification. Intentionally independent
-- of `feedback.type` (the submitter's dropdown), which defaults to 'general'
-- and is frequently wrong. 'injection' = the submission tried to issue
-- instructions to the agent; those are flagged for a human, never acted on.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS triage_class text
  CHECK (triage_class IN ('bug', 'feature', 'general', 'spam', 'injection'));

-- Where triage got to. 'untriaged' is the work queue the Edge Function reads.
--   triaged — routed somewhere (PR / draft PR / backlog entry), see triage_ref
--   skipped — no action warranted (spam, praise, unintelligible)
--   flagged — needs a human's eyes; agent deliberately took no action
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS triage_state text
  NOT NULL DEFAULT 'untriaged'
  CHECK (triage_state IN ('untriaged', 'triaged', 'skipped', 'flagged'));

-- Where it went: a PR URL, branch name, or BACKLOG item id.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS triage_ref text;

-- One-line rationale for the classification/routing decision.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS triage_notes text;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS triaged_at timestamptz;

-- The triage agent's only read query is "oldest untriaged first", so index
-- just that slice rather than the whole (large, mostly-triaged) table.
CREATE INDEX IF NOT EXISTS feedback_untriaged_idx
  ON feedback (created_at)
  WHERE triage_state = 'untriaged';

-- No new RLS policies: the feedback-triage Edge Function reaches this table
-- with the service role (RLS-exempt), and no client-side code reads or writes
-- these columns. Existing policies (users read/insert own; admins read+update
-- all) are unchanged.
