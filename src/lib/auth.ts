import { supabase } from './supabase';

/** The key supabase-js persists the session under: `sb-<project-ref>-auth-token`. */
function sessionStorageKey(): string {
  const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

/**
 * Signs the user out and never rejects. Guarantees the session is gone locally
 * even when the server refuses the logout.
 *
 * Two failure modes this exists to absorb, both observed in the browser:
 *
 * 1. The three sign-out call sites used to `await supabase.auth.signOut()` bare
 *    and then navigate. Any rejection meant the navigation never ran and the
 *    button appeared to do nothing.
 *
 * 2. When the session is already gone server-side, `/auth/v1/logout` returns
 *    403 and gotrue rejects with AuthSessionMissingError — for BOTH
 *    `scope: 'global'` and `scope: 'local'` — while **leaving the persisted
 *    token in localStorage**. The app then still looks signed in. So the
 *    fallback clears the key directly and hard-reloads, because a client-side
 *    navigate() would leave components holding stale auth state.
 *
 * On the happy path this is just `signOut()`; callers navigate afterwards.
 */
export async function signOutSafely(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return;
  } catch (err) {
    console.error('Sign out failed; forcing a local sign-out instead:', err);
  }

  try {
    localStorage.removeItem(sessionStorageKey());
  } catch {
    // Storage blocked — the reload below is still worth attempting.
  }
  // Full reload rather than a router navigate: every component that cached the
  // user must be rebuilt, or the UI keeps showing a signed-in state.
  window.location.assign('/');
}
