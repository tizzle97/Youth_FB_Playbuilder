# Youth Football Playbook Pro

A modern web application for designing and managing football plays.

## Features

- **Play Designer**: Interactive canvas for drawing football plays
- **Play Management**: Save, organize, and share your plays
- **Export Options**: Print plays in various formats (single play, detailed playbook, grid layout)
- **Supabase Integration**: Cloud storage and authentication

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Canvas**: Fabric.js for interactive drawing
- **Backend**: Supabase (database, auth, storage)
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
├── components/
│   ├── designer/     # Play designer components
│   ├── ui/           # Reusable UI components
│   └── layout/       # Layout components
├── lib/              # Utilities and configurations
├── types/            # TypeScript type definitions
└── pages/            # Page components
```
