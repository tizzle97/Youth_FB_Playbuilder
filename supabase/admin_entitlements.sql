-- Admin entitlement management: set a user's plan from the Admin Dashboard
-- instead of hand-writing a one-off SQL file for every grant.
--
-- Run once in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- `subscriptions` RLS is SELECT-own-only (subscriptions.sql): "writes happen
-- only via the Stripe webhook (service role) or admin SQL — never directly
-- from the client." So the dashboard cannot UPDATE the table directly; it has
-- to go through a SECURITY DEFINER function that gates itself on is_admin().
-- Same shape as delete_user() in feedback_admin.sql.


-- ─────────────────────────────────────────────────────────────────────────────
-- admin_list_users() — replaced to include entitlement columns.
--
-- DROP first: Postgres refuses CREATE OR REPLACE when the RETURNS TABLE
-- signature changes. The only caller is AdminDashboard.tsx.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_list_users();

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  created_at timestamptz,
  is_admin_user boolean,
  plan text,
  current_period_end timestamptz,
  is_stripe_backed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    EXISTS (SELECT 1 FROM admin_users a WHERE a.user_id = u.id),
    -- No subscriptions row at all = free (that is how signup leaves users).
    COALESCE(s.plan, 'free')::text,
    s.current_period_end,
    (s.stripe_subscription_id IS NOT NULL)
  FROM auth.users u
  LEFT JOIN subscriptions s ON s.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- admin_set_user_plan(target_user_id, new_plan)
--
-- Comping someone is what 'founding' is for: is_pro() returns true for
--   plan IN ('founding','pro') AND (current_period_end IS NULL OR > now())
-- and ignores `status`, so 'founding' + NULL current_period_end is exactly
-- "full access, never expires". The Stripe webhook also refuses to downgrade
-- a 'founding' row, so a comp survives the live-billing switch (B-18).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_user_plan(target_user_id uuid, new_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing subscriptions%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change a user''s plan';
  END IF;

  -- 'pro' is deliberately NOT settable here. That value is owned by the Stripe
  -- webhook; hand-setting it invents an entitlement Stripe knows nothing about
  -- and will later contradict.
  IF new_plan NOT IN ('free', 'founding') THEN
    RAISE EXCEPTION 'Plan must be free or founding. Paid Pro is managed by Stripe.'
      USING ERRCODE = 'PBP06';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'That user no longer exists.'
      USING ERRCODE = 'PBP06';
  END IF;

  SELECT * INTO existing FROM subscriptions WHERE user_id = target_user_id;

  -- Never touch a live Stripe subscription. Converting a paying subscriber to
  -- 'founding' would keep Stripe billing them while the webhook refuses to ever
  -- downgrade the row; flipping them to 'free' would strip access they are
  -- still paying for. Cancel in Stripe first, then change the plan here.
  IF existing.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'This user has an active Stripe subscription. Cancel it in Stripe before changing their plan.'
      USING ERRCODE = 'PBP06';
  END IF;

  INSERT INTO subscriptions (user_id, plan, current_period_end)
  VALUES (target_user_id, new_plan, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET plan               = EXCLUDED.plan,
        current_period_end = NULL;
END;
$$;

-- The function gates itself on is_admin(); the grant only makes it callable.
GRANT EXECUTE ON FUNCTION admin_set_user_plan(uuid, text) TO authenticated;
