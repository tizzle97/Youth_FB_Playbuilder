// Stripe webhook → subscriptions table (BACKLOG B-3).
//
// Deploy with JWT verification DISABLED (Stripe can't sign Supabase JWTs):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Security comes from Stripe signature verification below — every request
// must carry a valid `stripe-signature` for STRIPE_WEBHOOK_SECRET.
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY      — sk_live_... / sk_test_...
//   STRIPE_WEBHOOK_SECRET  — whsec_... from the webhook endpoint config
// Optional:
//   STRIPE_ALLOW_TEST_MODE — 'true' lets test-mode events grant entitlements.
//     OFF by default. A signed test-mode event is a valid request, so without
//     this guard a Stripe test card buys real Pro for free.
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Webhook endpoint events to subscribe:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { shouldProcessEvent } from './livemode.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Service-role client: this is the ONLY writer of subscriptions rows
// (RLS gives users read-own only; see supabase/SCHEMA.md).
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

/** current_period_end lives on the subscription in older Stripe API
 *  versions and on the items in newer ones — take whichever exists. */
function periodEnd(sub: Stripe.Subscription): string | null {
  const raw =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end;
  return raw ? new Date(raw * 1000).toISOString() : null;
}

async function upsertSubscription(
  userId: string,
  sub: Stripe.Subscription,
  customerId: string,
): Promise<void> {
  const active = sub.status === 'active' || sub.status === 'trialing';

  // Never strip a Founding Member's grandfathered Pro: a founding row keeps
  // plan='founding' even if a paid subscription lapses.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  const plan = active ? 'pro' : existing?.plan === 'founding' ? 'founding' : 'free';

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      plan,
      status: sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd(sub),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing stripe-signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync: the sync variant isn't supported on Deno's SubtleCrypto
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // A valid signature does not mean real money. Test-mode events are signed
  // too, so entitlement-granting has to gate on livemode explicitly.
  const gate = shouldProcessEvent(event.livemode, Deno.env.get('STRIPE_ALLOW_TEST_MODE'));
  if (!gate.process) {
    console.warn(`Ignoring ${event.type} (${event.id}): ${gate.reason}`);
    // 200, not an error: this is a correctly-signed event we are deliberately
    // declining. A non-2xx would make Stripe retry it for days.
    return new Response(JSON.stringify({ received: true, ignored: gate.reason }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        if (!userId || !session.subscription || !session.customer) {
          console.error('checkout.session.completed missing user/subscription/customer', session.id);
          break;
        }
        const sub = await stripe.subscriptions.retrieve(String(session.subscription));
        await upsertSubscription(userId, sub, String(session.customer));
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        if (!row) {
          // Unknown customer — e.g. events replayed from before go-live
          console.warn('No subscriptions row for Stripe customer', customerId);
          break;
        }
        await upsertSubscription(row.user_id, sub, customerId);
        break;
      }
      default:
        // Not an event we act on; acknowledge so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error('Webhook handling failed:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
