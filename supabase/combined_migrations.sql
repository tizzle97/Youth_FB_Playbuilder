-- Playbuilder Pro - Combined Supabase Migrations
-- Run this entire file in the Supabase SQL Editor
-- Generated: Fri Jun  5 22:45:00 EDT 2026

-- ============================================================
-- Migration: 20250222152424_amber_cake.sql
-- ============================================================
/*
  # Community Schema Setup

  1. New Tables
    - posts (for community forum posts)
    - comments (for post comments)
    - votes (for post/comment voting)
    - user_reputation (for tracking user reputation)

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated users
    - Vote constraints to prevent duplicate votes

  3. Features
    - Automatic vote counting
    - User reputation tracking
    - Nested comments support
*/

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  post_id uuid REFERENCES posts ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES comments ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  post_id uuid REFERENCES posts ON DELETE CASCADE,
  comment_id uuid REFERENCES comments ON DELETE CASCADE,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT vote_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_vote UNIQUE (user_id, post_id),
  CONSTRAINT unique_comment_vote UNIQUE (user_id, comment_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create user_reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  reputation integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
CREATE POLICY "Anyone can read posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create posts" ON posts;
CREATE POLICY "Users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create and update their own votes" ON votes;
CREATE POLICY "Users can create and update their own votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read user reputation" ON user_reputation;
CREATE POLICY "Anyone can read user reputation"
  ON user_reputation FOR SELECT
  TO authenticated
  USING (true);

-- Create functions and triggers for vote counting
CREATE OR REPLACE FUNCTION update_post_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_post_vote_counts_insert ON votes;
CREATE TRIGGER update_post_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

DROP TRIGGER IF EXISTS update_post_vote_counts_delete ON votes;
CREATE TRIGGER update_post_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comment_vote_counts_insert ON votes;
CREATE TRIGGER update_comment_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

DROP TRIGGER IF EXISTS update_comment_vote_counts_delete ON votes;
CREATE TRIGGER update_comment_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

-- Create function to update user reputation
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_reputation (user_id, reputation)
  VALUES (NEW.user_id, 10)
  ON CONFLICT (user_id)
  DO UPDATE SET
    reputation = user_reputation.reputation + 10,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_reputation_on_post ON posts;
CREATE TRIGGER update_user_reputation_on_post
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

DROP TRIGGER IF EXISTS update_user_reputation_on_comment ON comments;
CREATE TRIGGER update_user_reputation_on_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

-- ============================================================
-- Migration: 20250222154941_violet_violet.sql
-- ============================================================
/*
  # Community Forum Schema Update

  1. Changes
    - Add foreign key reference from posts to auth.users
    - Update RLS policies for posts and user_reputation
    - Fix user reputation trigger
    - Add proper join relationships

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT vote_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_vote UNIQUE (user_id, post_id),
  CONSTRAINT unique_comment_vote UNIQUE (user_id, comment_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create user_reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  reputation integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
DROP POLICY IF EXISTS "Users can create and update their own votes" ON votes;
DROP POLICY IF EXISTS "Anyone can read user reputation" ON user_reputation;

-- Create updated policies
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
CREATE POLICY "Anyone can read posts"
  ON posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create posts" ON posts;
CREATE POLICY "Users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create votes" ON votes;
CREATE POLICY "Users can create votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read user reputation" ON user_reputation;
CREATE POLICY "Anyone can read user reputation"
  ON user_reputation FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own reputation" ON user_reputation;
CREATE POLICY "Users can update their own reputation"
  ON user_reputation FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create or replace functions and triggers
CREATE OR REPLACE FUNCTION update_post_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_reputation (user_id, reputation)
  VALUES (NEW.user_id, 10)
  ON CONFLICT (user_id)
  DO UPDATE SET
    reputation = user_reputation.reputation + 10,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_post_vote_counts_insert ON votes;
DROP TRIGGER IF EXISTS update_post_vote_counts_delete ON votes;
DROP TRIGGER IF EXISTS update_comment_vote_counts_insert ON votes;
DROP TRIGGER IF EXISTS update_comment_vote_counts_delete ON votes;
DROP TRIGGER IF EXISTS update_user_reputation_on_post ON posts;
DROP TRIGGER IF EXISTS update_user_reputation_on_comment ON comments;

-- Create triggers
DROP TRIGGER IF EXISTS update_post_vote_counts_insert ON votes;
CREATE TRIGGER update_post_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

DROP TRIGGER IF EXISTS update_post_vote_counts_delete ON votes;
CREATE TRIGGER update_post_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

DROP TRIGGER IF EXISTS update_comment_vote_counts_insert ON votes;
CREATE TRIGGER update_comment_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

DROP TRIGGER IF EXISTS update_comment_vote_counts_delete ON votes;
CREATE TRIGGER update_comment_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

DROP TRIGGER IF EXISTS update_user_reputation_on_post ON posts;
CREATE TRIGGER update_user_reputation_on_post
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

DROP TRIGGER IF EXISTS update_user_reputation_on_comment ON comments;
CREATE TRIGGER update_user_reputation_on_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

-- ============================================================
-- Migration: 20250222155337_hidden_glade.sql
-- ============================================================
/*
  # Fix schema and policies for community features

  1. Changes
    - Add explicit foreign key reference to auth.users
    - Update RLS policies for better security
    - Fix user reputation table structure
    - Add missing policies for votes and reputation

  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for CRUD operations
    - Ensure proper user authorization
*/

-- Drop existing tables to rebuild with correct relationships
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS user_reputation CASCADE;

-- Create posts table with explicit auth.users reference
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  parent_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid,
  comment_id uuid,
  vote_type boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT vote_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_vote UNIQUE (user_id, post_id),
  CONSTRAINT unique_comment_vote UNIQUE (user_id, comment_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create user_reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reputation integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_reputation UNIQUE (user_id)
);

ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

-- Create policies for posts
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
CREATE POLICY "Anyone can read posts"
  ON posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create posts" ON posts;
CREATE POLICY "Users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for comments
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for votes
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create votes" ON votes;
CREATE POLICY "Users can create votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own votes" ON votes;
CREATE POLICY "Users can update their own votes"
  ON votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own votes" ON votes;
CREATE POLICY "Users can delete their own votes"
  ON votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for user_reputation
DROP POLICY IF EXISTS "Anyone can read user reputation" ON user_reputation;
CREATE POLICY "Anyone can read user reputation"
  ON user_reputation FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "System can manage user reputation" ON user_reputation;
CREATE POLICY "System can manage user reputation"
  ON user_reputation FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create or replace functions
CREATE OR REPLACE FUNCTION update_post_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NOT NEW.vote_type THEN 1 ELSE 0 END
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN NOT OLD.vote_type THEN 1 ELSE 0 END
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_reputation (user_id, reputation)
  VALUES (NEW.user_id, 10)
  ON CONFLICT (user_id)
  DO UPDATE SET
    reputation = user_reputation.reputation + 10,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS update_post_vote_counts_insert ON votes;
CREATE TRIGGER update_post_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

DROP TRIGGER IF EXISTS update_post_vote_counts_delete ON votes;
CREATE TRIGGER update_post_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

DROP TRIGGER IF EXISTS update_comment_vote_counts_insert ON votes;
CREATE TRIGGER update_comment_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

DROP TRIGGER IF EXISTS update_comment_vote_counts_delete ON votes;
CREATE TRIGGER update_comment_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

DROP TRIGGER IF EXISTS update_user_reputation_on_post ON posts;
CREATE TRIGGER update_user_reputation_on_post
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

DROP TRIGGER IF EXISTS update_user_reputation_on_comment ON comments;
CREATE TRIGGER update_user_reputation_on_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

-- ============================================================
-- Migration: 20250222185643_billowing_queen.sql
-- ============================================================
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
DROP POLICY IF EXISTS "Anyone can read avatar icons" ON avatar_icons;
CREATE POLICY "Anyone can read avatar icons"
  ON avatar_icons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own avatar settings" ON user_reputation;
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

-- ============================================================
-- Migration: 20250222190046_bold_haze.sql
-- ============================================================
/*
  # Add Storage Bucket for Avatars

  1. New Storage Bucket
    - Create 'avatars' bucket for storing user profile pictures
    - Set up public access policies
    - Configure size limits and allowed file types

  2. Security
    - Enable public read access
    - Restrict write access to authenticated users
    - Limit file uploads to images only
*/

-- Create the avatars storage bucket (Supabase manages storage.buckets/objects tables)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies (storage.objects already exists in Supabase)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Avatar images are publicly accessible'
  ) THEN
    CREATE POLICY "Avatar images are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own avatar'
  ) THEN
    CREATE POLICY "Users can upload their own avatar"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own avatar'
  ) THEN
    CREATE POLICY "Users can delete their own avatar"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- ============================================================
