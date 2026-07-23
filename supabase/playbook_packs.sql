-- Starter playbook packs (BACKLOG B-33). Idempotent — safe to re-run.
-- A "pack" is a public playbook (typically owned by the official account) that
-- Pro users can clone in one action: a new playbook in their own account plus
-- a private copy of every play in it, in the same order. Individual plays
-- already clone for free via the Play Library (B-30, plays_save.sql) — cloning
-- a whole curated pack in one tap is the Pro differentiator.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Anyone (including signed-out visitors) can view playbooks marked public —
-- mirrors the "Anyone can read public plays" policy in plays_save.sql.
DROP POLICY IF EXISTS "Anyone can read public playbooks" ON playbooks;
CREATE POLICY "Anyone can read public playbooks"
  ON playbooks FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Anyone can read the playbook_plays rows belonging to a public playbook, so
-- the pack's play count can be shown before cloning.
DROP POLICY IF EXISTS "Anyone can read public playbook contents" ON playbook_plays;
CREATE POLICY "Anyone can read public playbook contents"
  ON playbook_plays FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM playbooks pb WHERE pb.id = playbook_id AND pb.is_public = true));

-- Anyone can read the plays inside a public playbook, independent of each
-- play's own is_public flag — a pack is a curated bundle, not a promise that
-- every play in it is separately public (mirrors community_authors.sql's
-- pattern of a narrow, purpose-built read grant rather than widening
-- plays.is_public itself).
DROP POLICY IF EXISTS "Anyone can read plays in public playbooks" ON plays;
CREATE POLICY "Anyone can read plays in public playbooks"
  ON plays FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM playbook_plays pp
      JOIN playbooks pb ON pb.id = pp.playbook_id
      WHERE pp.play_id = plays.id AND pb.is_public = true
    )
  );

-- Clones a public playbook pack into the caller's own account. Pro-gated
-- (PBP03) and re-checks the source is actually a public pack (PBP04) —
-- mirrors the enforce_*_free_limit() trigger convention in
-- free_tier_limits.sql (custom SQLSTATE, user-safe message). Only Pro callers
-- ever reach the inserts below, and Pro users are already exempt from the
-- free-tier INSERT triggers on plays/playbooks, so no separate handling of
-- those limits is needed here.
CREATE OR REPLACE FUNCTION clone_playbook_pack(pack_playbook_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pack_name text;
  pack_description text;
  new_playbook_id uuid;
  new_play_id uuid;
  rec record;
BEGIN
  IF NOT is_pro() THEN
    RAISE EXCEPTION 'Cloning a starter playbook pack requires Pro. Upgrade to Pro for unlimited playbooks and one-tap pack cloning.'
      USING ERRCODE = 'PBP03';
  END IF;

  SELECT name, description INTO pack_name, pack_description
  FROM playbooks WHERE id = pack_playbook_id AND is_public = true;

  IF pack_name IS NULL THEN
    RAISE EXCEPTION 'This starter playbook pack could not be found.'
      USING ERRCODE = 'PBP04';
  END IF;

  INSERT INTO playbooks (user_id, name, description)
  VALUES (auth.uid(), pack_name, pack_description)
  RETURNING id INTO new_playbook_id;

  FOR rec IN
    SELECT p.name, p.description, p.type, p.canvas_data, p.formation_id, p.thumbnail, p.metadata, pp.order_position
    FROM playbook_plays pp
    JOIN plays p ON p.id = pp.play_id
    WHERE pp.playbook_id = pack_playbook_id
    ORDER BY pp.order_position
  LOOP
    INSERT INTO plays (user_id, name, description, type, canvas_data, formation_id, thumbnail, metadata, is_public)
    VALUES (auth.uid(), rec.name, rec.description, rec.type, rec.canvas_data, rec.formation_id, rec.thumbnail, rec.metadata, false)
    RETURNING id INTO new_play_id;

    INSERT INTO playbook_plays (playbook_id, play_id, order_position)
    VALUES (new_playbook_id, new_play_id, rec.order_position);
  END LOOP;

  RETURN new_playbook_id;
END;
$$;

GRANT EXECUTE ON FUNCTION clone_playbook_pack(uuid) TO authenticated;
