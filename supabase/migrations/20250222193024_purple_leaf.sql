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
CREATE POLICY "Users can create reports"
  ON image_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON image_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

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
CREATE TRIGGER on_report_approved
  AFTER UPDATE ON image_reports
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_approved_report();