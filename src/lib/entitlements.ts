import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Free-tier limits (Phase 1: defined here for later gating phases).
export const FREE_LIMITS = {
  plays: 15,
  playbooks: 2,
} as const;

export type Plan = 'free' | 'founding' | 'pro';

export interface Entitlement {
  loading: boolean;
  isPro: boolean;
  plan: Plan;
  isFoundingMember: boolean;
}

/** True if the subscription row grants active Pro access. Exported for
 *  components that must read `subscriptions` directly instead of via
 *  useEntitlement() — e.g. AccountSettings, where the hook's own
 *  auth.getUser() call would deadlock gotrue-js's session lock (see the
 *  B-4 note in BACKLOG.md). */
export function rowIsPro(row: { plan?: string; current_period_end?: string | null } | null): boolean {
  if (!row) return false;
  if (row.plan !== 'founding' && row.plan !== 'pro') return false;
  if (row.current_period_end && new Date(row.current_period_end) <= new Date()) return false;
  return true;
}

/** True once a free user is down to their last free slot (or already at the
 *  cap) for a FREE_LIMITS counter — the threshold for showing an early
 *  upgrade nudge before the server-side trigger (PBP01/PBP02) rejects the save. */
export function isNearFreeLimit(used: number, limit: number): boolean {
  return used >= limit - 1;
}

/**
 * Reads the current user's entitlement. Signed-out users are 'free'.
 * Phase 1: existing users are grandfathered as 'founding', so they resolve
 * to Pro. Stripe-backed 'pro' rows arrive in a later phase.
 */
export function useEntitlement(): Entitlement {
  const [state, setState] = useState<Entitlement>({
    loading: true,
    isPro: false,
    plan: 'free',
    isFoundingMember: false,
  });

  useEffect(() => {
    let cancelled = false;

    /** Resolves entitlement from an already-known session — never calls an
     *  auth method itself, so it is safe to run from an auth callback. */
    const resolveFrom = async (user: { id: string } | null) => {
      if (!user) {
        if (!cancelled) setState({ loading: false, isPro: false, plan: 'free', isFoundingMember: false });
        return;
      }

      const { data } = await supabase
        .from('subscriptions')
        .select('plan, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      const plan = (data?.plan as Plan) || 'free';
      setState({
        loading: false,
        isPro: rowIsPro(data),
        plan,
        isFoundingMember: plan === 'founding',
      });
    };

    // Initial read. Safe here: we are not inside an auth callback.
    supabase.auth.getSession().then(({ data: { session } }) => {
      void resolveFrom(session?.user ?? null);
    });

    // ⚠ gotrue-js dispatches this callback WHILE HOLDING its session lock.
    // Calling any Supabase method synchronously from inside it — including
    // the innocuous-looking `auth.getUser()` this used to do — tries to
    // re-acquire that same lock and deadlocks it *permanently*: every later
    // auth call, `signOut()` included, then hangs forever and the Sign Out
    // button silently does nothing. Use the `session` the callback already
    // hands us, and defer the follow-up query to a fresh task so the lock is
    // released first.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setTimeout(() => { void resolveFrom(user); }, 0);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return state;
}
