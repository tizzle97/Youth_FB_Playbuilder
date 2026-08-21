# Stripe setup (B-3) — step-by-step

Everything below is a **human task** (Jeremy). The code is deployed but
inert until these steps are done: the UI stays in its honest
"coming soon" state until `VITE_BILLING_ENABLED=true` is set in Netlify.

**Never commit any of these keys.** They live only in Stripe, the Supabase
secrets store, and Netlify env vars.

> **Test mode first.** Steps 1–5 below use Stripe **test mode** end to end —
> this is safe to run any time and takes no real money. Section 6
> ("Going live") is a separate, gated checklist — read the note there
> before starting it.

## 1. Stripe account & product (test mode)

1. Create/sign in at https://dashboard.stripe.com, and confirm the
   dashboard toggle in the top-left reads **Test mode** (Stripe keeps test
   and live as fully separate environments — separate products, prices,
   keys, and webhooks — so nothing here touches live mode).
2. **Product catalog → Add product**: name `Playbuilder Pro`, add a
   **recurring yearly** price of **$39.00 USD**.
3. Copy the price ID (`price_...`) — this is `STRIPE_PRICE_ID`.
4. **Developers → API keys**: copy the **secret key**, which in test mode
   starts with `sk_test_` — this is `STRIPE_SECRET_KEY`.

## 2. Deploy the Edge Functions

Everything below runs in a terminal **from the repo root** (the folder
containing `supabase/`) — the CLI finds each function by its folder name
under `supabase/functions/`.

### 2a. Install the Supabase CLI

```sh
brew install supabase/tap/supabase
```

No Homebrew? `npm install supabase --save-dev` in the repo also works —
then prefix every `supabase` command below with `npx` (e.g.
`npx supabase login`). Check with `supabase --version`. If a later step
complains "Docker is not running", the CLI is outdated — upgrade
(`brew upgrade supabase`); current versions deploy through Supabase's
API and don't need Docker.

### 2b. Log in

```sh
supabase login
```

Opens a browser to generate an access token and stores it locally. If
the browser flow fails, create a token manually at
https://supabase.com/dashboard/account/tokens and paste it when prompted.

### 2c. Link the repo to the project

The project ref is the subdomain of the Supabase URL — the
`abcdefghijklm` in `https://abcdefghijklm.supabase.co` (it's in `.env`
as `VITE_SUPABASE_URL`, and in the dashboard URL:
`supabase.com/dashboard/project/<ref>`).

```sh
supabase link --project-ref <that-ref>
```

If it prompts for the **database password** (the Postgres password from
project creation, not the Supabase login), just press Enter to skip —
deploying functions doesn't need it. With multiple projects,
`supabase projects list` shows which one is linked.

### 2d. Set the secrets

```sh
# SUPABASE_* vars are injected automatically — never set those here
supabase secrets set STRIPE_SECRET_KEY=sk_test_...   # from step 1
supabase secrets set STRIPE_PRICE_ID=price_...       # from step 1
supabase secrets set SITE_URL=https://playbuilderpro.com
```

These are the **test-mode** values from step 1 — live-mode values are set
separately in section 6, not here. `STRIPE_WEBHOOK_SECRET` is set in
step 3, *after* the webhook endpoint exists — secrets apply without
redeploying. Verify with `supabase secrets list` (shows names + digests,
never values).

### 2e. Deploy

```sh
# Checkout + portal keep default JWT verification (signed-in users only)
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session

# The webhook is called by Stripe, which can't send a Supabase JWT —
# security is the Stripe signature check inside the function
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 2f. Confirm it worked

- Dashboard → **Edge Functions**: all three listed. `stripe-webhook`'s
  details must show JWT verification **disabled**; the other two
  **enabled**.
- Sanity check from the terminal:
  ```sh
  curl -i https://<ref>.supabase.co/functions/v1/create-checkout-session -X POST
  ```
  A `401` response is the **correct** result — the function is deployed
  and rejecting unauthenticated callers.

## 3. Webhook endpoint (test mode)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint** (with the
   dashboard still toggled to **Test mode**).
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

## 6. Going live (real money) — gated, see BACKLOG.md B-18/B-21

> **Gate cleared 2026-08-21.** Attorney review of `/privacy` and `/terms`
> (B-21, issue #83) is complete, which unblocks this section. It was held
> deliberately, not by oversight: real subscribers start getting charged real
> money as soon as 6.4 finishes.
>
> ⚠ **Do 6.3 and 6.4 in one sitting.** Between them the app is taking live
> checkouts while the webhook still verifies against the *test* signing secret,
> so successful payments would not grant Pro. And be aware of the reverse
> failure, which already happened once: with `VITE_BILLING_ENABLED=true` and
> test keys still in place, a visitor completed checkout with Stripe's test
> card and was granted Pro for free. The `livemode` guard in
> `stripe-webhook/livemode.ts` now blocks that, but **it only helps once the
> function is redeployed** — see 6.6.

Once B-21 is cleared, live mode is a **separate Stripe environment** from
test mode — its own product, price, keys, and webhook. Repeat sections
1–3 with the dashboard toggled to **Live mode** instead of Test mode:

### 6.1 Product & price (live mode)
Same as section 1, but with the dashboard toggle set to **Live mode**.
Live prices/products are distinct objects from the test ones created
earlier — this is a new `STRIPE_PRICE_ID`, not a rename of the test one.

### 6.2 Live secret key
**Developers → API keys** in live mode gives a **different** secret key,
starting `sk_live_` instead of `sk_test_`.

### 6.3 Set the live secrets
```sh
supabase secrets set STRIPE_SECRET_KEY=sk_live_...   # from 6.2
supabase secrets set STRIPE_PRICE_ID=price_...       # the LIVE price id from 6.1
```
This **overwrites** the test-mode secrets from section 2d — Edge
Functions read whichever value is currently set, there's no separate
test/live secret slot. From this point on, checkout charges real cards.

### 6.4 Live webhook endpoint
Same as section 3, but **Add endpoint** with the dashboard in **Live
mode** — this is a separate webhook registration from the test one, with
its own signing secret:
```sh
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...  # the LIVE whsec, from the live webhook
```

### 6.5 Redeploy the webhook — do not skip
The `livemode` guard is code, so it only takes effect on redeploy. Setting live
secrets does not update the deployed function.
```sh
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref nlfwfbbpcvyfyugxiysz
```
Confirm it answers at all (401 = deployed and failing closed, 404 = not there):
```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://nlfwfbbpcvyfyugxiysz.supabase.co/functions/v1/stripe-webhook" -d '{}'
```

### 6.6 One real transaction
Run one real subscription purchase with a real card (yours) to confirm
checkout → webhook → `subscriptions` row → Pro badge → billing portal all
work with real money end to end, exactly like the test checklist in
section 5. Cancel it afterward via the billing portal if it was only a
verification purchase.

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
