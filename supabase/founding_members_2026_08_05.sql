-- Grant Founding Member status (free Pro for life) to everyone who signed up
-- on 2026-08-05.
--
-- Run manually in the Supabase SQL Editor. RUN STEP 1 FIRST and read the list —
-- it is the only chance to catch a wrong date window before the grant.
--
-- Why this is enough: is_pro() (subscriptions.sql) returns true for
--   plan IN ('founding','pro') AND (current_period_end IS NULL OR > now())
-- It does NOT look at `status`. So a 'founding' row with a NULL
-- current_period_end is exactly "full access, never expires". The Stripe
-- webhook is also written to never downgrade a 'founding' row, so this
-- survives the eventual live-billing switch (B-18).
--
-- TIMEZONE: "today" is interpreted as America/New_York, not UTC. This matters —
-- a plain DATE '2026-08-05' comparison means UTC midnight, which would sweep in
-- anyone who signed up after 8pm Eastern on 8/4. If you want UTC instead,
-- replace 'America/New_York' with 'UTC' in all three steps below.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — DRY RUN. Run this alone first and confirm the list looks right.
-- Changes nothing.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.id,
  u.email,
  u.created_at AT TIME ZONE 'America/New_York' AS signed_up_eastern,
  u.created_at                                  AS signed_up_utc,
  COALESCE(s.plan, '(no row — will be granted)') AS current_plan,
  CASE
    WHEN s.user_id IS NULL   THEN 'INSERT founding'
    WHEN s.plan = 'free'     THEN 'UPGRADE free -> founding'
    ELSE                          'SKIP — already ' || s.plan
  END AS action
FROM auth.users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.created_at >= TIMESTAMPTZ '2026-08-05 00:00:00 America/New_York'
  AND u.created_at <  TIMESTAMPTZ '2026-08-06 00:00:00 America/New_York'
ORDER BY u.created_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — THE GRANT. Only run once Step 1 shows the users you expect.
--
-- Idempotent, and safe to re-run: it inserts a 'founding' row for today's
-- signups that have none, and upgrades a row only when it is currently 'free'.
-- An existing 'pro' or 'founding' row is left completely untouched — we must
-- never convert a paying Stripe subscriber to 'founding', which would keep
-- billing them while the webhook refuses to ever downgrade the row.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO subscriptions (user_id, plan, current_period_end)
SELECT u.id, 'founding', NULL
FROM auth.users u
WHERE u.created_at >= TIMESTAMPTZ '2026-08-05 00:00:00 America/New_York'
  AND u.created_at <  TIMESTAMPTZ '2026-08-06 00:00:00 America/New_York'
ON CONFLICT (user_id) DO UPDATE
  SET plan               = 'founding',
      current_period_end = NULL
  WHERE subscriptions.plan = 'free';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — VERIFY. Every row should read founding / true.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  u.email,
  u.created_at AT TIME ZONE 'America/New_York' AS signed_up_eastern,
  s.plan,
  s.current_period_end,
  is_pro(u.id) AS has_full_access
FROM auth.users u
JOIN subscriptions s ON s.user_id = u.id
WHERE u.created_at >= TIMESTAMPTZ '2026-08-05 00:00:00 America/New_York'
  AND u.created_at <  TIMESTAMPTZ '2026-08-06 00:00:00 America/New_York'
ORDER BY u.created_at;
