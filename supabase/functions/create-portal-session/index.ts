// Create a Stripe Customer Portal session so a Pro subscriber can manage
// billing (BACKLOG B-3). Deploy with default JWT verification ON.
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY — sk_live_... / sk_test_...
//   SITE_URL          — e.g. https://playbuilderpro.com (return target)

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const siteUrl = Deno.env.get('SITE_URL') ?? 'https://playbuilderpro.com';

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not signed in' }, 401);

  try {
    const { data: row } = await serviceClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!row?.stripe_customer_id) {
      return jsonResponse({ error: 'No billing account found for this user.' }, 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${siteUrl}/account`,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('create-portal-session failed:', err);
    return jsonResponse({ error: 'Could not open the billing portal. Please try again.' }, 500);
  }
});
