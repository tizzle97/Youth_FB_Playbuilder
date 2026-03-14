/*
  # Admin system and blog posts setup

  1. New Tables
    - `admin_users`
      - `user_id` (uuid, primary key, references auth.users)
      - `created_at` (timestamp)
    - `blog_posts`
      - `id` (uuid, primary key)
      - `title` (text)
      - `content` (text)
      - `author_id` (uuid, references auth.users)
      - `published_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add admin policies for plays and comments
    - Add blog post policies for public reading and admin management
    - Add admin_users policies

  3. Functions
    - `delete_user()` - Admin-only function to delete users
    - `is_admin()` - Check if current user is admin
*/

-- Create admin_users table to track admin status
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing admin policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;

-- Create admin policies for plays
CREATE POLICY "Admins can manage all plays"
  ON plays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    ) OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    ) OR user_id = auth.uid()
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
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Create function to enforce admin blog posts constraint
CREATE OR REPLACE FUNCTION enforce_admin_blog_posts()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = NEW.author_id
  ) THEN
    RAISE EXCEPTION 'Only admins can create blog posts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce admin constraint on blog posts
DROP TRIGGER IF EXISTS enforce_admin_blog_posts_trigger ON blog_posts;
CREATE TRIGGER enforce_admin_blog_posts_trigger
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_blog_posts();

-- Drop existing blog post policies if they exist
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;

-- Create blog post policies
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  TO public
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

-- Drop existing admin_users policy if it exists
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;

-- Create policy for admin_users table
CREATE POLICY "Only admins can view admin list"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Insert initial admin (replace with actual admin user ID)
-- INSERT INTO admin_users (user_id) VALUES ('your-admin-user-id-here');