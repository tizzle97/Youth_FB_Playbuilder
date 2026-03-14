-- Create admin_users table to track admin status
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create admin policies for plays
CREATE POLICY "Admins can manage all plays"
  ON plays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create admin policies for comments
CREATE POLICY "Admins can delete any comment"
  ON comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create function to delete users (admin only)
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Only allow admins to delete users
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete user's data from public schema tables
  DELETE FROM profiles WHERE id = target_user_id;
  -- Cascading delete will handle related data
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT author_must_be_admin CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = author_id
    )
  )
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Create blog post policies
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage blog posts"
  ON blog_posts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy for admin_users table
CREATE POLICY "Only admins can view admin list"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Insert initial admin (replace with actual admin user ID)
-- INSERT INTO admin_users (user_id) VALUES ('your-admin-user-id-here');