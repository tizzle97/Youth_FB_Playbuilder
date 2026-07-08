import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';

// Mocked-session tests must seed localStorage under the same key the real
// supabase-js client reads (`sb-<project-ref>-auth-token`, derived from
// VITE_SUPABASE_URL's hostname) or the app never picks up the fake session
// and silently treats the user as signed out.
const SUPABASE_URL = readFileSync('.env', 'utf-8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? '';
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Smoke suite for the flows that matter most and break most quietly: the Play
 * Designer's draw/undo behavior and the saved-play load path.
 *
 * Assertions read real canvas state through the dev-only `window.__PBP_TEST__`
 * bridge (see PlayDesigner.tsx) — no pixel sampling.
 *
 * Timing rule: the canvas treats two taps within 350ms as "double-tap to
 * finish the route" (Canvas.tsx handlePointerDown), so consecutive canvas
 * clicks while drawing must be spaced further apart than that.
 */
const TAP_GAP = 450;

type CanvasState = {
  paths: Array<{ points: { x: number; y: number }[]; color: string; startIconIndex?: number; mode: string }>;
  playerIcons: Array<{ x: number; y: number; letter: string; color: string; shape?: string }>;
  zones: Array<{ iconIndex: number; cx: number; cy: number; rx: number; ry: number; color: string }>;
};

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

function canvasState(page: Page): Promise<CanvasState> {
  return page.evaluate(() =>
    (window as unknown as { __PBP_TEST__: { getCanvasState: () => unknown } }).__PBP_TEST__.getCanvasState(),
  ) as Promise<CanvasState>;
}

/** Page coords for a point at fractional position (fx, fy) inside the canvas. */
async function canvasPoint(page: Page, fx: number, fy: number) {
  const box = await page.locator('#play-canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

// Toolbar renders twice (desktop top bar + mobile bottom bar); :visible picks
// the one that exists at the test viewport size.
const btn = (page: Page, title: string) => page.locator(`button[title="${title}"]:visible`);

test('home page renders without uncaught errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Flag Football League');
  expect(errors, errors.map((e) => e.message).join('\n')).toHaveLength(0);
});

test('offense: place a player, draw a straight route, undo both', async ({ page }) => {
  await openDesigner(page);

  // Place Q
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);

  let state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);
  expect(state.playerIcons[0].letter).toBe('Q');
  // Coordinates are stored normalized 0–1
  expect(state.playerIcons[0].x).toBeGreaterThan(0);
  expect(state.playerIcons[0].x).toBeLessThan(1);

  // Draw a straight route: origin = the icon, one endpoint, then Finish Route
  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].startIconIndex).toBe(0);
  expect(state.paths[0].points.length).toBeGreaterThanOrEqual(2);

  // Undo removes the route first, then the icon
  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.paths).toHaveLength(0);
  expect(state.playerIcons).toHaveLength(1);

  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(0);
});

test('defense: place a safety and drag a zone of responsibility', async ({ page }) => {
  await openDesigner(page);

  await page.getByRole('button', { name: 'defense', exact: true }).click();
  await btn(page, 'Player S').click();
  const spot = await canvasPoint(page, 0.5, 0.55);
  await page.mouse.click(spot.x, spot.y);

  let state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);
  expect(state.playerIcons[0].letter).toBe('S');

  // Zone tool: single drag starting on the defender sizes the zone
  await btn(page, 'Draw a zone of responsibility (drag from a player)').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(icon.x + 110, icon.y + 70, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  expect(state.zones).toHaveLength(1);
  expect(state.zones[0].iconIndex).toBe(0);
  expect(state.zones[0].rx).toBeGreaterThan(0);
  expect(state.zones[0].ry).toBeGreaterThan(0);
  expect(state.zones[0].color).toBe(state.playerIcons[0].color);

  // Play type locks once the canvas has content
  await expect(page.getByRole('button', { name: 'offense', exact: true })).toBeDisabled();

  // Customize the defender: icons render on top of zones, so tapping the
  // icon (even inside its own zone) must open the editor — and the zone
  // must recolor along with the icon.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);
  const labelInput = page.getByLabel('Player label');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('FS');
  await page.getByLabel('Color #8B5CF6').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.playerIcons[0].letter).toBe('FS');
  expect(state.playerIcons[0].color).toBe('#8B5CF6');
  expect(state.zones[0].color).toBe('#8B5CF6');
});

