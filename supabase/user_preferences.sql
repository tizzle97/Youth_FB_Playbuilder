-- User preferences store (BACKLOG B-14 team identity + B-15 save/export
-- defaults). Idempotent — safe to run more than once.
-- Run manually in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- B-14: team identity (stamped on exports) + designer default
  team_name text,
  team_logo_url text,
  default_game_format text NOT NULL DEFAULT '5v5'
    CHECK (default_game_format IN ('5v5', '7v7', '11v11')),
  -- B-15: save & export defaults
  default_visibility text NOT NULL DEFAULT 'private'
    CHECK (default_visibility IN ('private', 'public')),
  default_play_type text NOT NULL DEFAULT 'pass'
    CHECK (default_play_type IN ('pass', 'run', 'option', 'reverse', 'screen', 'trick')),
  paper_size text NOT NULL DEFAULT 'letter'
    CHECK (paper_size IN ('letter', 'a4')),
  default_export_style text NOT NULL DEFAULT 'detailed'
    CHECK (default_export_style IN ('simple', 'detailed', 'grid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users manage only their own row; nothing here is public.
DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;
CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete_own" ON user_preferences;
CREATE POLICY "user_preferences_delete_own" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
