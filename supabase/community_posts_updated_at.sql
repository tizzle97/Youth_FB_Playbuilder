-- Keep posts.updated_at accurate when a coach edits their own post.
-- Run this once in the Supabase SQL Editor. Idempotent — safe to re-run.
--
-- posts already has an updated_at column, but unlike plays/playbooks no
-- trigger refreshes it on UPDATE, so an edited post would render identically
-- to an unedited one. Reuses the same update_updated_at_column() function
-- combined_migrations.sql already defines and wires to plays/playbooks —
-- no new function needed, just the missing trigger for this table.

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
