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