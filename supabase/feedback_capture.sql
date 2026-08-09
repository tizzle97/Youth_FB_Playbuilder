-- Feedback capture improvements. Idempotent — safe to re-run.
-- Run this once in the Supabase SQL Editor.
--
-- Purely additive: one new nullable column and one CHECK constraint. No
-- existing column, policy, function, or UI behavior changes.

-- Where the user was when they hit "Give Feedback" (e.g. '/plays',
-- '/community/abc123'). Bug reports have been arriving with no location at
-- all, which is the single most expensive missing field when reproducing one.
--
-- Only the path — no user agent, no viewport, no IP. Everything else is
-- fingerprinting-adjacent and doesn't change how a bug gets fixed.
--
-- ⚠ Deliberately NOT added to the `feedback-triage` Edge Function's select
-- list. That list is a privacy guarantee (triage output lands in public PRs),
-- and a path can embed a play/playbook id that identifies a user's content.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS page_path text;

-- `content` was unbounded: a single submission could be megabytes, and the
-- triage Edge Function's MAX_CONTENT_CHARS truncation only protects the
-- *agent's* context window — the row itself, the admin list query, and the
-- digest email all still carry the full payload.
--
-- 4000 matches MAX_CONTENT_CHARS in supabase/functions/feedback-triage/index.ts
-- so a stored row can never be too long for triage to read in full. The client
-- enforces the same limit with a character counter; this is the backstop for
-- anything not going through the widget.
--
-- NOT VALID skips the scan of existing rows, which may predate the limit —
-- new and updated rows are still checked. Validate separately (and only if
-- every existing row is known to be under the cap):
--   ALTER TABLE feedback VALIDATE CONSTRAINT feedback_content_len;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_content_len;
ALTER TABLE feedback ADD CONSTRAINT feedback_content_len
  CHECK (char_length(content) <= 4000) NOT VALID;
