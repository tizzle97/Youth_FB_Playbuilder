-- Play voting (BACKLOG B-10). Idempotent — safe to run more than once.
-- Upvotes on public plays: one vote per user per play, with the count cached
-- on plays.upvotes (trigger-maintained, mirroring posts/comments votes).
-- Run manually in the Supabase SQL Editor.

-- Cached vote count on plays (what cards and TopPlays sort/display by)
ALTER TABLE plays ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS play_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  play_id uuid NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, play_id)
);

CREATE INDEX IF NOT EXISTS play_votes_play_id_idx ON play_votes (play_id);

ALTER TABLE play_votes ENABLE ROW LEVEL SECURITY;

-- Anyone may read votes (public counts); users manage only their own vote,
-- and may only vote on public plays.
DROP POLICY IF EXISTS "play_votes_select" ON play_votes;
CREATE POLICY "play_votes_select" ON play_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "play_votes_insert_own" ON play_votes;
CREATE POLICY "play_votes_insert_own" ON play_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM plays p WHERE p.id = play_id AND p.is_public)
  );

DROP POLICY IF EXISTS "play_votes_delete_own" ON play_votes;
CREATE POLICY "play_votes_delete_own" ON play_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Keep plays.upvotes in sync. SECURITY DEFINER with pinned search_path (per
-- security_hardening.sql conventions) because the voter has no RLS permission
-- to UPDATE someone else's plays row.
CREATE OR REPLACE FUNCTION update_play_vote_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE plays SET upvotes = upvotes + 1 WHERE id = NEW.play_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE plays SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.play_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_play_vote_counts_insert ON play_votes;
CREATE TRIGGER update_play_vote_counts_insert
AFTER INSERT ON play_votes
FOR EACH ROW EXECUTE FUNCTION update_play_vote_counts();

DROP TRIGGER IF EXISTS update_play_vote_counts_delete ON play_votes;
CREATE TRIGGER update_play_vote_counts_delete
AFTER DELETE ON play_votes
FOR EACH ROW EXECUTE FUNCTION update_play_vote_counts();

-- Recompute cached counts (no-op unless they drifted / on first run)
UPDATE plays p
SET upvotes = sub.n
FROM (SELECT play_id, COUNT(*) AS n FROM play_votes GROUP BY play_id) sub
WHERE p.id = sub.play_id AND p.upvotes <> sub.n;
