import { supabase } from './supabase';

// Client half of the Stripe scaffold (B-3). Everything is gated behind
// VITE_BILLING_ENABLED so the UI keeps its honest "coming soon" state until
// the Edge Functions are deployed and the Stripe account is configured —
// flip the flag in Netlify env and redeploy to go live. See
// supabase/STRIPE_SETUP.md for the full checklist.
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';

async function invokeForUrl(fn: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(fn);
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.url) throw new Error('No redirect URL returned');
  return data.url as string;
}

/** Start Stripe Checkout for the $39/yr Pro plan; redirects on success. */
export async function startProCheckout(): Promise<void> {
  window.location.href = await invokeForUrl('create-checkout-session');
}

/** Open the Stripe Customer Portal for an existing subscriber. */
export async function openBillingPortal(): Promise<void> {
  window.location.href = await invokeForUrl('create-portal-session');
}
