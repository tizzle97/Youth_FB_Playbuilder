import { defineConfig } from '@playwright/test';

// Smoke suite for the flows agents/CI can't eyeball. Runs against the Vite dev
// server on a dedicated port so it never collides with a manually started
// `npm run dev` (5173). Invoked via `npm run smoke` / `npm run verify`.

// Environments that ship their own Chromium instead of the pinned one
// Playwright downloads (the cloud agent container, notably) can point at it
// here rather than hand-editing this file. That hand-edit is what four nightly
// PRs in a row did — B-33, B-34, B-36(1), B-36(2) — each reverting it before
// committing, which left every one of them reporting a pass count that came
// from a partly-broken run. A verification number nobody can trust is worse
// than no number, so this makes the override declarative:
//
//   PBP_CHROMIUM_PATH=/usr/bin/chromium npm run smoke
//
// Unset (every local and CI run today) leaves Playwright's own resolution
// completely untouched.
const chromiumPath = process.env.PBP_CHROMIUM_PATH?.trim() || undefined;

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4517',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  webServer: {
    command: 'npm run dev -- --port 4517 --strictPort',
    url: 'http://localhost:4517',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
