import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * Save while signed out → sign up → back to the designer with the play intact.
 *
 * Save used to be a disabled button for signed-out visitors, explained only by
 * a hover tooltip, so the designer had no path to sign-up at all (Oct 2026 GA
 * funnel: 14 of 15 designer visitors never reached /auth). Now it opens a
 * prompt, parks the drawing in localStorage, and the designer restores it —
 * and opens the Save modal — when the coach comes back signed in.
 */

const SUPABASE_URL = readFileSync('.env', 'utf-8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? '';
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const DRAFT_KEY = 'pbp-pending-play';
const PROMPT = 'Save this play to your free account';

type Icon = { x: number; y: number; letter: string };

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

function icons(page: Page): Promise<Icon[]> {
  return page.evaluate(() =>
    (window as unknown as { __PBP_TEST__: { getCanvasState: () => { playerIcons: Icon[] } } })
      .__PBP_TEST__.getCanvasState().playerIcons,
  );
}

/** Signed out: place a QB on the field and return where it landed. */
async function drawQb(page: Page): Promise<Icon> {
  await page.locator('button[title="Player Q"]:visible').click();
  const box = (await page.locator('#play-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.65);
  await expect.poll(async () => (await icons(page)).length).toBe(1);
  return (await icons(page))[0];
}

/** GA events reach dataLayer as `arguments` objects (see analytics.ts). */
const gaEvents = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [])
      .filter((e) => Object.prototype.toString.call(e) === '[object Arguments]' && (e as IArguments)[0] === 'event')
      .map((e) => (e as IArguments)[1] as string),
  );

test('signed-out Save prompts sign-up, and the drawing survives the round trip', async ({ page }) => {
  // Consent granted so the GA events are observable; gtag.js itself is blocked —
  // dataLayer records the commands either way.
  await page.addInitScript(() => localStorage.setItem('pbp-analytics-consent', 'granted'));
  await page.route('**/googletagmanager.com/**', (route) => route.abort());

  await openDesigner(page);
  const qb = await drawQb(page);

  // Save is clickable (no longer disabled) and opens the prompt, not the Save modal.
  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByText(PROMPT)).toBeVisible();
  await expect(page.getByPlaceholder('Enter play name...')).toHaveCount(0);
  expect(await gaEvents(page)).toContain('save_blocked_signed_out');

  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page).toHaveURL(/\/auth\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBe('signup');
  expect(url.searchParams.get('next')).toBe('/designer');
  await expect(page.getByText('Create your account')).toBeVisible();

  const draft = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY))!);
  expect(draft.playerIcons).toHaveLength(1);

  // Come back signed in, as the post-sign-up redirect / confirmation link does.
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'coach@example.com',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date(0).toISOString(),
      },
    }));
  }, AUTH_STORAGE_KEY);
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await openDesigner(page);

  // Polled, not read once — the restore lands through an effect (see the
  // test-bridge-race note in CLAUDE.md).
  await expect.poll(async () => (await icons(page)).map((i) => [i.letter, i.x, i.y]))
    .toEqual([[qb.letter, qb.x, qb.y]]);
  // Signed in now, so finishing the save is one step away.
  await expect(page.getByPlaceholder('Enter play name...')).toBeVisible();
  // Restored at most once.
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
});

test('"I already have an account" goes to sign-in with the same way back', async ({ page }) => {
  await openDesigner(page);
  await drawQb(page);
  await page.locator('button[title="Save play"]:visible').click();
  await page.getByRole('button', { name: 'I already have an account' }).click();

  await expect(page).toHaveURL(/\/auth\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBeNull();
  expect(url.searchParams.get('next')).toBe('/designer');
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).not.toBeNull();
});

test('"Keep drawing" closes the prompt and leaves the play alone', async ({ page }) => {
  await openDesigner(page);
  await drawQb(page);
  await page.locator('button[title="Save play"]:visible').click();
  await page.getByRole('button', { name: 'Keep drawing' }).click();

  await expect(page.getByText(PROMPT)).toHaveCount(0);
  await expect(page).toHaveURL(/\/designer$/);
  expect(await icons(page)).toHaveLength(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
});
