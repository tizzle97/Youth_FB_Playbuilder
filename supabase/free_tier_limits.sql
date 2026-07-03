-- B-1: server-enforced free-tier limits (15 plays / 2 playbooks).
-- Run this once in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Why a trigger instead of an RLS policy: RLS WITH CHECK failures surface as
-- a generic 42501 "row-level security" error, which the client already maps
-- to "You don't have permission to do that." (see src/lib/errors.ts) — not
-- an accurate message for a plan-limit block. A BEFORE INSERT trigger lets us
-- raise a distinct, friendly error the client can recognize and show as an
-- upgrade prompt instead.
--
-- Limits must stay in sync with FREE_LIMITS in src/lib/entitlements.ts.

CREATE OR REPLACE FUNCTION enforce_plays_free_limit()
RETURNS trigger AS $$
BEGIN
  IF NOT is_pro(NEW.user_id) AND (
    SELECT count(*) FROM plays WHERE user_id = NEW.user_id
  ) >= 15 THEN
    RAISE EXCEPTION 'Free plan is limited to 15 plays. Upgrade to Pro for unlimited plays.'
      USING ERRCODE = 'PBP01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS enforce_plays_free_limit_trigger ON plays;
CREATE TRIGGER enforce_plays_free_limit_trigger
  BEFORE INSERT ON plays
  FOR EACH ROW
  EXECUTE FUNCTION enforce_plays_free_limit();

CREATE OR REPLACE FUNCTION enforce_playbooks_free_limit()
RETURNS trigger AS $$
BEGIN
  IF NOT is_pro(NEW.user_id) AND (
    SELECT count(*) FROM playbooks WHERE user_id = NEW.user_id
  ) >= 2 THEN
    RAISE EXCEPTION 'Free plan is limited to 2 playbooks. Upgrade to Pro for unlimited playbooks.'
      USING ERRCODE = 'PBP02';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS enforce_playbooks_free_limit_trigger ON playbooks;
CREATE TRIGGER enforce_playbooks_free_limit_trigger
  BEFORE INSERT ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_playbooks_free_limit();
