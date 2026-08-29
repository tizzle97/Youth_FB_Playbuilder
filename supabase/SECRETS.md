# Secrets & API keys — master inventory

**This file's one job: answer "what secrets does this project use, and where
does each one live?" — and give a command to prove one is actually live rather
than just documented.**

It does **not** contain setup instructions (each section links to the doc that
has them) and it does **not** contain actual secret values or rotation dates.
A logged date goes stale the moment someone rotates a key without updating
this file — worse than no date, because it looks authoritative. For a real
timestamp, ask the source of truth directly:

```sh
supabase secrets list --project-ref nlfwfbbpcvyfyugxiysz
```
(returns SHA-256 digests and `updated_at`, never plaintext — useful for
confirming two places hold the *same* value without exposing it; see the
`FEEDBACK_NOTIFY_SECRET` row below for how)

**Why this file exists:** this project has twice lost real time to a secret
that was documented as set but wasn't actually working —
`feedback-notify` 404'd for weeks before anyone noticed, and
`VITE_BILLING_ENABLED=true` sat in Netlify with sandbox Stripe keys behind it
with no in-repo record that the combination was live. Both were found with a
one-line `curl`. Every row below carries that same probe, run and recorded
the day this file was written (2026-08-24), not aspirational.

---

## 1. Supabase secrets (`supabase secrets set`)

Server-side, read by Edge Functions via `Deno.env.get(...)`. Set with:
```sh
supabase secrets set KEY=value --project-ref nlfwfbbpcvyfyugxiysz
```

| Secret | Consumed at | Purpose | Full setup |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `stripe-webhook/index.ts:26`, `create-checkout-session/index.ts:15`, `create-portal-session/index.ts:12` | Server-side Stripe API calls. `sk_live_…` in production. | `STRIPE_SETUP.md` §2d, §6.2–6.3 |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook/index.ts:29` | Verifies `stripe-signature` on incoming webhook events — this is the entire security boundary for that function. | `STRIPE_SETUP.md` §3, §6.4 |
| `STRIPE_PRICE_ID` | `create-checkout-session/index.ts:18` | Which Stripe Price checkout sells. Live and test mode are separate objects — see §6.1. | `STRIPE_SETUP.md` §1, §6.1 |
| `STRIPE_ALLOW_TEST_MODE` | `stripe-webhook/index.ts:93` | ⚠ **Undocumented until this file.** Escape hatch added by the `livemode` guard (PR #114): unset (the default) means the webhook ignores any event where `event.livemode` is `false`, so a signed *test-mode* event cannot grant Pro. Set to the literal string `true` only for a deliberate sandbox end-to-end test, then unset it again. **Confirmed unset right now** — the safe default — via `supabase secrets list`, which has no entry for it. | `stripe-webhook/livemode.ts` header comment; no setup doc yet |
| `SITE_URL` | `create-checkout-session/index.ts:19`, `create-portal-session/index.ts:15` | Where Stripe redirects after checkout/portal. Falls back to `https://playbuilderpro.com` if unset. | `STRIPE_SETUP.md` §2d |
| `FEEDBACK_TRIAGE_SECRET` | `feedback-triage/index.ts:22` | Auth for the triage intake endpoint (`x-triage-secret` header). Must match the value entered in the cloud routine's environment — see §3 below. | `docs/automation/feedback-triage.md` §Setup |
| `FEEDBACK_NOTIFY_SECRET` | `feedback-notify/index.ts:46` | Auth for the digest-send endpoint (`x-notify-secret` header), and also embedded in the `pg_cron` job body in `feedback_notify.sql` — two places that must agree, which is exactly the mismatch that broke the digest on 2026-08-19. | `EMAIL_SETUP.md` §6 |
| `RESEND_API_KEY` | `feedback-notify/index.ts:47`, `feedback-reply-notify/index.ts:23` | Resend's HTTP API, for the digest email and the reply-notification email. **Not the same credential** as Auth's SMTP password (below) — different Resend key, different transport. `feedback-reply-notify` needs no separate secret of its own; it's JWT-verified and checks `is_admin()` on the caller instead of a shared secret. | `EMAIL_SETUP.md` §6 |
| `FEEDBACK_DIGEST_TO` | `feedback-notify/index.ts:48` | Single recipient address for the daily digest. | `EMAIL_SETUP.md` §6 |

