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
CREATE POLICY "Only admins can view admin list"
ON admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Update plays policies to handle admin access without recursion
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