-- Daily feedback digest. Idempotent — safe to re-run.
-- Run this in the Supabase SQL Editor.
--
-- ⚠ PREREQUISITES, in order:
--   1. Enable the `pg_cron` and `pg_net` extensions:
--      Supabase Dashboard → Database → Extensions. Both are available on the
--      free plan but are OFF by default, and CREATE EXTENSION below will fail
--      if the dashboard hasn't granted them.
--   2. Deploy the function and set its secrets FIRST — scheduling a cron job
--      that hits a nonexistent endpoint just writes a 404 into cron.job_run_details
--      every night:
--        supabase secrets set FEEDBACK_NOTIFY_SECRET=<openssl rand -hex 32>
--        supabase secrets set RESEND_API_KEY=<re_... from resend.com>
--        supabase secrets set FEEDBACK_DIGEST_TO=<your admin address>
--        supabase functions deploy feedback-notify --no-verify-jwt
--   3. Replace the two placeholders in the cron block below before running it.
--
-- ⚠ The secret goes into `cron.job` in plaintext, which is exactly why it is a
-- placeholder here and not a committed value. Anyone who can read
-- `cron.job` can read it — that's acceptable because the blast radius of this
-- particular token is "can cause a digest email to be sent early", but do not
-- reuse FEEDBACK_TRIAGE_SECRET or anything else for it.

-- When this row was last included in a digest. NULL = not yet reported, which
-- is what makes the send idempotent: a Resend outage leaves the rows unmarked
-- and they roll into tomorrow rather than vanishing.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- The digest's only read query is "oldest un-notified first", so index just
-- that slice — same shape as feedback_untriaged_idx.
CREATE INDEX IF NOT EXISTS feedback_unnotified_idx
  ON feedback (created_at)
  WHERE notified_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Schedule. Everything below needs the placeholders filled in.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule first so re-running this file updates the job instead of erroring
-- on the duplicate name.
SELECT cron.unschedule('feedback-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'feedback-digest');

-- 13:00 UTC daily — early morning US, so the digest is waiting at the start of
-- the day rather than arriving overnight. Deliberately offset from the triage
-- routine so a burst of submissions isn't read by both at the same moment.
SELECT cron.schedule(
  'feedback-digest',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/feedback-notify',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-notify-secret',  '<FEEDBACK_NOTIFY_SECRET>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Check it afterwards:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'feedback-digest';
--   SELECT status, return_message, start_time
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'feedback-digest')
--    ORDER BY start_time DESC LIMIT 5;
--
-- If pg_cron or pg_net turns out to be unavailable, the fallback is to add a
-- final step to the daily feedback-triage routine that curls this endpoint —
-- same secret header, same idempotency.