**Platform-injected — do not `secrets set` these by hand.** Supabase provides
them automatically to every Edge Function; they appear in `secrets list` but
have no manual-set step in any doc, which is correct, not a gap.

| Secret | Consumed at |
|---|---|
| `SUPABASE_URL` | `stripe-webhook/index.ts:34`, `feedback-notify/index.ts:51`, `feedback-triage/index.ts:25`, `create-checkout-session/index.ts:22,31`, `create-portal-session/index.ts:18,26`, `sitemap/index.ts:15`, `feedback-reply-notify/index.ts:24,29` |
| `SUPABASE_SERVICE_ROLE_KEY` | `stripe-webhook/index.ts:35`, `feedback-notify/index.ts:52`, `feedback-triage/index.ts:26`, `create-checkout-session/index.ts:23`, `create-portal-session/index.ts:19`, `feedback-reply-notify/index.ts:25` |
| `SUPABASE_ANON_KEY` | `create-checkout-session/index.ts:32`, `create-portal-session/index.ts:27`, `sitemap/index.ts:16`, `feedback-reply-notify/index.ts:79` |

### Verify a function is actually live, not just deployed

Same probe, six functions, six different correct answers — read the expected
code per row, not a single generic rule:

```sh
REF=nlfwfbbpcvyfyugxiysz
BASE="https://$REF.supabase.co/functions/v1"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/<function>" \
  -H 'Content-Type: application/json' -d '{}'
```

| Function | Expected (no auth) | Meaning | Observed 2026-08-24 |
|---|---|---|---|
| `stripe-webhook` | **400** | Deployed, rejecting an unsigned request. (404 = not deployed.) | 400 ✓ |
| `feedback-triage` | **401** | Deployed, `secretMatches()` failing closed with no `x-triage-secret`. | 401 ✓ |
| `feedback-notify` | **401** | Same pattern as triage. (This exact check is what found the 2026-08-14 outage — it had been returning 404.) | 401 ✓ |
| `create-checkout-session` | **401** | Requires a signed-in user's JWT; a bare request is unauthorized. | 401 ✓ |
| `create-portal-session` | **401** | Same as above. | 401 ✓ |
| `feedback-reply-notify` | **401** | Requires a signed-in user's JWT (default verify-jwt, no `--no-verify-jwt` flag), same as the two above. A valid non-admin JWT gets **403** from the in-function `is_admin()` check instead. | not yet deployed |
| `sitemap` | **200** | Public, no auth required. | 200 ✓ |

All six matched their expected code when this file was written — no live
outage as of 2026-08-24.

---

## 2. Netlify environment variables (client-side)

Baked into the JS bundle at **build time** by Vite — changing one requires a
rebuild/redeploy, not just a dashboard save taking effect. Set in Netlify's
Site configuration → Environment variables.

⚠ **No `netlify.toml` exists in this repo.** Netlify's dashboard is the
*only* source of truth for what's actually set — there is nothing here to
grep. That absence is itself the reason `VITE_BILLING_ENABLED=true` could sit
in production with sandbox Stripe keys behind it for days with no in-repo
signal.

| Var | Consumed at | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts:4`, `src/lib/auth.ts:5`, `src/components/community/CommunityPage.tsx:34` | Supabase project URL for the client SDK. |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts:5`, `src/components/community/CommunityPage.tsx:34` | Public anon key — safe to ship client-side; RLS is the real boundary. |
| `VITE_BILLING_ENABLED` | `src/lib/billing.ts:8` | Must be the **lowercase literal string** `true` — `TRUE` silently fails `=== 'true'` and leaves the Pro card in "Coming soon". Gates whether the Stripe checkout button renders at all. |

