-- B-36 (1): Per-matchup coaching notes on the "Vs. Defense" view.
-- Run this once in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- A note is personal to the coach viewing a matchup, not tied to who owns
-- either play — the offense on /vs?play=<id> can be someone else's public
-- play (RLS already allows reading those), but the note itself only ever
-- belongs to the signed-in viewer. Keyed on (user_id, offense_play_id,
-- defense_play_id) rather than a play_id column, since it's the pairing
-- that's being annotated ("vs Cover 2, hit the flat"), not either play alone.

CREATE TABLE IF NOT EXISTS matchup_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offense_play_id uuid NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  defense_play_id uuid NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, offense_play_id, defense_play_id)
);

-- Loading a matchup fetches every note for the offense in one query
-- (VsDefenseView loads the whole defensive deck up front), so this is the
-- lookup path that matters.
CREATE INDEX IF NOT EXISTS matchup_notes_lookup_idx
  ON matchup_notes (user_id, offense_play_id);

ALTER TABLE matchup_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own matchup notes" ON matchup_notes;
CREATE POLICY "Users manage their own matchup notes"
  ON matchup_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reuses the same update_updated_at_column() function combined_migrations.sql
-- already defines and wires to plays/playbooks — no new function needed.
DROP TRIGGER IF EXISTS update_matchup_notes_updated_at ON matchup_notes;
CREATE TRIGGER update_matchup_notes_updated_at
  BEFORE UPDATE ON matchup_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
