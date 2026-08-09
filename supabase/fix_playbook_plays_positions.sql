-- Repairs playbook_plays rows left at an invalid order_position (<= 0) by
-- the drag-to-reorder bug fixed alongside this file: a failed reorder wrote
-- rows to a temporary negative order_position and, on error, only rolled
-- back the browser's on-screen state — never the database write. Once that
-- happened once, every later reorder attempt in that playbook collided with
-- the stranded row and failed immediately (23505 duplicate key on
-- playbook_plays_playbook_id_order_position_key).
--
-- Idempotent — renumbers only playbooks that currently have a row with
-- order_position <= 0; running it again once everything is positive is a
-- no-op. Relative order for a repaired playbook is taken from its current
-- (partially-corrupted) order_position, so a stranded row may not land back
-- in its exact pre-failure spot — reordering afterward fixes that by hand.
DO $$
DECLARE
  affected_playbook_id uuid;
BEGIN
  FOR affected_playbook_id IN
    SELECT DISTINCT playbook_id FROM playbook_plays WHERE order_position <= 0
  LOOP
    -- Phase A: bump every row in this playbook to a unique, guaranteed-clear
    -- negative position first, same two-phase reasoning as the client fix —
    -- a direct renumber to 1..N could collide with another row's current value.
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY order_position) AS rn
      FROM playbook_plays
      WHERE playbook_id = affected_playbook_id
    )
    UPDATE playbook_plays pp
    SET order_position = -1000000000 - ranked.rn
    FROM ranked
    WHERE pp.id = ranked.id;

    -- Phase B: final sequential positive positions.
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY order_position) AS rn
      FROM playbook_plays
      WHERE playbook_id = affected_playbook_id
    )
    UPDATE playbook_plays pp
    SET order_position = ranked.rn
    FROM ranked
    WHERE pp.id = ranked.id;
  END LOOP;
END $$;
