# Playbuilder Pro

Web app for youth/flag football coaches to design plays, organize them into
playbooks, and print/share them. Live at **playbuilderpro.com**.

## Stack & infrastructure
- **Frontend:** React 18 + TypeScript + Vite, React Router v6
- **Styling:** Tailwind CSS, dark theme. Custom colors: `primary` (orange
  #FF5722), `chalk` (light text), `board` / `board-light` (dark backgrounds).
  Use these tokens, not raw hex.
- **Backend:** Supabase (Postgres, Auth, Storage). Client in `src/lib/supabase.ts` —
  always import the shared client; never call `createClient` in components.
- **Deploy:** Netlify, auto-deploys on push to `main`. SPA routing relies on
  `public/_redirects` (`/* /index.html 200`) — NOT `vercel.json` (legacy, ignored).
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and the GA tag is
  hardcoded in `index.html`). `.env` is git-ignored; never commit secrets.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build. **Run before committing.** Note: `vite build`
  does NOT type-check; run `npx tsc --noEmit` to catch type errors (the repo has
  some pre-existing tsc errors in unrelated files — only worry about files you touch).
- `npm run lint` — eslint (currently broken: flat-config migration, BACKLOG.md B-6)
- `npm run smoke` — Playwright smoke suite (`tests/smoke/`), drives the real app
  headlessly on its own port (4517). Tests assert on real canvas state via the
  dev-only `window.__PBP_TEST__` bridge in `PlayDesigner.tsx` — no pixel sampling.
- `npm run verify` — build + smoke. **Run before every commit/PR.** Extend the
  smoke suite whenever you touch the designer or save/load flows.

## Backlog
`BACKLOG.md` is the prioritized work queue for humans and automated agents.
Agent rules (one item per PR, never run migrations, money code needs human
review) are at the top of that file. When asked to pick up "the next thing,"
take the topmost unblocked item there.

## Database / migrations workflow
- **Read `supabase/SCHEMA.md` for the current schema** (tables, columns, RLS,
  functions) instead of grepping `combined_migrations.sql` — that file is ~2,000
  lines with superseded duplicate blocks and is slow/error-prone to read. Keep
  `SCHEMA.md` updated in the same change whenever you alter the schema.
- Migrations are **plain .sql files in `supabase/`**, run **manually by the user**
  in the Supabase SQL Editor. There is no automated migration runner.
- `combined_migrations.sql` is the original bundled schema. Newer changes are
  separate files (`feedback_admin.sql`, `plays_save.sql`, `subscriptions.sql`,
  `security_hardening.sql`, `community_authors.sql`).
  When schema changes are needed, add a new idempotent `.sql` file and tell the
  user to run it.
- **Admin** is tracked via the `admin_users` table + `is_admin()` function (NOT a
  column on auth.users). Add yourself with an INSERT into `admin_users`.
- **Pro entitlement** is the `subscriptions` table + `is_pro()` function, same
  pattern as `is_admin()`. Writes come only from the (future) Stripe webhook or
  admin SQL — never the client. RLS lets users read only their own row.
- All tables use **Row Level Security**. Mirror existing policy patterns.

## Key architecture notes
- **Play canvas** (`src/components/designer/Canvas.tsx`): pure HTML Canvas (not
  Fabric.js). Play data — player icons and route points — is stored in
  **normalized 0–1 coordinates**, so plays render identically on any screen size.
  `renderScene()` draws at any pixel size; `exportImage()` renders at a fixed
  1650×1275 for consistent PDF/print output. Edit rendering in one place.
- **Plays** are saved to the `plays` table with `canvas_data` = JSON
  `{ version, paths, playerIcons }`. The designer loads an existing play via
  `/designer?play=<id>` and updates it in place (does not duplicate).
- **Entitlements:** `src/lib/entitlements.ts` exposes `useEntitlement()`
  (`isPro` / `plan` / `isFoundingMember`) and `FREE_LIMITS`.

## Monetization (in progress)
Freemium model — see the auto-memory `monetization-plan.md` for full decisions.
Summary: Free = 15 plays / 2 playbooks / single-play PDF / community; Pro = $39/yr
(unlimited + full playbook PDFs + wristband export). Existing users are
grandfathered as **Founding Members** (free Pro for life). Phase 1 (entitlement
plumbing) is done; Stripe checkout + feature gates come next.

## Conventions & workflow
- Match the style of surrounding code; reuse the shared Supabase client and the
  `primary`/`chalk`/`board` Tailwind tokens.
- **Verify before claiming done.** Use the browser preview to confirm UI changes
  actually work — and check the *right* signal (e.g. player-icon colors, not just
  any non-white pixel, which the field lines always produce).
- Commit and push only when work is verified. Commit messages end with the
  Co-Authored-By trailer.
- Don't ship misleading placeholder content (fabricated testimonials, non-working
  donate buttons, etc.) — prefer removing or honestly labeling "coming soon".
