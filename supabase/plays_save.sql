-- Columns the app expects on plays that are missing from the live schema,
-- plus public read access for community plays.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE plays ADD COLUMN IF NOT EXISTS thumbnail text;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Anyone (including signed-out visitors) can view plays marked public
DROP POLICY IF EXISTS "Anyone can read public plays" ON plays;
CREATE POLICY "Anyone can read public plays"
  ON plays FOR SELECT
  TO anon, authenticated
  USING (is_public = true);
