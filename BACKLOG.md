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

### B-18 · Stripe go-live: swap sandbox → live mode (human)
The sandbox end-to-end test passed on 2026-07-15 (checkout with test card →
webhook → `subscriptions` row → Pro badge + billing portal, all verified).
What's left to accept real money: in the Stripe **live** account (not the
sandbox), create the $39/yr price and webhook endpoint, then
`supabase secrets set` the live `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and
`STRIPE_WEBHOOK_SECRET`, redeploy the three Edge Functions, and run one real
transaction. **Human task.** Blocked on B-21 (attorney review) by choice.

### B-21 · Attorney review of legal pages (human)
`/privacy` and `/terms` (shipped 2026-07-16) are engineering-informed drafts
matched to actual data practices. Have a licensed attorney review before
flipping Stripe to live mode. **Human task** — agents skip.

### B-20 · Register DMCA designated agent (human, $6)
File at dmca.copyright.gov: service provider "Jeremy Knepp" with alternate
names "Playbuilder Pro" / "playbuilderpro.com", agent email
support@playbuilderpro.com (live via Zoho as of 2026-07-16). Renew every
3 years. The ToS §8 takedown channel is already published; registration is
what secures the §512 safe harbor. **Human task** — agents skip.

### B-8 · Manual QA: defensive play save→reload against real Supabase (human)
The one untested seam from the defensive-playbook feature: with a real signed-in
session, save a defensive play with zones, reopen via `/designer?play=<id>`,
confirm icons/zones/routes reload intact. (The smoke suite covers this flow with
a mocked backend; this checks the real DB round trip once.) **Human task** —
agents skip.

### B-12 · Testimonials from real user feedback (human-gated)
`<Testimonials />` stays disabled until there are real quotes with permission to
publish (never fabricate — house rule). Human collects quotes; agent then wires
them in.

### B-23 · Investigate PlaybooksPage dev-mode loading hang under Playwright
Spun out of B-22's smoke-test work: `PlaybooksPage.tsx`'s `getSession()` +
`onAuthStateChange` mount effect, combined with React 18 StrictMode's
dev-mode double-invoke, can leave `loadPlaybooks()`'s awaited `.from()` query
never settling when driven by a mocked/unreachable Supabase backend under
`npm run dev` — reproduced consistently in a Playwright smoke test (page
stuck on "Loading playbooks..." indefinitely, no network request ever
observed, no error/rejection surfaced). Not reproduced with `PlaysPage.tsx`'s
`getUser()`-based mount pattern. Unclear whether this can occur against a
**real** Supabase backend (production doesn't run in StrictMode-affected dev
mode) — needs investigation before ruling it out as dev/test-only. Until
understood, B-22's PlaybooksPage usage-nudge banner has no automated smoke
coverage (see the comment in `tests/smoke/designer.spec.ts` near the other
B-22 tests).

### B-24 · Formation templates (11v11 gap #1 — the retention feature)
From the 2026-07-17 "11v11 coach" product evaluation: the single biggest gap
for tackle-football coaches is having to hand-place all 11 icons (including a
five-man O-line via the custom-icon builder) for **every play**. Ship a
formation-template picker in the designer toolbar: choose e.g. "I-Formation"
or "Shotgun Spread" and the icons stamp onto the canvas at the right spots,
ready to adjust. Scope:
- Curate starter templates per game format: 11v11 (I-Form, Shotgun, Spread,
  Wing-T at minimum, squares for linemen), 7v7 and 5v5 flag sets (Trips,
  Bunch, Twins). Store as normalized 0–1 coordinates matching
  `canvas_data.playerIcons` — NOT the `formations` table's old Fabric.js
  `template` JSON.
- Placing a template = one undo entry (single `pushSnapshot()`).
- "Save current layout as my formation" for user-defined templates can be a
  fast follow; system templates first.
- Note: `FormationSelector.tsx` is **dead code** from the abandoned Fabric.js
  era (imports `fabric`, nothing imports it) — see B-26; its Shotgun/I-Form
  layout data is a usable starting reference, but the component itself must
  be rebuilt against the real `CanvasHandle` API.

### B-25 · Blocking-assignment notation (11v11 gap #2)
Routes and defensive zones exist, but 11v11 is run-first and there's no way
to notate blocking: run-game diagrams need block symbols (line ending in a
perpendicular "T" at contact), pull paths for linemen, and ideally a
double-team indicator. Scope: a "Block" draw mode alongside Straight/Route —
same path drawing, different terminal decoration (T-cap instead of
arrowhead); persists in `canvas_data.paths` via a `mode: 'block'` variant so
old plays load unchanged; renders in both live canvas and `exportImage()`.
Extend the smoke suite (draw block → assert path mode → undo).

### B-26 · Delete dead FormationSelector.tsx (Fabric.js remnant)
`src/components/designer/FormationSelector.tsx` imports `fabric` /
`fabric/fabric-impl`, is imported by nothing, and predates the pure-HTML-
canvas rewrite. It misleads readers (and agents) into thinking a formation
feature exists. Salvage its formation layout coordinates into B-24's
template data first, then delete the file (and drop the `fabric` dependency
from package.json if nothing else uses it).

### B-27 · Special-teams designer mode (11v11, lower priority)
`play_type` enum and the metadata dropdown already offer `special_teams`,
but the designer only has offense/defense modes — picking "Special" changes
nothing on the canvas. Minimum viable: a special-teams roster preset (K/P,
LS, returner, coverage players) and the existing route/zone tools; kick
coverage lanes are just straight routes. Cosmetic-only today; make the
dropdown honest.

### B-28 · Team/staff sharing (design first — money-adjacent, human review)
11v11 staffs are 3–4 coaches; today the only sharing is public community
plays, and the ToS/monetization plan already promise "future team sharing"
as a Pro feature. Needs a design pass before any code: likely a `teams`
table + membership + playbook-level share grants (RLS mirrors the existing
ownership patterns), invite-by-email flow, read-only vs. editor roles.
Rough scope is a multi-PR epic — do NOT pick this up as a single nightly
item; a human should approve the schema design first.

## Done

- **2026-07-17 · B-22: Proactive free-tier limit warning** — free users used
  to learn they'd hit the 15-play/2-playbook cap only when the server
  rejected the save (PBP01/PBP02 → upgrade prompt). Added an early nudge:
  `src/components/UsageWarningBanner.tsx` (new shared component) shows a
  "14 of 15 plays used" / "1 of 2 playbooks used" style warning once a free
  user is down to their last free slot or already at the cap
  (`isNearFreeLimit()`, new in `src/lib/entitlements.ts`), with an "Upgrade
  to Pro" button. Wired into `SavePlayModal` (only for a new play — editing
  an existing one in place doesn't consume a slot; fetches the play count +
  subscription row directly off the already-resolved `user` prop, per the
  B-4 gotrue-lock note, not via `useEntitlement()`), `PlaysPage` (same
  direct-query pattern off its own resolved `currentUser`), and
  `PlaybooksPage` (reuses its existing `useEntitlement()` + `playbooks.length`
  state). 2 new smoke tests (SavePlayModal, PlaysPage); see B-23 for why
  PlaybooksPage's banner has no smoke coverage yet.
- **2026-07-16 · B-19: Google Analytics consent banner** — GA4 no longer loads
  unconditionally: `index.html`'s static gtag.js/`public/gtag-init.js` tags are
  gone, replaced by `src/lib/analytics.ts`'s `loadGoogleAnalytics()` /
  `storeConsent()` / `initAnalyticsFromStoredConsent()`, which inject gtag.js
  and initialize it only after the visitor accepts. New `<ConsentBanner />`
  (bottom-of-page, hidden on `/designer` like Footer/FeedbackButton) shows
  Accept/Decline + a `/privacy` link on first visit; the choice persists in
  `localStorage` (`pbp-analytics-consent`) so the banner doesn't reappear.
  Declining never injects the GA script — no analytics cookies are set.
  Self-contained, no consent-platform dependency. Updated `/privacy`'s
  "Cookies and analytics" section to describe the new consent flow. 3 new
  smoke tests cover decline (banner hides, GA never loads, persists across
  reload), accept (GA script tag appears, persists across reload), and the
  Designer exclusion. Last RED item from the 2026-07-15 legal audit.
- **2026-07-16 · Legal pages + footer + 404** (`94a7358`) — real `/privacy`,
  `/terms`, `/contact` routes (were blank SPA catch-all pages), written around
  actual data practices: Supabase/Stripe/GA4/Netlify processor disclosure,
  public-content notice, self-serve deletion, 13+/COPPA clause, DNT statement,
  auto-renewal + cancellation + refund disclosure for the $39/yr plan, Founding
  Member benefit defined, DMCA notice channel, liability cap, Indiana governing
  law. Site-wide footer (hidden on `/designer`) links them; unknown routes get
  a 404 page; legal pages added to the sitemap edge function. Follow-ups
  spawned: B-19 (GA consent), B-20 (DMCA agent), B-21 (attorney review).
  support@playbuilderpro.com is live (Zoho Mail, DNS via Netlify).
- **2026-07-15 · PR #9 merged: tap-to-edit icon fix** — 4px drag threshold so
  real-pointer jitter doesn't swallow the tap-to-customize popover; PR was 18
  commits stale with a `Canvas.tsx` conflict against B-17's snap guides —
  resolved (threshold check runs before snap logic), 14th smoke test added.
- **2026-07-15 · Football avatar icons** (⚠ SQL run: `football_avatars.sql`,
  applied) — replaced the seeded Dicebear robot avatars with 8 self-contained
  football-themed SVG data URIs (no external image host); repointed existing
  users; dropped `api.dicebear.com` from the CSP.
- **2026-07-15 · SEO foundation + weekly blog workflow** (`9f52677`, ⚠ SQL run:
  `blog_seo.sql`, applied) — blog posts get real `/blog/<slug>` URLs,
  per-page title/meta/OG/JSON-LD via `src/lib/seo.ts`, `robots.txt`, dynamic
  `sitemap.xml` (edge function proxied through Netlify), draft/published
  workflow with admin Publish toggle. A weekly scheduled agent (Mondays 8am,
  local) researches a topic and inserts a draft for human review; first post
  published 2026-07-15.
- **2026-07-15 · Rebrand: navy/chalk/turf** (`3e70aa3` + follow-ups) — brand
  tokens swapped (orange→turf `#1FA75D`, black→navy `#101D2E`/`#16283D`,
  chalk→`#F8F6F1`), route-P logo + wordmark, chalk graph-paper hero with
  "Draw the play. Run the play. Win the day.", favicon + brand SVGs in
  `public/`. Hero CTA opens the designer for signed-out visitors.
