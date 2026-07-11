// Create a Stripe Checkout session for the $39/yr Pro subscription
// (BACKLOG B-3). Deploy with default JWT verification ON — only signed-in
// users can start checkout; the user is derived from their JWT, never from
// the request body.
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY — sk_live_... / sk_test_...
//   STRIPE_PRICE_ID   — price_... for the $39/yr recurring price
//   SITE_URL          — e.g. https://playbuilderpro.com (redirect target)

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const priceId = Deno.env.get('STRIPE_PRICE_ID') ?? '';
const siteUrl = Deno.env.get('SITE_URL') ?? 'https://playbuilderpro.com';

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Resolve the caller from their JWT
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not signed in' }, 401);

  try {
    const { data: existing } = await serviceClient
      .from('subscriptions')
      .select('plan, status, stripe_customer_id, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    const alreadyPro =
      existing &&
      (existing.plan === 'founding' ||
        (existing.plan === 'pro' &&
          (!existing.current_period_end || new Date(existing.current_period_end) > new Date())));
    if (alreadyPro) return jsonResponse({ error: 'This account already has Pro access.' }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      // Reuse the Stripe customer if one exists from a past subscription
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session failed:', err);
    return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
