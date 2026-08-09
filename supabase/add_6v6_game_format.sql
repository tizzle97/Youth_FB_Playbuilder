-- Widens the game_type / default_game_format CHECK constraints to allow
-- '6v6', alongside the new 6v6 formation templates and the frontend
-- gameType union. Idempotent — DROP/ADD is safe to re-run.
--
-- Constraint names are Postgres's default auto-generated names for an
-- inline column CHECK (`<table>_<column>_check`), matching what
-- custom_formations.sql / user_preferences.sql created.

ALTER TABLE custom_formations DROP CONSTRAINT IF EXISTS custom_formations_game_type_check;
ALTER TABLE custom_formations ADD CONSTRAINT custom_formations_game_type_check
  CHECK (game_type IN ('5v5', '6v6', '7v7', '11v11'));

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_default_game_format_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_default_game_format_check
  CHECK (default_game_format IN ('5v5', '6v6', '7v7', '11v11'));