test('customize a placed icon: new label, new color, route recolors to match', async ({ page }) => {
  await openDesigner(page);

  // Place Q and draw a straight route from it
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);

  let state = await canvasState(page);
  const originalColor = state.playerIcons[0].color;

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe(originalColor);

  // Back to Select mode; tap the icon to open the customize popover
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);

  const labelInput = page.getByLabel('Player label');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('12'); // numbers allowed, not just roster letters
  await page.getByLabel('Color #E11D48').click();
  await page.getByLabel('Shape star').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.playerIcons[0].letter).toBe('12');
  expect(state.playerIcons[0].color).toBe('#E11D48');
  expect(state.playerIcons[0].shape).toBe('star');
  // The icon's existing route follows the new color
  expect(state.paths[0].color).toBe('#E11D48');

  // The edit is a single undoable step: undo restores label, color, shape, and route color
  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.playerIcons[0].letter).toBe('Q');
  expect(state.playerIcons[0].color).toBe(originalColor);
  expect(state.playerIcons[0].shape).toBeUndefined();
  expect(state.paths[0].color).toBe(originalColor);
});

test('custom toolbar player: place an icon with a custom label and color', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Custom player (choose label and color)').click();
  const labelInput = page.getByLabel('Player label');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('WR1');
  await page.getByLabel('Color #14B8A6').click();
  await page.getByLabel('Shape triangle').click();
  await page.getByRole('button', { name: 'Place Player' }).click();

  const spot = await canvasPoint(page, 0.6, 0.6);
  await page.mouse.click(spot.x, spot.y);

  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);
  expect(state.playerIcons[0].letter).toBe('WR1');
  expect(state.playerIcons[0].color).toBe('#14B8A6');
  expect(state.playerIcons[0].shape).toBe('triangle');
});

test('free-tier play limit: server rejection surfaces as an upgrade prompt', async ({ page }) => {
  // Covers the client half of B-1 (server-enforced free-tier limits): when
  // the enforce_plays_free_limit() trigger (supabase/free_tier_limits.sql)
  // rejects a 16th play insert with its custom PBP01 code, the UI must show
  // the trigger's friendly message rather than a raw/generic DB error. The
  // trigger itself runs only against a real Supabase instance and isn't
  // covered by this mocked-backend suite.
  await page.addInitScript((storageKey) => {
    const session = {
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
    };
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, AUTH_STORAGE_KEY);

  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/rest/v1/plays**', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PBP01',
        message: 'Free plan is limited to 15 plays. Upgrade to Pro for unlimited plays.',
        details: null,
        hint: null,
      }),
    });
  });

  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);

  await page.locator('button[title="Save play"]:visible').click();
  await page.getByPlaceholder('Enter play name...').fill('16th Play');
  await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
  await page.getByRole('button', { name: 'Save Play' }).click();

  await expect(
    page.getByText('Free plan is limited to 15 plays. Upgrade to Pro for unlimited plays.'),
  ).toBeVisible();
});