-- Migration: 20250222190208_teal_crystal.sql
-- ============================================================
/*
  # Add User Signup Trigger

  1. New Function and Trigger
    - Create function to handle new user signups
    - Add trigger to automatically create user_reputation record
    - Set default avatar settings for new users

  2. Security
    - Function runs with SECURITY DEFINER to ensure it has necessary permissions
*/

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user_reputation record with default avatar settings
  INSERT INTO public.user_reputation (
    user_id,
    reputation,
    avatar_type,
    avatar_icon_id
  )
  VALUES (
    NEW.id,
    0,
    'icon',
    (SELECT id FROM public.avatar_icons ORDER BY created_at ASC LIMIT 1)
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();

-- ============================================================
-- Migration: 20250222193024_purple_leaf.sql
-- ============================================================
/*
  # Add image moderation system

  1. New Tables
    - `image_reports`
      - `id` (uuid, primary key)
      - `reporter_id` (uuid, references auth.users)
      - `reported_user_id` (uuid, references auth.users)
      - `image_url` (text)
      - `reason` (text)
      - `status` (text: 'pending', 'approved', 'rejected')
      - `created_at` (timestamp)
      - `resolved_at` (timestamp)
      - `resolver_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on `image_reports` table
    - Add policies for reporting and viewing reports
*/

-- Create image_reports table
CREATE TABLE IF NOT EXISTS image_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users NOT NULL,
  reported_user_id uuid REFERENCES auth.users NOT NULL,
  image_url text NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolver_id uuid REFERENCES auth.users,
  CONSTRAINT different_users CHECK (reporter_id != reported_user_id)
);

