# Youth Football Playbook Pro

A modern web application for designing and managing football plays.

## Features

- **Play Designer**: Interactive canvas for drawing football plays
- **Play Management**: Save, organize, and share your plays
- **Export Options**: Print plays in various formats (single play, detailed playbook, grid layout)
- **Supabase Integration**: Cloud storage and authentication

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite, React Router v6
- **Styling**: Tailwind CSS (dark theme)
- **Canvas**: HTML5 Canvas 2D — the play designer draws directly to a `<canvas>`
  (play data stored in normalized 0–1 coordinates); not Fabric.js
- **Backend**: Supabase (Postgres, auth, storage)
- **Icons**: Lucide React

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build. Note: `vite build` does **not** type-check. |
| `npm run preview` | Serve the built output |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint (passes; ~59 non-blocking warnings) |
| `npm run smoke` | Playwright smoke suite against the real app |
| `npm run verify` | typecheck + lint + build + smoke — **run before every commit/PR** |

> Working on this repo with an AI agent? Read `CLAUDE.md` — it carries the
> conventions, the schema/migration workflow, and a set of expensive lessons
> this README doesn't repeat.

## Deployment

This app is deployed on Netlify and auto-deploys on every push to `main`:

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Set environment variables in the Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

SPA routing (so deep links like `/designer` don't 404) relies on
`public/_redirects` (`/* /index.html 200`), which Netlify picks up automatically.

## Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Project Structure

```
src/
├── App.tsx           # Routes + top-level layout
├── main.tsx          # Entry point
├── components/
│   ├── designer/     # Play designer (canvas, toolbar, save/load)
│   ├── plays/        # Play library
│   ├── playbooks/    # Playbook management + PDF export
│   ├── community/    # Community feed
│   ├── blog/         # Blog
│   ├── auth/         # Auth & account settings
│   ├── admin/        # Admin dashboard
│   ├── billing/      # Stripe checkout / upgrade consent
│   ├── feedback/     # In-app feedback capture
│   ├── legal/        # Privacy policy, terms, contact
│   ├── vs/           # "vs Defense" matchup view
│   └── *.tsx         # Landing-page sections (Navbar, Hero, Pricing, …)
├── lib/              # Shared Supabase client, entitlements, errors, analytics
├── hooks/            # Shared React hooks
└── types/            # TypeScript type definitions
```

Also: `supabase/` (SQL + Edge Functions + setup docs — start with `SCHEMA.md`),
`tests/smoke/` (Playwright), `docs/` (automation runbooks, proposals, archive),
`scripts/` (seed library, one-off migrations).
