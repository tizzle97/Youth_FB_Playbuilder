-- Phase 1 of monetization: entitlement plumbing + grandfathering.
-- Run this once in the Supabase SQL Editor.
-- No user-facing change yet — everyone resolves to Pro (Founding Members).

-- One subscription/entitlement row per user.
--   plan:   'free' | 'founding' | 'pro'
--   status: Stripe subscription status ('active','trialing','past_due',
--           'canceled', etc.); NULL for founding/free (no Stripe sub)
--   current_period_end: when paid access lapses (NULL = never, e.g. founding)
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'founding', 'pro')),
  status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlement. Writes happen only via the Stripe
-- webhook (service role) or admin SQL — never directly from the client.
DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- keep updated_at fresh (reuses the project's existing trigger function)
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Entitlement check, mirroring the existing is_admin() pattern.
-- Pro if plan is 'founding' or 'pro' and access hasn't lapsed.
CREATE OR REPLACE FUNCTION is_pro(uid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = uid
      AND s.plan IN ('founding', 'pro')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grandfather every existing user as a Founding Member (free Pro for life).
-- Anyone who signs up AFTER this runs is not matched and defaults to free.
INSERT INTO subscriptions (user_id, plan)
SELECT id, 'founding' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
