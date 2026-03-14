/*
  # Add User Avatar Support

  1. New Tables
    - `avatar_icons` - Pool of available avatar icons
      - `id` (uuid, primary key)
      - `icon_url` (text)
      - `name` (text)
      - `created_at` (timestamp)

  2. Changes to Existing Tables
    - Add to `user_reputation`:
      - `avatar_type` (text) - 'custom' or 'icon'
      - `avatar_url` (text) - URL for custom avatar
      - `avatar_icon_id` (uuid) - Reference to selected icon

  3. Security
    - Enable RLS on new table
    - Add policies for reading icons
    - Add policies for users to update their avatar preferences
*/

-- Create avatar_icons table
CREATE TABLE IF NOT EXISTS avatar_icons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_url text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE avatar_icons ENABLE ROW LEVEL SECURITY;

-- Add avatar columns to user_reputation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_reputation' AND column_name = 'avatar_type'
  ) THEN
    ALTER TABLE user_reputation 
      ADD COLUMN avatar_type text DEFAULT 'icon',
      ADD COLUMN avatar_url text,
      ADD COLUMN avatar_icon_id uuid REFERENCES avatar_icons(id);
  END IF;
END $$;

-- Create policies
CREATE POLICY "Anyone can read avatar icons"
  ON avatar_icons FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own avatar settings"
  ON user_reputation FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default avatar icons
INSERT INTO avatar_icons (icon_url, name) VALUES
  ('https://api.dicebear.com/7.x/bottts/svg?seed=1', 'Bot 1'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=2', 'Bot 2'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=3', 'Bot 3'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=4', 'Bot 4'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=5', 'Bot 5'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=6', 'Bot 6'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=7', 'Bot 7'),
  ('https://api.dicebear.com/7.x/bottts/svg?seed=8', 'Bot 8')
ON CONFLICT DO NOTHING;