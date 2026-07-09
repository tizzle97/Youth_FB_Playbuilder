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

### B-3 · Stripe Checkout + Customer Portal + webhook (scaffold)
Supabase Edge Function for a signature-verified Stripe webhook writing to
`subscriptions` (service role); checkout session creation for the $39/yr
subscription; portal link on the account page. Human (Jeremy) supplies the
Stripe account, price ID, and deploys the function — the PR delivers code +
step-by-step setup doc. **Blocked on:** Stripe account decisions. Human review
mandatory (money).

### B-5 · Fix the remaining pre-existing tsc errors, then add tsc to verify
`npx tsc --noEmit` currently fails in: `UserMenu.tsx` (`icon_url` on `never`),
`AddToPlaybookModal.tsx` (null `user`), `SavePlayModal.tsx` (missing `playName`),
`AddToPlaybookButton.tsx` (Set iteration). (`AccountSettings.tsx`'s errors were
fixed in the blank-page hotfix — one of them was crashing the page at runtime,
proof these aren't cosmetic.) Fix all, then change the `verify` script to
`tsc --noEmit && build && smoke`. **Acceptance:** `npx tsc --noEmit` exits 0.

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

### B-13 · Account page: Plan & usage section
Card on `/account` showing current plan (Free / Pro / **Founding Member** badge —
overlaps B-4's badge), live usage meters ("9 of 15 plays · 1 of 2 playbooks"
via `useEntitlement()` + `FREE_LIMITS` + count queries), and an upgrade CTA for
free users. This section is also the future home of B-3's Stripe Customer
Portal link. **Acceptance:** free user sees meters + CTA; founding user sees
badge and no CTA.

### B-14 · Team identity settings (name/logo on exports)
Account settings for team name and optional logo, stamped onto single-play PDFs,
playbook PDFs, and wristband exports. Include default game format (5v5/7v7) to
prefill `SavePlayModal`. Needs a `user_preferences` store (new idempotent SQL +
SCHEMA.md). ⚠ requires SQL run.

### B-15 · Save & export default preferences
Account settings for: default play visibility (private/public), default play
type, paper size (Letter/A4), and default playbook export style (simple/
detailed/grid). Store alongside B-14's preferences. **Blocked on:** B-14
(shares the preferences store).

### B-16 · Email change on account page
`supabase.auth.updateUser({ email })` + confirmation-flow messaging (Supabase
sends a verification email to the new address). Auth-adjacent → human review.

### B-17 · Equal-spacing distribution guides in the designer
Visio-style "distribute evenly": while dragging an icon between two others that
share its row/column, snap to the equidistant point and show spacing guides.
Follow-up to the alignment snapping shipped 2026-07-07 (`computeSnap` in
`Canvas.tsx` is the extension point). Deferred by Jeremy to keep that change
focused.

## Done

- **2026-07-08 · B-4: Founding Member backfill + badge** — `supabase/
  founding_member_backfill.sql` re-runs the idempotent grandfathering `INSERT`
  from `subscriptions.sql` to catch users who signed up between that original
  backfill and now (free-tier gates are live, so anyone missed it defaults to
  'free' and loses the grandfathering promise). ⚠ requires SQL run. Added a
  "Founding Member" badge next to the `/account` page header. **Note:** the
  badge reads `subscriptions.plan` directly with the `user` this component
  already resolved, rather than via `useEntitlement()` — that hook makes its
  own `supabase.auth.getUser()` call, and running it concurrently with
  `AccountSettings`'s own `getUser()` effect deadlocks gotrue-js's internal
  session lock (reproduced: page hangs on "Loading..." forever). Extended
  `tests/smoke/` to cover both the founding-member and free-plan badge states.
- **2026-07-05 · B-2: UI export gates (Pro features)** — Playbook PDF export
  (all formats: `ExportModal`'s detailed/grid layouts and `PlaybooksPage`'s
  simple/detailed/grid playbook export, which all print multiple plays) now
  requires `useEntitlement().isPro`; a free user sees a "Pro" lock badge on
  those options and a new shared `UpgradePrompt` modal (`src/components/
  UpgradePrompt.tsx`) instead of the print flow, linking back to the homepage
  Pricing section. The single-play PDF sheet in `ExportModal` stays free for
  everyone and now stamps a small "Made with playbuilderpro.com" footer credit
  when the exporting user isn't Pro (Pro output has no footer). Also fixed a
  latent bug this surfaced: `ExportModal` was unconditionally mounted in
  `PlayDesigner.tsx` (toggled via an `isOpen` prop rather than being
  conditionally rendered), so its new entitlement lookup fired on every
  Designer page load instead of only when the modal opens — changed to mount
  only while open. **Note:** wristband export isn't implemented anywhere in
  the app yet (only referenced in marketing copy and a couple of type unions),
  so there was nothing to gate for it — flagging rather than stubbing a
  feature that doesn't exist.
- **2026-07-04 · Hotfix: Account Settings page rendered blank** — a type-only
  `User` import was used as a JSX component (line 360), `undefined` at runtime,
  crashing the whole `/account` route (this was one of the B-5 tsc errors —
  `vite build` doesn't type-check, so it shipped). Same PR: wired up the
  password-change form (its fields were previously ignored by save), removed
  the self-report avatar flag (impossible by DB constraint:
  `reporter_id != reported_user_id`), fixed the remaining AccountSettings tsc
  errors, and added a smoke test that `/account` renders for a signed-in user.
- **2026-07-04 · B-9: Delete legacy `vercel.json`** — removed the dead Vercel
  config (deploys are Netlify via `public/_redirects`). Also corrected the
  now-stale Vercel deployment instructions in `README.md` to describe the
  Netlify flow, and dropped the dangling `vercel.json` reference in `CLAUDE.md`.
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
