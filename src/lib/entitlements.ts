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

/** True if the subscription row grants active Pro access. */
function rowIsPro(row: { plan?: string; current_period_end?: string | null } | null): boolean {
  if (!row) return false;
  if (row.plan !== 'founding' && row.plan !== 'pro') return false;
  if (row.current_period_end && new Date(row.current_period_end) <= new Date()) return false;
  return true;
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

    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

    resolve();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => resolve());
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return state;
}
