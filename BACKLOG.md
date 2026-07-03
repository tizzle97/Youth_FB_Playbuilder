# Backlog

Prioritized work queue for Playbuilder Pro. Both humans and automated agents pull
from here. Context for the monetization items lives in `CLAUDE.md` (Monetization
section); schema context lives in `supabase/SCHEMA.md`.

## How to work an item (agent rules)

1. Take the **topmost unblocked item** whose scope fits a single PR. One item per
   branch/PR — do not bundle.
2. Run `npm run verify` (build + Playwright smoke suite) before opening the PR.
   If your change touches the designer or save/load flows, extend the smoke
   suite in `tests/smoke/` to cover it.
3. **Never run DB migrations.** If schema changes are needed: add a new
   idempotent `.sql` file in `supabase/`, update `supabase/SCHEMA.md` in the same
   PR, and put **"⚠ requires SQL run"** in the PR title/description.
4. **Stripe / billing / anything touching money or auth:** PR only, flagged for
   human review. Never commit secrets; reference env var names only.
5. When an item is finished, move it to **Done** with the date and PR link. If
   you discover new work, append it to the bottom of Up next — don't reprioritize
   without a human.

## Up next

### B-2 · UI export gates (Pro features)
Gate playbook PDF export (detailed + grid) and wristband export behind
`useEntitlement().isPro` with an upgrade prompt for free users. Free single-play
PDF stays available but gets a small "Made with playbuilderpro.com" footer
credit; Pro output is clean. **Acceptance:** gates verified in browser for both
a free and a pro state (pro state may be simulated by mocking the entitlement).

### B-3 · Stripe Checkout + Customer Portal + webhook (scaffold)
Supabase Edge Function for a signature-verified Stripe webhook writing to
`subscriptions` (service role); checkout session creation for the $39/yr
subscription; portal link on the account page. Human (Jeremy) supplies the
Stripe account, price ID, and deploys the function — the PR delivers code +
step-by-step setup doc. **Blocked on:** Stripe account decisions. Human review
mandatory (money).

### B-4 · Founding Member backfill + badge
Idempotent SQL inserting all existing users into `subscriptions` as founding
members (per the grandfathering decision), plus a "Founding Member" badge in the
account UI. `useEntitlement().isFoundingMember` already exists. ⚠ requires SQL
run. **Note:** run the backfill only right before Pro gates go live (B-1/B-2),
so signups until then are included.

### B-5 · Fix the 12 pre-existing tsc errors, then add tsc to verify
`npx tsc --noEmit` currently fails in: `AccountSettings.tsx` (null `user`,
`User` used as value), `UserMenu.tsx` (`icon_url` on `never`),
`AddToPlaybookModal.tsx` (null `user`), `SavePlayModal.tsx` (missing `playName`),
`AddToPlaybookButton.tsx` (Set iteration). Fix all, then change the `verify`
script to `tsc --noEmit && build && smoke`. **Acceptance:** `npx tsc --noEmit`
exits 0.

### B-6 · Repair eslint (flat-config migration)
`npm run lint` crashes: a config object uses `extends`, unsupported in eslint 9
flat config. Migrate `eslint.config.js`, fix or explicitly disable surfaced
rules, then add lint to the `verify` script. **Acceptance:** `npm run lint`
exits 0.

### B-7 · Homepage Pricing accuracy pass
Audit `src/components/Pricing.tsx` against the monetization plan: Free = 15
plays / 2 playbooks / single-play PDF / community; Pro = $39/yr annual-only with
unlimited + full playbook PDFs + wristband export. Remove any leftover
non-functional Donate buttons or unfulfillable perk tiers. CTA can say "coming
soon" until B-3 ships — no fake checkout.

### B-8 · Manual QA: defensive play save→reload against real Supabase (human)
The one untested seam from the defensive-playbook feature: with a real signed-in
session, save a defensive play with zones, reopen via `/designer?play=<id>`,
confirm icons/zones/routes reload intact. (The smoke suite covers this flow with
a mocked backend; this checks the real DB round trip once.) **Human task** —
agents skip.

### B-9 · Delete legacy `vercel.json`
Deploys are Netlify; SPA routing is `public/_redirects`. `vercel.json` is dead
config that misleads readers. Delete it and confirm nothing references it.

### B-10 · Play voting
Upvotes on public/community plays: schema (new SQL file + SCHEMA.md), RLS
(one vote per user per play), and UI on community cards. Prerequisite for B-11.
⚠ requires SQL run.

### B-11 · Re-enable TopPlays homepage section (real data)
`<TopPlays />` is disabled in `App.tsx` until backed by real top-voted plays.
Wire it to voting data and re-enable. **Blocked on:** B-10.

### B-12 · Testimonials from real user feedback (human-gated)
`<Testimonials />` stays disabled until there are real quotes with permission to
publish (never fabricate — house rule). Human collects quotes; agent then wires
them in.

## Done

- **2026-07-03 · B-1: Server-enforced free-tier limits (15 plays / 2 playbooks)**
  — `supabase/free_tier_limits.sql` adds `BEFORE INSERT` triggers on `plays`/
  `playbooks` blocking a 16th play / 3rd playbook for non-`is_pro()` users
  (raises custom `PBP01`/`PBP02` codes). Client: `getSafeErrorMessage()`
  (`src/lib/errors.ts`) maps those codes to the trigger's friendly
  upgrade-prompt message instead of a generic DB error — also fixed a latent
  bug there where Postgrest errors (thrown as plain `{code,message,...}`
  objects, not `Error` instances, since this codebase doesn't use
  `.throwOnError()`) were falling through to the generic fallback message
  entirely. `PlaybooksPage.tsx`'s `createPlaybook` now surfaces its error in
  the create-playbook modal (previously silently console-logged only).
  ⚠ requires SQL run.
- **2026-07-02 · Playwright smoke suite + `verify` script** — `tests/smoke/`,
  `npm run smoke`, `npm run verify`; covers designer offense/defense flows,
  undo, and the play-load path with a mocked backend.
- **(pre-backlog) Entitlement plumbing** — `subscriptions` table, `is_pro()`,
  `useEntitlement()` / `FREE_LIMITS` (monetization phase 1).
- **(pre-backlog) Defensive playbooks** — D/LB/CB/S roster + zone tool
  (commit `65ac327`).