Per `CLAUDE.md`, these three are the *only* env vars `src/` reads — confirmed
by grep, no others exist.

### Verify what's actually shipped, without dashboard access

The build-output check that answered "is billing live in production?" earlier
this project's history — a string that exists in exactly one branch of
`Pricing.tsx` tells you which path shipped:

```sh
CHUNK=$(curl -s https://playbuilderpro.com/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
curl -s "https://playbuilderpro.com/$CHUNK" -o /tmp/check.js
grep -c 'Redirecting to checkout' /tmp/check.js   # >0 → VITE_BILLING_ENABLED=true shipped
grep -c 'Coming soon' /tmp/check.js               # >0 → it did not
```

Observed 2026-08-24: `"Redirecting to checkout…"` present, `"Coming soon"`
absent — billing is live in production, consistent with the completed
go-live (issue #82).

---

## 3. Cloud routine environment (claude.ai/code/routines)

Configured per-routine in the routine's own Environment settings, not in this
repo at all.

| Var | Which routine | Purpose |
|---|---|---|
| `FEEDBACK_TRIAGE_SECRET` | Feedback triage | **Must be the same value** as the Supabase secret of the same name above — the routine sends it as the `x-triage-secret` header when calling the deployed function. A mismatch here is the same failure class as the `FEEDBACK_NOTIFY_SECRET` cron mismatch on 2026-08-19: everything looks configured, and every call gets a silent 401. |
| `FEEDBACK_TRIAGE_URL` | Feedback triage | The function's public URL. Not a secret by itself, but wrong without the value above. |

The nightly executor routine has **no secrets of its own** — it relies on
`gh` being authenticated ambiently in the routine's execution environment,
not an explicit env var. See `docs/automation/nightly-executor.md`.

**Verify the two values actually match**, without ever displaying either one:
```sh
supabase secrets list --project-ref nlfwfbbpcvyfyugxiysz   # gives the Supabase-side digest
printf '%s' 'the-value-you-entered-in-the-routine-UI' | shasum -a 256
```
Digests equal ⇒ values equal. This is the same technique used to confirm the
`FEEDBACK_NOTIFY_SECRET` rotation on 2026-08-19 without ever pasting the
secret anywhere.

---

## 4. External dashboards — not env vars at all

Credentials that live entirely outside both Supabase and Netlify.

| Where | What | Notes |
|---|---|---|
| **Stripe dashboard** | Product, Price, webhook endpoint registration | Live and test mode are **completely separate objects** — a live Price ID and a test Price ID are different strings, and registering a webhook in test mode does not register it in live mode. `STRIPE_SETUP.md` §6 covers the live-mode versions of all three. |
| **Resend dashboard** | SMTP credential (Auth emails) **and separately** an API key (`RESEND_API_KEY`, §1 above) | Two different credentials on the same account, deliberately. The SMTP password is entered directly into the *Supabase* dashboard's Auth → SMTP settings — not a `supabase secrets set` value, and not read by any Edge Function. `RESEND_API_KEY` is the HTTP-API key used by `feedback-notify` only. See `EMAIL_SETUP.md` §6 for why these can't be merged into one key. |
| **GitHub** (`gh` CLI) | Ambient auth in the nightly executor's routine environment | No explicit token is set anywhere in this repo or in Supabase; the routine environment authenticates `gh` itself. |

---

## Cross-reference: every secret found in code

Grep run 2026-08-24 across `supabase/functions/*/index.ts` and `src/` for
`Deno.env.get(` / `import.meta.env.VITE_`. Every name found appears in a table
above — this list exists so a future audit can diff against it instead of
re-deriving the whole search:

```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
STRIPE_ALLOW_TEST_MODE, SITE_URL, FEEDBACK_TRIAGE_SECRET,
FEEDBACK_NOTIFY_SECRET, RESEND_API_KEY, FEEDBACK_DIGEST_TO,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BILLING_ENABLED
```

If a future grep turns up a name not in this file, that's the signal this
file has drifted — update it in the same change, the same rule
`docs/automation/*.md` already follow for their own prompts.