ALTER TABLE image_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can create reports" ON image_reports;
CREATE POLICY "Users can create reports"
  ON image_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their own reports" ON image_reports;
CREATE POLICY "Users can view their own reports"
  ON image_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Moderators can view all reports" ON image_reports;
CREATE POLICY "Moderators can view all reports"
  ON image_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  );

DROP POLICY IF EXISTS "Moderators can update reports" ON image_reports;
CREATE POLICY "Moderators can update reports"
  ON image_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  );

-- Create function to handle approved reports
CREATE OR REPLACE FUNCTION handle_approved_report()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Reset the reported user's avatar to default
    UPDATE user_reputation
    SET 
      avatar_type = 'icon',
      avatar_url = NULL,
      avatar_icon_id = (SELECT id FROM avatar_icons ORDER BY created_at ASC LIMIT 1)
    WHERE user_id = NEW.reported_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for handling approved reports
DROP TRIGGER IF EXISTS on_report_approved ON image_reports;
CREATE TRIGGER on_report_approved
  AFTER UPDATE ON image_reports
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_approved_report();

-- ============================================================
-- Migration: 20250222223954_rough_bar.sql
-- ============================================================
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
DROP POLICY IF EXISTS "Anyone can read formations" ON formations;
CREATE POLICY "Anyone can read formations"
  ON formations FOR SELECT
  USING (is_system OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own formations" ON formations;
CREATE POLICY "Users can manage their own formations"
  ON formations FOR ALL
  USING (NOT is_system AND auth.uid() = user_id)
  WITH CHECK (NOT is_system AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own plays" ON plays;
CREATE POLICY "Users can manage their own plays"
  ON plays FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own playbooks" ON playbooks;
CREATE POLICY "Users can manage their own playbooks"
  ON playbooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own playbook_plays" ON playbook_plays;
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

DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
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

-- ============================================================
-- Migration: 20250302003433_nameless_bird.sql
-- ============================================================
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
DROP POLICY IF EXISTS "Anyone can read formations" ON formations;
CREATE POLICY "Anyone can read formations"
  ON formations FOR SELECT
  USING (is_system OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own formations" ON formations;
CREATE POLICY "Users can manage their own formations"
  ON formations FOR ALL
  USING (NOT is_system AND auth.uid() = user_id)
  WITH CHECK (NOT is_system AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own plays" ON plays;
CREATE POLICY "Users can manage their own plays"
  ON plays FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own playbooks" ON playbooks;
CREATE POLICY "Users can manage their own playbooks"
  ON playbooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own playbook_plays" ON playbook_plays;
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
DROP TRIGGER IF EXISTS update_plays_updated_at ON plays;
CREATE TRIGGER update_plays_updated_at
  BEFORE UPDATE ON plays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playbooks_updated_at ON playbooks;
DROP TRIGGER IF EXISTS update_playbooks_updated_at ON playbooks;
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration: 20250319045037_muddy_poetry.sql
-- ============================================================
/*
  # Add Feedback System

  1. New Tables
    - `feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `type` (text) - 'bug', 'feature', 'general'
      - `content` (text)
      - `status` (text) - 'pending', 'reviewed', 'resolved'
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Allow authenticated users to submit feedback
    - Allow users to view their own feedback
*/

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can create feedback" ON feedback;
CREATE POLICY "Users can create feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
CREATE POLICY "Users can view their own feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration: 20250530163549_small_lodge.sql
-- ============================================================
-- Admin role support via admin_users table (not auth.users column)

-- Create admin_users table early so policies below can reference it
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Helper function: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for plays
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
CREATE POLICY "Admins can manage all plays"
  ON plays FOR ALL
  TO authenticated
  USING (is_admin());

-- Admin policies for comments
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;
CREATE POLICY "Admins can delete any comment"
  ON comments FOR DELETE
  TO authenticated
  USING (is_admin());

-- Function to delete a user (admin only, deletes public data; auth record cascades)
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  DELETE FROM profiles WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Blog posts table (CHECK constraint cannot query other tables in Postgres;
-- admin enforcement is handled via RLS policy below)
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

DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;
CREATE POLICY "Only admins can manage blog posts"
  ON blog_posts FOR ALL
  TO authenticated
  USING (is_admin());

-- ============================================================
-- Migration: 20250530163822_precious_shrine.sql
-- ============================================================
-- Create admin_users table to track admin status
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create admin policies for plays
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
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
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;
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
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;
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
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;
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

-- ============================================================
-- Migration: 20250530163844_wandering_water.sql
-- ============================================================
-- Create admin_users table to track admin status
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create admin policies for plays
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
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
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;
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

-- Create function to enforce admin-only blog posts
CREATE OR REPLACE FUNCTION enforce_admin_blog_posts()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = NEW.author_id
  ) THEN
    RAISE EXCEPTION 'Only admins can create blog posts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin-only blog posts
DROP TRIGGER IF EXISTS enforce_admin_blog_posts_trigger ON blog_posts;
CREATE TRIGGER enforce_admin_blog_posts_trigger
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_admin_blog_posts();

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Create blog post policies
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;
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
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;
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

-- ============================================================
-- Migration: 20250530171512_humble_temple.sql
-- ============================================================
/*
  # Fix RLS policies for admin_users and plays tables

  1. Changes
    - Simplify admin_users RLS policy to avoid recursion
    - Update plays table policies to handle admin access without recursion
    - Add index on admin_users.user_id for better performance

  2. Security
    - Maintain existing security model where:
      - Admins can manage all plays
      - Users can manage their own plays
      - Public plays are viewable by everyone
    - Prevent infinite recursion in policy evaluation
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;

-- Create new policies that avoid recursion
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;
CREATE POLICY "Only admins can view admin list"
ON admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Update plays policies to handle admin access without recursion
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
CREATE POLICY "Admins can manage all plays"
ON plays
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
  OR user_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Add index to improve policy performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- ============================================================
-- Migration: 20250624231947_delicate_morning.sql
-- ============================================================
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
DROP POLICY IF EXISTS "Admins can manage all plays" ON plays;
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
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;
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
DROP TRIGGER IF EXISTS enforce_admin_blog_posts_trigger ON blog_posts;
CREATE TRIGGER enforce_admin_blog_posts_trigger
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_blog_posts();

-- Drop existing blog post policies if they exist
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;

-- Create blog post policies
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage blog posts" ON blog_posts;
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
DROP POLICY IF EXISTS "Only admins can view admin list" ON admin_users;
CREATE POLICY "Only admins can view admin list"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Insert initial admin (replace with actual admin user ID)
-- INSERT INTO admin_users (user_id) VALUES ('your-admin-user-id-here');

