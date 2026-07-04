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

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Deployment

This app is configured for deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

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
│   └── *.tsx         # Landing-page sections (Navbar, Hero, Pricing, …)
├── lib/              # Shared Supabase client, entitlements, errors, analytics
└── types/            # TypeScript type definitions
```
