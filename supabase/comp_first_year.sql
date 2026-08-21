-- Comp one user their first year of Pro. Idempotent — safe to re-run.
-- Run in the Supabase SQL Editor.
--
-- WHY THIS EXISTS
-- A visitor signed up through the live Pro button while Stripe was still on
-- sandbox keys, so they completed a real-looking checkout with a test card and
-- were granted Pro without any money changing hands. They believed they had
-- subscribed. Jeremy's call: honour it as a free first year, then let it lapse
-- to the normal paywall.
--
-- WHY A COMP RATHER THAN A STRIPE TRIAL
-- There is no card on file in live mode and a sandbox subscription cannot be
-- converted into a live one. Both is_pro() (SQL) and rowIsPro()
-- (src/lib/entitlements.ts) already treat current_period_end as a hard expiry,
-- so a dated row lapses on its own, server and client, with no Stripe involved.
--
-- ⚠ EDIT THE EMAIL IN ALL FOUR PLACES BELOW before running.
--   Find/replace `coach@example.com` with the real address.
--
-- TWO EARLIER VERSIONS OF THIS FILE FAILED. Both are worth knowing about:
--
--   1. It used psql's \set / :'var'. Those are psql CLIENT meta-commands; the
--      Supabase SQL Editor talks straight to the database and never sees them.
--
--   2. The UPDATE carried a guard meant to protect a genuine paying customer:
--          AND (stripe_subscription_id IS NULL OR status IS DISTINCT FROM 'active')
--      The sandbox webhook writes `status: sub.status`, so the row to be comped
--      is itself status='active' with a non-null stripe_subscription_id — the
--      guard excluded precisely the row it was written for, the INSERT no-opped
--      on ON CONFLICT, and the script reported success while changing nothing.
--
--      There is no column that distinguishes a sandbox subscription from a live
--      one, so that guard could never have worked. **The email is the guard.**
--      If the address ever belongs to a real paying subscriber, cancel their
--      subscription in Stripe first — do not use this file to do it, because
--      clearing stripe_subscription_id here would orphan a live subscription
--      that keeps billing them with no way for the app to see it.

-- ── BEFORE ──────────────────────────────────────────────────────────────────
-- Read this row before running the rest. If plan/status already look comped,
-- an earlier run worked and you can stop.
SELECT 'before' AS stage, u.email, s.plan, s.status, s.current_period_end,
       s.stripe_customer_id, s.stripe_subscription_id
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE lower(u.email) = lower('coach@example.com');  -- ⚠ EDIT (1 of 4)

-- ── THE COMP ────────────────────────────────────────────────────────────────
-- The sandbox stripe ids are deliberately cleared: they point at objects live
-- mode cannot see, so "Manage billing" could never work with them, and
-- admin_set_user_plan refuses any row carrying a stripe_subscription_id
-- (PBP06) — leaving them would lock this row out of /admin permanently.
UPDATE subscriptions s
SET
  plan                   = 'pro',
  status                 = 'comped',
  current_period_end     = now() + interval '1 year',
  stripe_customer_id     = NULL,
  stripe_subscription_id = NULL,
  updated_at             = now()
FROM auth.users u
WHERE u.id = s.user_id
  AND lower(u.email) = lower('coach@example.com');  -- ⚠ EDIT (2 of 4)

-- If they somehow have no subscriptions row at all, create the comped one.
INSERT INTO subscriptions (user_id, plan, status, current_period_end)
SELECT u.id, 'pro', 'comped', now() + interval '1 year'
FROM auth.users u
WHERE lower(u.email) = lower('coach@example.com')   -- ⚠ EDIT (3 of 4)
ON CONFLICT (user_id) DO NOTHING;

-- ── AFTER ───────────────────────────────────────────────────────────────────
-- Expect exactly one row: plan=pro, status=comped, BOTH stripe ids NULL,
-- current_period_end about a year out.
--   * No rows at all  → the email didn't match. Check it and re-run.
--   * Row unchanged   → the UPDATE matched nothing; compare against 'before'.
-- Nothing above is destructive to any other user, so re-running is safe.
SELECT 'after' AS stage, u.email, s.plan, s.status, s.current_period_end,
       s.stripe_customer_id, s.stripe_subscription_id
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE lower(u.email) = lower('coach@example.com');  -- ⚠ EDIT (4 of 4)
