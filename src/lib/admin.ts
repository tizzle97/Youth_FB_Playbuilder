import { supabase } from './supabase';

/**
 * Server-verified admin check. Queries `admin_users` directly rather than
 * trusting `user.user_metadata.is_admin` — user metadata is user-controllable
 * (see SCHEMA.md: "Never trust auth.users.raw_user_meta_data for
 * authorization"), so it must never gate anything, even UI-only visibility.
 * RLS on `admin_users` ("Only admins can view admin list", USING (auth.uid()
 * = user_id)) lets any signed-in user check only their own membership row,
 * which is exactly what this needs.
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
