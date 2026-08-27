-- Issue #121: the two hottest `plays` query paths have no supporting index —
-- only the primary key. At today's row counts (~100) Postgres sequential-scans
-- happily and the planner would likely ignore these anyway; they're cheap
-- insurance filed before it becomes a problem somewhere in the low thousands
-- of rows, per the issue's `EXPLAIN ANALYZE` guidance.

-- My Plays (`PlaysPage.tsx`): `.eq('user_id', currentUser.id)` on every load.
CREATE INDEX IF NOT EXISTS plays_user_id_idx ON plays (user_id);

-- Community (`PlayLibrary.tsx`): `.eq('is_public', true).order('upvotes',
-- {ascending:false}).order('created_at', {ascending:false})` on every load.
-- Partial + matches the query's exact sort, so it can serve the filter and
-- the sort together — same shape as the existing `feedback_untriaged_idx`.
CREATE INDEX IF NOT EXISTS plays_public_upvotes_idx
  ON plays (upvotes DESC, created_at DESC) WHERE is_public;
