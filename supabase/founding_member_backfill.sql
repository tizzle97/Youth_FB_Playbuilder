-- B-4: re-run the Founding Member grandfathering backfill.
-- Run this once in the Supabase SQL Editor, right before free-tier gates
-- (B-1/B-2) are relied on for enforcement.
--
-- subscriptions.sql already grandfathered every user that existed at the time
-- IT was run. Anyone who signed up after that (but before this file runs) has
-- no subscriptions row and defaults to 'free' -- incorrectly losing the
-- grandfathering promise now that free-tier limits are live. This file is
-- idempotent (ON CONFLICT DO NOTHING) and safe to run again: it only inserts
-- users who still have no subscriptions row, so anyone who signed up after
-- THIS runs is correctly left as a normal free user.

INSERT INTO subscriptions (user_id, plan)
SELECT id, 'founding' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
