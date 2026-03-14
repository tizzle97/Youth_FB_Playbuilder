/*
  # Football Playbook Schema

  1. New Tables
    - `formations` - Stores predefined formations for plays
    - `plays` - Stores user-created plays with canvas data
    - `playbooks` - Stores collections of plays
    - `playbook_plays` - Junction table linking plays to playbooks

  2. Security
    - Enable RLS on all tables
    - Create policies for user access control
*/

-- Check if play_type enum exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'play_type') THEN
    CREATE TYPE play_type AS ENUM ('offense', 'defense', 'special_teams');
  END IF;
END$$;

-- Create formations table if it doesn't exist
CREATE TABLE IF NOT EXISTS formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type play_type NOT NULL,
  template text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system boolean DEFAULT false
);

-- Enable RLS on formations table
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;

-- Create plays table if it doesn't exist
CREATE TABLE IF NOT EXISTS plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type play_type NOT NULL,
  formation_id uuid REFERENCES formations(id) ON DELETE SET NULL,
  canvas_data text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on plays table
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;

-- Create playbooks table if it doesn't exist
CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on playbooks table
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Create playbook_plays table if it doesn't exist
CREATE TABLE IF NOT EXISTS playbook_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid REFERENCES playbooks(id) ON DELETE CASCADE,
  play_id uuid REFERENCES plays(id) ON DELETE CASCADE,
  order_position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (playbook_id, play_id),
  UNIQUE (playbook_id, order_position)
);

-- Enable RLS on playbook_plays table
ALTER TABLE playbook_plays ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read formations" ON formations;
DROP POLICY IF EXISTS "Users can manage their own formations" ON formations;
DROP POLICY IF EXISTS "Users can manage their own plays" ON plays;
DROP POLICY IF EXISTS "Users can manage their own playbooks" ON playbooks;
DROP POLICY IF EXISTS "Users can manage their own playbook_plays" ON playbook_plays;

-- Create RLS policies
CREATE POLICY "Anyone can read formations"
  ON formations FOR SELECT
  USING (is_system OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own formations"
  ON formations FOR ALL
  USING (NOT is_system AND auth.uid() = user_id)
  WITH CHECK (NOT is_system AND auth.uid() = user_id);

CREATE POLICY "Users can manage their own plays"
  ON plays FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own playbooks"
  ON playbooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own playbook_plays"
  ON playbook_plays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM playbooks
      WHERE playbooks.id = playbook_id
      AND playbooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playbooks
      WHERE playbooks.id = playbook_id
      AND playbooks.user_id = auth.uid()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_plays_updated_at ON plays;
CREATE TRIGGER update_plays_updated_at
  BEFORE UPDATE ON plays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playbooks_updated_at ON playbooks;
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();