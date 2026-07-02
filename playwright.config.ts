import { defineConfig } from '@playwright/test';

// Smoke suite for the flows agents/CI can't eyeball. Runs against the Vite dev
// server on a dedicated port so it never collides with a manually started
// `npm run dev` (5173). Invoked via `npm run smoke` / `npm run verify`.
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
  },
  webServer: {
    command: 'npm run dev -- --port 4517 --strictPort',
    url: 'http://localhost:4517',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
