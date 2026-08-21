-- Comp one user their first year of Pro. Idempotent — safe to re-run.
-- Run in the Supabase SQL Editor.
--
-- WHY THIS EXISTS
-- A visitor signed up through the live Pro button while Stripe was still on
-- sandbox keys, so they completed a real-looking checkout with a test card and
-- were granted Pro without any money changing hands (see the stripe-webhook
-- livemode guard, added the same week). They believed they had subscribed.
-- Jeremy's call: honour it as a free first year, then let it lapse to the
-- normal paywall.
--
-- WHY A COMP RATHER THAN A STRIPE TRIAL
-- There is no card on file in live mode — the sandbox subscription cannot be
-- converted into a live one. A Stripe trial would require emailing them and
-- having them enter a card now. Both is_pro() (SQL) and rowIsPro()
-- (src/lib/entitlements.ts) already treat current_period_end as a hard expiry,
-- so a dated row lapses correctly on both the server and the client with no
-- Stripe involvement at all.
--
-- ⚠ EDIT THIS before running. Nothing else in the file needs changing.
\set comped_email 'REPLACE_WITH_THE_USER_EMAIL'

-- The sandbox stripe ids are deliberately cleared:
--   * they point at objects in the sandbox environment that live mode cannot
--     see, so "Manage billing" could never work with them;
--   * admin_set_user_plan refuses any row carrying a stripe_subscription_id
--     (PBP06), so leaving them would lock this row out of the admin UI forever.
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
  AND lower(u.email) = lower(:'comped_email')
  -- Never clobber a genuine paying subscriber: only a row with no live
  -- subscription, or one already comped by an earlier run, is eligible.
  AND (s.stripe_subscription_id IS NULL OR s.status IS DISTINCT FROM 'active');

-- If they somehow have no subscriptions row at all, create the comped one.
INSERT INTO subscriptions (user_id, plan, status, current_period_end)
SELECT u.id, 'pro', 'comped', now() + interval '1 year'
FROM auth.users u
WHERE lower(u.email) = lower(:'comped_email')
ON CONFLICT (user_id) DO NOTHING;

-- Confirm. Expect exactly one row: plan=pro, status=comped, both stripe ids
-- NULL, current_period_end about a year out.
SELECT u.email, s.plan, s.status, s.current_period_end,
       s.stripe_customer_id, s.stripe_subscription_id
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE lower(u.email) = lower(:'comped_email');