test('account settings page renders for a signed-in user (mocked backend)', async ({ page }) => {
  // Regression test: the page previously rendered blank because a type-only
  // `User` import was used as a JSX component (undefined at runtime), which
  // crashed the whole route after "Loading..." cleared.
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  const userJson = {
    id: '11111111-1111-1111-1111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'coach@example.com',
    app_metadata: {},
    user_metadata: { username: 'coach' },
    created_at: '2025-09-01T00:00:00Z',
  };

  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }),
  );
  await page.route('**/rest/v1/user_reputation**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ avatar_type: 'icon', avatar_url: null, avatar_icon_id: null }),
    }),
  );
  await page.route('**/rest/v1/avatar_icons**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/account');

  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  await expect(page.getByText('Member Since')).toBeVisible();
  // The username section is where the crash happened (icon next to the input)
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.getByText('Delete Account').first()).toBeVisible();
  expect(errors, errors.map((e) => e.message).join('\n')).toHaveLength(0);
});

test('loads a saved defensive play via /designer?play= (mocked backend)', async ({ page }) => {
  // Covers the client half of the save→reload seam without needing an
  // authenticated Supabase session: version-3 canvas_data with icons, a
  // route, and a zone must all land back on the canvas.
  const canvasData = JSON.stringify({
    version: 3,
    paths: [
      { points: [{ x: 0.5, y: 0.6 }, { x: 0.5, y: 0.35 }], color: '#14B8A6', startIconIndex: 1, mode: 'straight' },
    ],
    playerIcons: [
      { x: 0.45, y: 0.7, letter: 'S', color: '#E11D48' },
      { x: 0.5, y: 0.6, letter: 'LB', color: '#14B8A6' },
    ],
    zones: [{ iconIndex: 0, cx: 0.45, cy: 0.7, rx: 0.12, ry: 0.1, color: '#E11D48' }],
  });

  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Cover 2',
        type: 'defense',
        canvas_data: canvasData,
        description: '',
        is_public: false,
        metadata: { playName: 'Cover 2' },
      }),
    }),
  );

  await page.goto('/designer?play=00000000-0000-0000-0000-000000000001');
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 2 : false;
  });

  const state = await canvasState(page);
  expect(state.playerIcons.map((i) => i.letter)).toEqual(['S', 'LB']);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].startIconIndex).toBe(1);
  expect(state.zones).toHaveLength(1);
  expect(state.zones[0].iconIndex).toBe(0);

  // Editing mode + defense roster active
  await expect(page.getByText('(editing)')).toBeVisible();
  await expect(btn(page, 'Player S')).toBeVisible();
  await expect(page.getByRole('button', { name: 'defense', exact: true })).toBeDisabled();
});

test('export gates (B-2): playbook PDF formats are Pro-locked, single-play stays free', async ({ page }) => {
  // Anonymous users resolve to the free plan without a subscriptions row.
  await openDesigner(page);
  await page.getByRole('button', { name: 'Export' }).click();

  await expect(page.getByText('Single Play Sheet')).toBeVisible();
  await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();

  // Locked format shows the upgrade prompt instead of advancing to the print screen.
  await page.getByText('Playbook Grid').click();
  await expect(page.getByText('Playbook PDF export is a Pro feature')).toBeVisible();
  await page.getByRole('button', { name: 'Maybe later' }).click();

  // Free single-play export is unaffected.
  await page.getByText('Single Play Sheet').click();
  await expect(page.getByRole('button', { name: /Print Play/ })).toBeVisible();
});

test('export gates (B-2): Pro accounts see playbook formats unlocked', async ({ page }) => {
  const userJson = {
    id: '22222222-2222-2222-2222-222222222222',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'pro-coach@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2025-09-01T00:00:00Z',
  };

  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }),
  );
  // Entitlement is mocked (simulated Pro), per B-2's acceptance criteria.
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'pro', current_period_end: null }),
    }),
  );

  await openDesigner(page);
  await page.getByRole('button', { name: 'Export' }).click();

  await expect(page.getByText('Single Play Sheet')).toBeVisible();
  await expect(page.getByText('Pro', { exact: true })).toHaveCount(0);

  await page.getByText('Playbook Grid').click();
  await expect(page.getByRole('button', { name: /Print Playbook/ })).toBeVisible();
  await expect(page.getByText('is a Pro feature')).toHaveCount(0);
});
