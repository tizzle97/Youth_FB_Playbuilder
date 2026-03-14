-- Create play_type enum
CREATE TYPE play_type AS ENUM ('offense', 'defense', 'special_teams');

-- Create formations table
CREATE TABLE IF NOT EXISTS formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type play_type NOT NULL,
  template text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system boolean DEFAULT false
);

ALTER TABLE formations ENABLE ROW LEVEL SECURITY;

-- Create plays table
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

ALTER TABLE plays ENABLE ROW LEVEL SECURITY;

-- Create playbooks table
CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Create playbook_plays table
CREATE TABLE IF NOT EXISTS playbook_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid REFERENCES playbooks(id) ON DELETE CASCADE,
  play_id uuid REFERENCES plays(id) ON DELETE CASCADE,
  order_position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (playbook_id, play_id),
  UNIQUE (playbook_id, order_position)
);

ALTER TABLE playbook_plays ENABLE ROW LEVEL SECURITY;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type play_type NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES playbooks(id) ON DELETE CASCADE,
  order_position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (playbook_id, parent_id, order_position)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL
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
CREATE TRIGGER update_plays_updated_at
  BEFORE UPDATE ON plays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create system user for default formations
DO $$
DECLARE
  system_user_id uuid;
BEGIN
  -- Create system user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'system@playbook.pro',
    crypt('system-password-never-used', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"system"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO system_user_id;

  -- Insert default formations
  INSERT INTO formations (name, type, template, user_id, is_system) VALUES
    ('Shotgun', 'offense', '{"objects":[]}', system_user_id, true),
    ('I-Formation', 'offense', '{"objects":[]}', system_user_id, true),
    ('4-3 Defense', 'defense', '{"objects":[]}', system_user_id, true),
    ('3-4 Defense', 'defense', '{"objects":[]}', system_user_id, true),
    ('Punt Formation', 'special_teams', '{"objects":[]}', system_user_id, true)
  ON CONFLICT DO NOTHING;
END $$;