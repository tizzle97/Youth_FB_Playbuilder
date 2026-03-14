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
CREATE POLICY "Anyone can read posts"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "Users can create votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read user reputation"
  ON user_reputation FOR SELECT
  USING (true);

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
CREATE TRIGGER update_post_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

CREATE TRIGGER update_post_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.post_id IS NOT NULL)
EXECUTE FUNCTION update_post_vote_counts();

CREATE TRIGGER update_comment_vote_counts_insert
AFTER INSERT ON votes
FOR EACH ROW
WHEN (NEW.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

CREATE TRIGGER update_comment_vote_counts_delete
AFTER DELETE ON votes
FOR EACH ROW
WHEN (OLD.comment_id IS NOT NULL)
EXECUTE FUNCTION update_comment_vote_counts();

CREATE TRIGGER update_user_reputation_on_post
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();

CREATE TRIGGER update_user_reputation_on_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation();