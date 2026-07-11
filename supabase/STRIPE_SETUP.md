# Stripe setup (B-3) — step-by-step

Everything below is a **human task** (Jeremy). The code is deployed but
inert until these steps are done: the UI stays in its honest
"coming soon" state until `VITE_BILLING_ENABLED=true` is set in Netlify.

**Never commit any of these keys.** They live only in Stripe, the Supabase
secrets store, and Netlify env vars.

## 1. Stripe account & product

1. Create/sign in at https://dashboard.stripe.com (start in **Test mode**).
2. **Product catalog → Add product**: name `Playbuilder Pro`, add a
   **recurring yearly** price of **$39.00 USD**.
3. Copy the price ID (`price_...`) — this is `STRIPE_PRICE_ID`.
4. **Developers → API keys**: copy the **secret key** (`sk_test_...` now;
   repeat with `sk_live_...` when going live) — this is `STRIPE_SECRET_KEY`.

## 2. Deploy the Edge Functions

Requires the Supabase CLI, logged in and linked to the project
(`supabase link --project-ref <ref>`).

```sh
# Secrets used by the functions (SUPABASE_* vars are injected automatically)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_ID=price_...
supabase secrets set SITE_URL=https://playbuilderpro.com

# Checkout + portal keep default JWT verification (signed-in users only)
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session

# The webhook is called by Stripe, which can't send a Supabase JWT —
# security is the Stripe signature check inside the function
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 3. Webhook endpoint

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the signing secret (`whsec_...`) and set it:
   ```sh
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 4. Turn the UI on

In **Netlify → Site settings → Environment variables**, add
`VITE_BILLING_ENABLED=true`, then trigger a redeploy. The homepage Pro
card switches from "Coming soon" to a live **Upgrade to Pro — $39/yr**
button, the account page CTA starts checkout directly, and paid Pro
users get a **Manage billing** portal button on `/account`.

## 5. Test checklist (test mode)

- [ ] Signed-out homepage unchanged; signed-in free user sees Upgrade button.
- [ ] Upgrade → Stripe Checkout opens; pay with card `4242 4242 4242 4242`.
- [ ] Redirected to `/account?checkout=success`; within a few seconds the
      `subscriptions` row shows `plan='pro'`, `status='active'`,
      Stripe ids, and a future `current_period_end` (webhook wrote it).
- [ ] Account page now shows the Pro badge, no usage limits, and
      **Manage billing** opens the Stripe portal.
- [ ] Cancel the subscription in the portal → after the period ends (or
      immediately if configured), the webhook downgrades `plan` to `free`.
- [ ] A **Founding Member** account is refused checkout ("already has Pro")
      and is never downgraded by webhook events.
- [ ] Free-tier limit triggers (16th play) still behave for free users.

Then repeat steps 1–4 with **live mode** keys.

## Notes / design decisions

- `subscriptions` writes come **only** from the webhook (service role) or
  admin SQL — the client has read-own access only (see SCHEMA.md). The
  checkout/portal functions derive the user from their JWT; nothing is
  trusted from the request body.
- The webhook never strips `plan='founding'`: a founding member whose paid
  sub lapses falls back to `founding`, not `free` (grandfathering promise).
- `checkout.session.completed` carries `client_reference_id = user.id`, so
  the first write links the Stripe customer to the user; later
  subscription events are matched by `stripe_customer_id`.
