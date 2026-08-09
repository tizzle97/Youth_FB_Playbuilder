import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';

// Same session-seeding trick as designer.spec.ts — supabase-js reads the
// session from localStorage under a key derived from VITE_SUPABASE_URL.
const SUPABASE_URL = readFileSync('.env', 'utf-8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? '';
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Smoke coverage for Account Settings → Your Feedback.
 *
 * Until this shipped, sending feedback was fire-and-forget: the RLS policy
 * letting a user read their own rows had existed since the first migration and
 * nothing ever queried it. The thing worth protecting is that the query is
 * scoped to the signed-in user and that an admin's reply actually reaches them.
 */

const USER = {
  id: '99999999-9999-4999-8999-999999999999',
  aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
  app_metadata: {}, user_metadata: { username: 'Coach' }, created_at: '2025-01-01T00:00:00Z',
};

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FAKE_JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
  sub: USER.id, aud: 'authenticated', role: 'authenticated', session_id: 'sess-1',
  email: USER.email, exp: Math.floor(Date.now() / 1000) + 3600,
})}.sig`;

const ROWS = [
  {
    id: 'cccccccc-3333-4333-8333-cccccccccccc',
    type: 'bug',
    content: 'Wristband export cuts off the last play.',
    status: 'resolved',
    admin_reply: 'Fixed in the release that went out Tuesday — thanks for the report.',
    replied_at: '2026-08-08T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'dddddddd-4444-4444-8444-dddddddddddd',
    type: 'feature',
    content: 'Let me duplicate a whole playbook.',
    status: 'pending',
    admin_reply: null,
    replied_at: null,
    created_at: '2026-08-05T00:00:00Z',
  },
];

/** Seeds a session and stubs REST. Returns the feedback SELECT URLs seen, so a
 *  test can assert the query was actually scoped to this user. */
async function accountPage(page: Page, rows: unknown[]): Promise<string[]> {
  const feedbackQueries: string[] = [];

  await page.addInitScript(({ u, k, jwt }) => {
    localStorage.setItem('pbp-analytics-consent', 'denied');
    localStorage.setItem(k, JSON.stringify({
      access_token: jwt, refresh_token: 'ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: u,
    }));
  }, { u: USER, k: AUTH_STORAGE_KEY, jwt: FAKE_JWT });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));

  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    if (req.url().includes('/feedback') && req.method() === 'GET') {
      feedbackQueries.push(req.url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/account');
  return feedbackQueries;
}

test('a coach can see their own submissions and the reply they got', async ({ page }) => {
  const queries = await accountPage(page, ROWS);

  await expect(page.getByRole('heading', { name: 'Your Feedback' })).toBeVisible();
  await expect(page.getByText('2 submissions')).toBeVisible();
  await expect(page.getByText('Wristband export cuts off the last play.')).toBeVisible();
  await expect(page.getByText('Fixed in the release that went out Tuesday — thanks for the report.')).toBeVisible();

  // Status is what tells them anything happened at all.
  await expect(page.getByText('resolved')).toBeVisible();
  await expect(page.getByText('pending')).toBeVisible();

  // Scoped to the signed-in user — the RLS policy enforces this server-side,
  // but sending an unscoped query would still be a bug worth catching.
  await expect.poll(() => queries.length, { timeout: 10000 }).toBeGreaterThan(0);
  expect(queries[0]).toContain(`user_id=eq.${USER.id}`);
});

test('coaches who have never sent feedback get no empty panel', async ({ page }) => {
  // Most accounts. An explainer for a feature they've never used is clutter.
  await accountPage(page, []);

  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Feedback' })).toHaveCount(0);
});