- **2026-07-15 · Wristband export (Pro)** (`5bdd2f5`) — the missing Pro
  feature from the pricing page now exists: numbered 4-per-row call-sheet
  card grid with dashed cut lines, in both export surfaces (ExportModal +
  PlaybooksPage), gated behind the same Pro entitlement as playbook PDFs.
  Closes the gap flagged in B-2/B-14.
- **2026-07-15 · B-18 (partial): Stripe sandbox verified end-to-end** — all
  three Edge Functions deployed, sandbox secrets set, webhook registered;
  test checkout with `4242…` card upgraded a fresh free account to Pro via
  the webhook and the billing portal opened. Live-mode swap remains (see
  B-18 in Up next). Gotchas hit and fixed: `VITE_BILLING_ENABLED` must be
  lowercase `true`; sandbox and live mode each have their own price ID,
  secret key, and webhook secret.

- **2026-07-11 · Backlog sweep (B-7, B-13, B-10, B-11, B-14, B-15, B-16, B-17,
  B-3 scaffold)** — one branch, one commit per item:
  - **B-7 Pricing accuracy:** card content already matched the plan; fixed the
    real inaccuracy — Founding/Pro users no longer see Free as "Your current
    plan" / Pro as "Coming soon" (now "Yours free for life").
  - **B-13 Plan & Usage card** on `/account`: plan badge, live meters vs
    `FREE_LIMITS` via head-count queries, upgrade CTA for free users only.
    Reads `subscriptions` directly (exported `rowIsPro()`) — the B-4 gotrue
    deadlock rules out `useEntitlement()` here. Smoke tests cover both states.
  - **B-10 Play voting** (⚠ requires SQL run: `play_votes.sql`): `play_votes`
    table, one vote per user per play, votes only on public plays,
    trigger-cached `plays.upvotes` (mirrors posts votes), `PlayVoteButton` on
    PlaysPage cards with optimistic toggle.
  - **B-11 TopPlays re-enabled**, querying real top-voted public plays;
    renders nothing until at least one public play has a vote (no placeholder
    content, and homepage-safe before the SQL run).
  - **B-14 Team identity** (⚠ requires SQL run: `user_preferences.sql`, also
    carries B-15's columns): team name/logo (avatars bucket) + default game
    format on `/account`; name/logo stamped on the single-play sheet and all
    playbook print layouts (both ExportModal and PlaybooksPage); SavePlayModal
    prefills game format. Wristband export still doesn't exist in the app
    (same finding as B-2) — nothing to stamp there.
  - **B-15 Save & export defaults:** default visibility/play type prefill the
    save dialog; paper size (Letter/A4) applied to every `@page` rule; default
    playbook export style listed first in PlaybooksPage's export menu.
  - **B-16 Email change** on `/account` via `supabase.auth.updateUser({email})`
    with honest confirmation-flow messaging. **Auth — human review + manual
    end-to-end test needed** (Supabase email settings involved).
  - **B-17 Distribution guides:** `computeSnap()` now snaps to the equidistant
    point between two row/column mates (midpoint competes in the same
    nearest-candidate contest; ties go to alignment) with equal-spacing
    bracket guides; smoke test asserts exact equidistance.
  - **B-3 Stripe scaffold (money — human review):** Edge Functions
    `stripe-webhook` (signature-verified, service-role writer of
    `subscriptions`, never downgrades founding members),
    `create-checkout-session` (JWT-verified, $39/yr), `create-portal-session`;
    client `billing.ts` gated behind `VITE_BILLING_ENABLED` (UI stays
    "coming soon" until go-live); `supabase/STRIPE_SETUP.md` has the human
    checklist (now B-18).

- **2026-07-11 · B-6: Repair eslint (flat-config migration)** — `eslint.config.js`
  no longer uses the eslintrc-only `extends` key (unsupported by eslint 9 flat
  config, which is why `npm run lint` was crashing outright); it's now a
  `tseslint.config(...)` array built from `js.configs.recommended` and
  `tseslint.configs.recommended`. That surfaced two more compat breaks:
  `@typescript-eslint/eslint-plugin`/`parser` were still on v6 (eslintrc-only
  configs, no flat-config export), so swapped them for the unified
  `typescript-eslint` v8 meta-package; and `eslint-plugin-react-hooks` v4.6.0
  crashed with `context.getSource is not a function` against eslint 9.12
  (`getSource` was removed) — bumped to v5.2.0. `public/**` (just the GA
  `gtag-init.js` snippet, using ad-hoc browser globals) is now excluded from
  lint, same treatment as `dist`. With the crash fixed, lint then surfaced 66
  real errors: fixed the mechanical/safe ones directly (removed unused
  imports and genuinely dead local code — e.g. `ExportModal.tsx`'s orphaned
  `addTag`/`removeTag`/`safeMetadata`, `FormationSelector.tsx`'s unused LOS
  computation; two `as const` literal fixes in `ImageCropModal.tsx`; a
  targeted `eslint-disable` on `AddToPlaybookModal.tsx`'s `declare global {
  namespace JSX }`, which needs TS namespace syntax for ambient augmentation —
  no ES-module equivalent exists). Left `@typescript-eslint/no-explicit-any`
  as a rule-level downgrade to `warn` rather than retyping the ~30 call sites
  (mostly untyped Supabase query results) — real fixes there are follow-up
  work, not a config-repair PR, and touching that many files risked
  reintroducing the tsc errors B-5 just cleaned up. Added `argsIgnorePattern`/
  `varsIgnorePattern: '^_'` to `no-unused-vars` (the codebase already had an
  `_format` var using that convention that the old broken config never even
  reached). Added `npm run lint` to `verify`. **Acceptance met:** `npm run
  lint` exits 0 (0 errors, 40 warnings — all `no-explicit-any` or pre-existing
  `react-hooks/exhaustive-deps`/`react-refresh` warnings, none new).
- **2026-07-11 · B-5: Fix remaining pre-existing tsc errors, add typecheck to
  verify** — `UserMenu.tsx`: the `avatar_icons` join result is now explicitly
  typed (`{icon_url: string} | {icon_url: string}[] | null`) before the
  array/object branch, since Supabase's select-string parser inferred the
  non-array branch as `never` without a `Database` generic. `AddToPlaybookModal.tsx`:
  `fetchPlaybooks` and `handleAddToPlaybook` now guard on `user` being non-null
  at the top (both are only ever invoked once a signed-in `user` is present, so
  no behavior change). `SavePlayModal.tsx`: both `metadata` initializations now
  include `playName: ''` to satisfy `PlayMetadata` — it's immediately
  overwritten by the caller (`PlayDesigner.handleSavePlay`) with the modal's own
  `name` field, so this is a type-only fix. `AddToPlaybookButton.tsx`: replaced
  `new Set([...prev, id])` (spreads a `Set`, needs `--downlevelIteration` under
  the root `tsconfig.json`'s `es5` target) with `new Set(prev).add(id)`. Added
  `npm run typecheck` (`tsc --noEmit`) and put it first in `verify`.
  **Acceptance met:** `npx tsc --noEmit` exits 0.
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
