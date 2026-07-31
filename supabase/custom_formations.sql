-- Custom (user-saved) formation templates — Pro feature.
-- Run this once in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Note: an older, unused `formations` table already exists from an earlier
-- scaffold migration (is_system/template-text shape, no game_type column,
-- zero references anywhere in src/). This is a fresh table rather than a
-- repurposing of that one, to avoid any assumptions about its existing rows.

CREATE TABLE IF NOT EXISTS custom_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('5v5', '7v7', '11v11')),
  icons jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_formations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own custom formations" ON custom_formations;
CREATE POLICY "Users manage their own custom formations"
  ON custom_formations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Server-side Pro gate — mirrors free_tier_limits.sql's trigger-based
-- enforcement style (a friendly RAISE EXCEPTION the client recognizes by
-- ERRCODE, see src/lib/errors.ts), reusing the existing is_pro() function
-- from subscriptions.sql, so this isn't only a client-side UI check.
CREATE OR REPLACE FUNCTION enforce_pro_custom_formations()
RETURNS trigger AS $$
BEGIN
  IF NOT is_pro(NEW.user_id) THEN
    RAISE EXCEPTION 'Custom formations are a Pro feature. Upgrade to Pro to save your own formations.'
      USING ERRCODE = 'PBP03';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS custom_formations_pro_gate ON custom_formations;
CREATE TRIGGER custom_formations_pro_gate
  BEFORE INSERT ON custom_formations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_pro_custom_formations();
