import { test, expect, Page, CDPSession } from '@playwright/test';
import { readFileSync } from 'fs';
import { zoneConnectorVisible } from '../../src/lib/renderPlayScene';

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
  paths: Array<{ points: { x: number; y: number }[]; color: string; startIconIndex?: number; mode: string; capStyle?: string; dashed?: boolean; segmentDashed?: boolean[]; independentColor?: boolean }>;
  playerIcons: Array<{ x: number; y: number; letter: string; color: string; shape?: string }>;
  zones: Array<{ iconIndex: number; cx: number; cy: number; rx: number; ry: number; color: string }>;
  textBoxes: Array<{ x: number; y: number; text: string; color: string; fontSize: number }>;
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

/**
 * Clicks a locator at its actual on-screen coordinates, bypassing
 * Locator.click()'s auto-scroll-into-view. Playwright's normal .click() will
 * happily scroll a clipped/off-screen element into the viewport before
 * clicking it — which would silently pass even if a real user could never
 * see or reach that element (the exact bug the formation menu shipped with;
 * see the FormationMenu.tsx portal comment).
 */
async function realClick(page: Page, locator: ReturnType<Page['getByRole']>) {
  const box = await locator.boundingBox();
  expect(box, 'element should have a real, unclipped position').not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test('home page renders without uncaught errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Win the day');
  expect(errors, errors.map((e) => e.message).join('\n')).toHaveLength(0);
});

const gaScriptPresent = (page: Page) =>
  page.evaluate(() => Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')));

/**
 * Whether a usable GA `config` command actually reached dataLayer.
 *
 * The script tag existing is NOT enough: gtag.js only recognizes an entry as a command
 * when it's an `arguments` object. A regression that pushed a plain Array instead left
 * the tag loading normally while GA recorded nothing for three weeks, and the old
 * script-tag-only assertion passed the whole time. Assert the shape, not the tag.
 */
const gaConfigCommandSent = (page: Page, measurementId: string) =>
  page.evaluate((id) => {
    const entries: unknown[] = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
    return entries.some(
      (e) =>
        Object.prototype.toString.call(e) === '[object Arguments]' &&
        (e as IArguments)[0] === 'config' &&
        (e as IArguments)[1] === id,
    );
  }, measurementId);

test('GA consent banner (B-19): declining hides it and blocks the GA script', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByText('We use Google Analytics', { exact: false });
  await expect(banner).toBeVisible();
  expect(await gaScriptPresent(page)).toBe(false);

  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(banner).not.toBeVisible();
  expect(await gaScriptPresent(page)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('pbp-analytics-consent'))).toBe('denied');

  await page.reload();
  await expect(banner).not.toBeVisible();
  expect(await gaScriptPresent(page)).toBe(false);
  expect(await gaConfigCommandSent(page, 'G-LS75BRZG15')).toBe(false);
});

test('GA consent banner (B-19): accepting loads gtag.js and remembers the choice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('We use Google Analytics', { exact: false })).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pbp-analytics-consent'))).toBe('granted');
  expect(await gaScriptPresent(page)).toBe(true);
  expect(await gaConfigCommandSent(page, 'G-LS75BRZG15')).toBe(true);

  await page.reload();
  expect(await gaScriptPresent(page)).toBe(true);
  expect(await gaConfigCommandSent(page, 'G-LS75BRZG15')).toBe(true);
});

const cfBeaconPresent = (page: Page) =>
  page.evaluate(() =>
    Boolean(document.querySelector('script[src*="static.cloudflareinsights.com/beacon"]')));

test('Cloudflare Web Analytics is cookieless, so it loads without consent', async ({ page }) => {
  // The whole point of the CF beacon is that it is NOT consent-gated: it measures 100% of
  // visitors, where GA only ever sees the share who accept. If someone moves it behind the
  // banner "for consistency", this fails.
  await page.goto('/');
  expect(await cfBeaconPresent(page)).toBe(true);
  expect(await gaScriptPresent(page)).toBe(false); // GA still waits for consent

  await page.getByRole('button', { name: 'Decline' }).click();
  expect(await cfBeaconPresent(page)).toBe(true);
  expect(await gaScriptPresent(page)).toBe(false);

  // ...and it must set no cookies, which is what exempts it from the consent prompt.
  const cookies = await page.context().cookies();
  expect(cookies.filter((c) => /cf|cloudflare/i.test(c.name))).toEqual([]);
});

test('GA consent banner is hidden on the full-screen Play Designer', async ({ page }) => {
  await openDesigner(page);
  await expect(page.getByText('We use Google Analytics', { exact: false })).toHaveCount(0);
});

// The on-screen canvas must keep the export render's 1650:1275 aspect ratio
// at every viewport shape — radii are stored normalized per-axis, so if the
// ratios differ, a circular zone drawn on screen prints as a squished ellipse.
test('canvas is letterboxed to the export aspect ratio at any viewport', async ({ page }) => {
  const EXPORT_RATIO = 1650 / 1275;
  for (const viewport of [{ width: 1900, height: 900 }, { width: 800, height: 1100 }]) {
    await page.setViewportSize(viewport);
    await openDesigner(page);
    const box = await page.locator('#play-canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(EXPORT_RATIO, 2);
  }
});

// Canvas zoom (mobile): zoom buttons scale the canvas, coordinates stay
// correct while zoomed, and select-mode drag on empty field pans the view.
test('canvas zoom: scale, place-at-zoom, pan, reset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);

  const base = await page.locator('#play-canvas').boundingBox();
  await page.locator('button[title="Zoom in"]').click();
  await page.locator('button[title="Zoom in"]').click();
  await expect(page.locator('button[title="Reset zoom"]')).toHaveText('200%');
  const zoomed = await page.locator('#play-canvas').boundingBox();
  expect(zoomed!.width / base!.width).toBeCloseTo(2, 1);

  // Placing an icon while zoomed stores the tapped field fraction, not the
  // screen fraction — the pointer math must be zoom-agnostic.
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.5, 0.5);
  await page.mouse.click(spot.x, spot.y);
  const state = await canvasState(page);
  expect(state.playerIcons[0].x).toBeCloseTo(0.5, 1);
  expect(state.playerIcons[0].y).toBeCloseTo(0.5, 1);

  // Drag on empty field (select mode) pans: content follows the pointer,
  // so dragging left increases scrollLeft.
  const scrollLeft = () => page.evaluate(() => document.querySelector('main')!.scrollLeft);
  const before = await scrollLeft();
  await page.mouse.move(200, 300);
  await page.mouse.down();
  await page.mouse.move(120, 300, { steps: 6 });
  await page.mouse.up();
  expect(await scrollLeft()).toBeGreaterThan(before);

  await page.locator('button[title="Reset zoom"]').click();
  const reset = await page.locator('#play-canvas').boundingBox();
  expect(reset!.width).toBeCloseTo(base!.width, 0);
});

/**
 * Dispatches a real two-finger touch sequence via the CDP Input domain
 * (Playwright's own mouse/touchscreen APIs only model a single pointer, so
 * they can't simulate a pinch). Each call's `touchPoints` is the *complete*
 * current set of active touches — Chromium diffs against the previous call
 * to decide which touch(es) started/moved/ended, matched by `id`. This goes
 * through the real input pipeline (unlike hand-dispatched PointerEvents), so
 * pointer capture behaves exactly as it would for a real finger.
 *
 * Approximates a pinch (B-34) well enough for CI, but is still a simulation
 * — see the smoke suite note in BACKLOG.md B-34 recommending a real-device
 * check before merge.
 */
async function touchPoints(
  client: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: { x: number; y: number; id: number }[],
) {
  await client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

// Pinch-to-zoom (B-34): spreading two fingers zooms in continuously (not in
// fixed button-pill steps) anchored under the fingers' midpoint.
test('pinch-to-zoom: spreading two fingers zooms in continuously', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const client = await page.context().newCDPSession(page);

  const base = await page.locator('#play-canvas').boundingBox();
  const cx = base!.x + base!.width / 2;
  const cy = base!.y + base!.height / 2;

  await touchPoints(client, 'touchStart', [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }]);
  for (const sep of [50, 80, 110]) {
    await touchPoints(client, 'touchMove', [{ x: cx - sep, y: cy, id: 1 }, { x: cx + sep, y: cy, id: 2 }]);
  }
  await touchPoints(client, 'touchEnd', []);

  const pillText = await page.locator('button[title="Reset zoom"]').textContent();
  const pct = parseInt(pillText || '100', 10);
  expect(pct).toBeGreaterThan(100);

  const zoomed = await page.locator('#play-canvas').boundingBox();
  expect(zoomed!.width).toBeGreaterThan(base!.width);
});

// Pinch suppression (B-34): a second finger touching down mid-drag must
// abort the in-progress single-finger icon drag rather than let it keep
// tracking that finger's continued movement during the pinch.
test('pinch suppresses an in-progress single-finger icon drag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const client = await page.context().newCDPSession(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.5, 0.5);
  await page.mouse.click(spot.x, spot.y);
  expect((await canvasState(page)).playerIcons).toHaveLength(1);

  // Finger 1 lands on the icon and drags it — a real single-finger move.
  await touchPoints(client, 'touchStart', [{ x: spot.x, y: spot.y, id: 1 }]);
  await touchPoints(client, 'touchMove', [{ x: spot.x + 40, y: spot.y, id: 1 }]);
  const midDrag = await canvasState(page);
  expect(midDrag.playerIcons[0].x).toBeGreaterThan(0.5); // actually dragged

  // Finger 2 joins mid-drag — from here on this is a pinch, not a drag.
  await touchPoints(client, 'touchStart', [
    { x: spot.x + 40, y: spot.y, id: 1 },
    { x: spot.x + 120, y: spot.y, id: 2 },
  ]);
  for (const spread of [10, 30]) {
    await touchPoints(client, 'touchMove', [
      { x: spot.x + 40 - spread, y: spot.y, id: 1 },
      { x: spot.x + 120 + spread, y: spot.y, id: 2 },
    ]);
  }
  await touchPoints(client, 'touchEnd', []);

  const after = await canvasState(page);
  // The icon stayed exactly where finger 1 left it when finger 2 landed —
  // finger 1's further movement during the pinch never reached the drag.
  expect(after.playerIcons[0].x).toBeCloseTo(midDrag.playerIcons[0].x, 5);
  expect(after.playerIcons[0].y).toBeCloseTo(midDrag.playerIcons[0].y, 5);

  // And the pinch itself was live: zoom actually changed.
  const pillText = await page.locator('button[title="Reset zoom"]').textContent();
  expect(parseInt(pillText || '100', 10)).toBeGreaterThan(100);
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

// Drag-to-draw route segments with axis-lock snapping: press-drag-release
// rubber-bands a segment from the route's tip; within the snap tolerance of
// dead-vertical/horizontal the point locks onto the axis (perfect
// 90°-from-LOS go routes), while real diagonals (slants/posts) are untouched.
// The old tap-tap flow is a press-release with no movement and must keep
// working — covered by the straight-route test above.
test('routes: drag-to-draw snaps near-vertical to exact vertical, keeps slants, respects magnet toggle', async ({ page }) => {
  await openDesigner(page);

  // Receiver off-center so the field-centerline snap can't interfere.
  await btn(page, 'Player X').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const icon = state.playerIcons[0];

  // Press the icon and drag out ~5px off vertical in one motion.
  await btn(page, 'Straight Line Route').click();
  const iconPx = await canvasPoint(page, icon.x, icon.y);
  await page.mouse.move(iconPx.x, iconPx.y);
  await page.mouse.down();
  await page.mouse.move(iconPx.x + 5, iconPx.y - 180, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].points[1].x).toBe(state.paths[0].points[0].x); // exact vertical

  // A real slant (far outside tolerance) keeps its angle.
  await btn(page, 'Player Y').click();
  const spot2 = await canvasPoint(page, 0.6, 0.6);
  await page.mouse.click(spot2.x, spot2.y);
  state = await canvasState(page);
  const icon2 = state.playerIcons[1];
  await btn(page, 'Straight Line Route').click();
  const icon2Px = await canvasPoint(page, icon2.x, icon2.y);
  await page.mouse.move(icon2Px.x, icon2Px.y);
  await page.mouse.down();
  await page.mouse.move(icon2Px.x + 120, icon2Px.y - 140, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(2);
  expect(Math.abs(state.paths[1].points[1].x - state.paths[1].points[0].x)).toBeGreaterThan(0.05);

  // Magnet off: the same near-vertical drag stays freehand.
  await btn(page, 'Snap to alignment').click();
  await btn(page, 'Player Z').click();
  const spot3 = await canvasPoint(page, 0.8, 0.6);
  await page.mouse.click(spot3.x, spot3.y);
  state = await canvasState(page);
  const icon3 = state.playerIcons[2];
  await btn(page, 'Straight Line Route').click();
  const icon3Px = await canvasPoint(page, icon3.x, icon3.y);
  await page.mouse.move(icon3Px.x, icon3Px.y);
  await page.mouse.down();
  await page.mouse.move(icon3Px.x + 5, icon3Px.y - 180, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(3);
  expect(state.paths[2].points[1].x).not.toBe(state.paths[2].points[0].x);
});

test('offense: block ending toggle on Straight mode, path mode stays "straight", capStyle is "block", undo clears it', async ({ page }) => {
  await openDesigner(page);

  // Place a lineman
  await btn(page, 'Player C').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);

  // Block is now an ending-style toggle, not its own mode — select Straight,
  // then switch the ending to Block before drawing.
  await btn(page, 'Straight Line Route').click();
  await btn(page, 'Ending style: Route (arrow) / Block (perpendicular cap)').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].mode).toBe('straight');
  expect(state.paths[0].capStyle).toBe('block');
  expect(state.paths[0].startIconIndex).toBe(0);

  // Undo removes the block path first, then the icon — same history
  // behavior as a regular route.
  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.paths).toHaveLength(0);
  expect(state.playerIcons).toHaveLength(1);

  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(0);
});

test('offense: curved route with block ending and dotted line — new combination not possible under the old 3-mode toolbar', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player C').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Multi-Segment Route (drag or tap to place points, double-tap to finish)').click();
  await btn(page, 'Ending style: Route (arrow) / Block (perpendicular cap)').click();
  await btn(page, 'Line style: Solid / Dotted').click();

  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const mid = await canvasPoint(page, 0.5, 0.45);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].mode).toBe('waypoint');
  expect(state.paths[0].capStyle).toBe('block');
  expect(state.paths[0].dashed).toBe(true);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Mixed solid/dashed segments within one straight-line route (feedback: a
 * coach draws a solid hitch, then breaks into a dashed in/out cut, as one
 * continuous route). Deliberately straight-mode only — see the segmentDashed
 * comment in renderPlayScene.ts for why curved routes don't get this.
 * ──────────────────────────────────────────────────────────────────────────── */

test('straight route: toggling dash mid-draw produces mixed segments', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);

  // Segment 1 (solid hitch): commit it BEFORE toggling.
  const mid = await canvasPoint(page, 0.4, 0.45);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(TAP_GAP);

  // Toggle to dashed, then commit segment 2 (the in/out cut).
  await btn(page, 'Line style: Solid / Dotted').click();
  const end = await canvasPoint(page, 0.55, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].mode).toBe('straight');
  expect(state.paths[0].points).toHaveLength(3);
  expect(state.paths[0].segmentDashed).toEqual([false, true]);
});

test('straight route: toggling dash but ending up uniform omits segmentDashed', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);

  // Toggle to dashed BEFORE placing anything, so every segment is dashed —
  // net uniform, even though the button was clicked mid-route-session.
  await btn(page, 'Line style: Solid / Dotted').click();
  const mid = await canvasPoint(page, 0.4, 0.45);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.55, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].dashed).toBe(true);
  expect(state.paths[0].segmentDashed).toBeUndefined();
});

test('straight route: undo mid-route after toggling pops the right segment style', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);

  // Segment 1: dashed.
  await btn(page, 'Line style: Solid / Dotted').click();
  const p1 = await canvasPoint(page, 0.4, 0.45);
  await page.mouse.click(p1.x, p1.y);
  await page.waitForTimeout(TAP_GAP);

  // Segment 2: solid — then place a THIRD point we're about to undo away.
  await btn(page, 'Line style: Solid / Dotted').click();
  const p2 = await canvasPoint(page, 0.5, 0.35);
  await page.mouse.click(p2.x, p2.y);
  await page.waitForTimeout(TAP_GAP);
  const p3 = await canvasPoint(page, 0.6, 0.25);
  await page.mouse.click(p3.x, p3.y);
  await page.waitForTimeout(TAP_GAP);

  // Undo pops the last committed point (p3) and its segment style, leaving
  // origin -> p1 (dashed) -> p2 (solid) in progress.
  await btn(page, 'Undo').click();
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].points).toHaveLength(3);
  expect(state.paths[0].segmentDashed).toEqual([true, false]);
});

test('straight route: canceling mid-route leaves no stale segment styles for the next route', async ({ page }) => {
  await openDesigner(page);

  // First icon: start a route, toggle to dashed, then cancel via the Cancel button.
  await btn(page, 'Player Q').click();
  const spotQ = await canvasPoint(page, 0.3, 0.65);
  await page.mouse.click(spotQ.x, spotQ.y);
  await btn(page, 'Player R').click();
  const spotR = await canvasPoint(page, 0.6, 0.65);
  await page.mouse.click(spotR.x, spotR.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const iconQ = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(iconQ.x, iconQ.y);
  await page.waitForTimeout(TAP_GAP);
  await btn(page, 'Line style: Solid / Dotted').click();
  const midQ = await canvasPoint(page, 0.35, 0.45);
  await page.mouse.click(midQ.x, midQ.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Second icon: a fresh, never-toggled route must come out fully solid —
  // no leftover per-segment state from the canceled route.
  const iconR = await canvasPoint(page, state.playerIcons[1].x, state.playerIcons[1].y);
  await page.mouse.click(iconR.x, iconR.y);
  await page.waitForTimeout(TAP_GAP);
  const midR = await canvasPoint(page, 0.65, 0.45);
  await page.mouse.click(midR.x, midR.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  // The global dash toggle is deliberately sticky across routes (unrelated
  // to this feature — unchanged pre-existing behavior), so the second route
  // legitimately inherits "dashed" from the first toggle click. What must
  // NOT happen is a leaked per-segment array from the canceled route.
  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].points).toHaveLength(2);
  expect(state.paths[0].segmentDashed).toBeUndefined();
});

test('curved route: toggling dash mid-draw never sets segmentDashed (straight-only feature)', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Multi-Segment Route (drag or tap to place points, double-tap to finish)').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);

  const mid = await canvasPoint(page, 0.4, 0.45);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(TAP_GAP);
  await btn(page, 'Line style: Solid / Dotted').click();
  const end = await canvasPoint(page, 0.55, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].mode).toBe('waypoint');
  // Whole-path `dashed` still reflects the toggle at commit time (unchanged
  // legacy behavior for curved routes) — it's the per-segment field that
  // must never appear here.
  expect(state.paths[0].dashed).toBe(true);
  expect(state.paths[0].segmentDashed).toBeUndefined();
});

test('custom formations: signed-out/free user sees a locked upsell instead of the save flow', async ({ page }) => {
  await openDesigner(page);
  await btn(page, 'Formation templates').click();
  const lockedRow = page.getByText('Save your own formations — Pro');
  await expect(lockedRow).toBeVisible();
  // Never even attempts a custom_formations fetch for non-Pro users.
  await expect(page.getByText('Save current arrangement')).toHaveCount(0);

  await lockedRow.click();
  await expect(page.getByText('Custom formations is a Pro feature')).toBeVisible();
});

test('custom formations (Pro): save current icons, see it listed, stamp it, then delete it', async ({ page }) => {
  const userJson = {
    id: '33333333-3333-3333-3333-333333333333',
    aud: 'authenticated', role: 'authenticated', email: 'pro-coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro', current_period_end: null }) }));

  const savedRow = {
    id: 'cf-1', name: 'My Trips Set', game_type: '11v11',
    icons: [{ x: 0.5, y: 0.6, letter: 'Q', color: '#3B82F6', shape: 'circle' }],
  };
  // Reflects real backend state across the test's save → reopen → delete →
  // reopen sequence, since the menu refetches the list every time it opens.
  let stored: typeof savedRow | null = null;
  await page.route('**/rest/v1/custom_formations**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stored ? [stored] : []) });
    }
    if (method === 'POST') {
      stored = savedRow;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(savedRow) });
    }
    if (method === 'DELETE') {
      stored = null;
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' });
    }
    return route.continue();
  });

  await openDesigner(page);

  // Place one icon so there's something to save.
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.5, 0.6);
  await page.mouse.click(spot.x, spot.y);
  expect((await canvasState(page)).playerIcons).toHaveLength(1);

  await btn(page, 'Formation templates').click();
  await expect(page.getByText('Save your own formations')).toHaveCount(0);
  const popover = page.locator('div.fixed.z-40');
  await popover.getByText('Save current arrangement').click();
  await popover.getByPlaceholder('Formation name').fill('My Trips Set');
  await popover.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: 'My Trips Set' })).toBeVisible();

  // Clear the field, then stamp the just-saved custom formation back on.
  await page.keyboard.press('Escape').catch(() => {});
  await btn(page, 'Clear All').click();
  expect((await canvasState(page)).playerIcons).toHaveLength(0);

  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: 'My Trips Set' }));
  expect((await canvasState(page)).playerIcons).toHaveLength(1);
  expect((await canvasState(page)).playerIcons[0].letter).toBe('Q');

  // Delete it and confirm it's gone from the list.
  await btn(page, 'Formation templates').click();
  await page.locator('button[title="Delete this formation"]').click();
  await expect(page.getByRole('button', { name: 'My Trips Set' })).toHaveCount(0);
});

test('formation templates (B-24): stamping I-Formation places 11 icons as one undo entry', async ({ page }) => {
  await openDesigner(page);

  // New play defaults to 11v11 (PlayDesigner.tsx currentPlayMetadata), so the
  // Formation menu should offer the 11v11 templates.
  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: 'I-Formation' }));

  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(11);
  expect(state.playerIcons.map((i) => i.letter)).toContain('QB');
  // Stamped icons land within the field, not off-canvas.
  for (const icon of state.playerIcons) {
    expect(icon.x).toBeGreaterThan(0);
    expect(icon.x).toBeLessThan(1);
    expect(icon.y).toBeGreaterThan(0);
    expect(icon.y).toBeLessThan(1);
  }

  // Stamping is a single undo entry, however many icons it added.
  await btn(page, 'Undo').click();
  expect((await canvasState(page)).playerIcons).toHaveLength(0);
});

// On phones the Formation trigger lives in the bottom toolbar, so the popover
// must flip upward — opening downward puts every option below the screen
// (real click coordinates via realClick would still "work", hiding the bug).
test('formation menu opens fully on screen from the mobile bottom toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);

  await btn(page, 'Formation templates').click();
  const popover = page.locator('div.fixed.z-40');
  await expect(popover).toBeVisible();
  const box = await popover.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);

  await realClick(page, page.getByRole('button', { name: 'I-Formation' }));
  expect((await canvasState(page)).playerIcons).toHaveLength(11);
});

test('formation templates: game-format picker in the menu offers 5v5/6v6/7v7/11v11 sets', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Formation templates').click();
  // Defaults to 11v11's four templates.
  await expect(page.getByRole('button', { name: 'I-Formation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wing-T' })).toBeVisible();

  await realClick(page, page.getByRole('button', { name: '7v7', exact: true }));
  await expect(page.getByRole('button', { name: 'I-Formation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trips' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bunch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Twins' })).toBeVisible();

  await realClick(page, page.getByRole('button', { name: '6v6', exact: true }));
  await expect(page.getByRole('button', { name: 'Trips' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bunch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Twins' })).toBeVisible();

  await realClick(page, page.getByRole('button', { name: 'Trips' }));
  const sixV6State = await canvasState(page);
  // 6v6 Trips: snapper + QB + 4 receivers.
  expect(sixV6State.playerIcons).toHaveLength(6);

  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: '5v5', exact: true }));
  await expect(page.getByRole('button', { name: 'Trips' })).toBeVisible();

  await realClick(page, page.getByRole('button', { name: 'Trips' }));
  const state = await canvasState(page);
  // 5v5 Trips: snapper + QB + 3 receivers.
  expect(state.playerIcons).toHaveLength(5);
});

// The field is one universal canvas for every game format (2026-07-23,
// superseding B-29's format-aware hashes), but the format picker still
// drives formation templates — this guards that switching formats with
// content already on canvas re-renders cleanly and never disturbs it.
test('field rendering: switching game format re-renders cleanly for every format', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  await openDesigner(page);

  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: 'I-Formation' }));
  expect((await canvasState(page)).playerIcons).toHaveLength(11);

  for (const format of ['7v7', '6v6', '5v5', '11v11'] as const) {
    await btn(page, 'Formation templates').click();
    await realClick(page, page.getByRole('button', { name: format, exact: true }));
    await page.keyboard.press('Escape'); // picking a game type doesn't auto-close the popover
    // Content and canvas size are unaffected by a format switch alone.
    expect((await canvasState(page)).playerIcons).toHaveLength(11);
  }

  expect(errors, errors.map((e) => e.message).join('\n')).toHaveLength(0);
});

test('formation templates: picking a second formation replaces the first instead of layering', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: 'Shotgun' }));
  expect((await canvasState(page)).playerIcons).toHaveLength(11);

  // Draw a route off one of the Shotgun icons, so there's a path referencing
  // an icon index too — it should be gone after the re-stamp, not left
  // pointing at a different formation's icon.
  const shotgunState = await canvasState(page);
  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, shotgunState.playerIcons[0].x, shotgunState.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();
  expect((await canvasState(page)).paths).toHaveLength(1);

  await btn(page, 'Formation templates').click();
  await realClick(page, page.getByRole('button', { name: 'Wing-T' }));

  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(11);
  expect(state.playerIcons.map((i) => i.letter)).toContain('QB');
  // The old formation's route is gone, not layered under/over the new one.
  expect(state.paths).toHaveLength(0);

  // Still a single undo entry — one press returns all the way to the first
  // formation plus its route, not a partial step through the re-stamp.
  await btn(page, 'Undo').click();
  const undone = await canvasState(page);
  expect(undone.playerIcons).toHaveLength(11);
  expect(undone.paths).toHaveLength(1);
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

// B-27: special teams gets its own roster (K/P, LS, RET, COV) and the
// zone tool (coverage lanes), but not the offense-only Formation menu.
test('special teams: roster swaps, zone tool available, formation menu is not', async ({ page }) => {
  await openDesigner(page);

  await page.getByRole('button', { name: 'special teams', exact: true }).click();
  await expect(btn(page, 'Player K/P')).toBeVisible();
  await expect(btn(page, 'Player LS')).toBeVisible();
  await expect(btn(page, 'Player RET')).toBeVisible();
  await expect(btn(page, 'Player COV')).toBeVisible();
  await expect(page.locator('button[title="Formation templates"]:visible')).toHaveCount(0);

  await btn(page, 'Player COV').click();
  const spot = await canvasPoint(page, 0.3, 0.4);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  expect(state.playerIcons[0].letter).toBe('COV');

  await btn(page, 'Draw a zone of responsibility (drag from a player)').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(icon.x + 80, icon.y + 50, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  expect(state.zones).toHaveLength(1);
  expect(state.zones[0].color).toBe(state.playerIcons[0].color);

  // Play type locks once the canvas has content, same as offense/defense.
  await expect(page.getByRole('button', { name: 'offense', exact: true })).toBeDisabled();
});

test('text box: place, type, drag, edit, undo, delete', async ({ page }) => {
  await openDesigner(page);

  // Placing opens the editor immediately so the user can type without a second tap.
  await btn(page, 'Add a text box (tap the field to place it)').click();
  const spot = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(spot.x, spot.y);
  const textarea = page.getByLabel('Text box content');
  await expect(textarea).toBeVisible();
  await textarea.fill('SNAP ON 2');
  await page.getByRole('button', { name: 'Apply' }).click();

  let state = await canvasState(page);
  expect(state.textBoxes).toHaveLength(1);
  expect(state.textBoxes[0].text).toBe('SNAP ON 2');
  // Field background is white (FIELD_BG) — the default color must be legible on it.
  expect(state.textBoxes[0].color).toBe('#000000');

  // Text mode stays active across placements (like Zone mode) — switch to
  // Select before dragging.
  await btn(page, 'Select / Move').click();
  const from = await canvasPoint(page, state.textBoxes[0].x, state.textBoxes[0].y);
  const to = await canvasPoint(page, 0.6, 0.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  expect(state.textBoxes[0].x).toBeCloseTo(0.6, 1);
  expect(state.textBoxes[0].y).toBeCloseTo(0.5, 1);

  // A tap without movement re-opens the editor with the existing content.
  const moved = await canvasPoint(page, state.textBoxes[0].x, state.textBoxes[0].y);
  await page.mouse.click(moved.x, moved.y);
  await expect(textarea).toBeVisible();
  await expect(textarea).toHaveValue('SNAP ON 2');
  await textarea.fill('SNAP ON 2 GO');
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.textBoxes[0].text).toBe('SNAP ON 2 GO');

  // Every content/position change pushed its own snapshot: undo the edit,
  // then the drag, then the initial "SNAP ON 2" text, then the placement
  // itself (which started life as an empty box before any text was typed).
  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.textBoxes[0].text).toBe('SNAP ON 2');

  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.textBoxes[0].x).toBeCloseTo(0.4, 1);

  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.textBoxes[0].text).toBe('');

  await btn(page, 'Undo').click();
  state = await canvasState(page);
  expect(state.textBoxes).toHaveLength(0);
});

test('text box: Delete button removes it, Cancel on a fresh blank box discards it', async ({ page }) => {
  await openDesigner(page);

  // Delete button, on an existing (typed) box.
  await btn(page, 'Add a text box (tap the field to place it)').click();
  let spot = await canvasPoint(page, 0.3, 0.3);
  await page.mouse.click(spot.x, spot.y);
  await page.getByLabel('Text box content').fill('TO DELETE');
  await page.getByRole('button', { name: 'Apply' }).click();
  expect((await canvasState(page)).textBoxes).toHaveLength(1);

  await btn(page, 'Select / Move').click();
  await page.mouse.click(spot.x, spot.y);
  await page.getByRole('button', { name: 'Delete' }).click();
  expect((await canvasState(page)).textBoxes).toHaveLength(0);

  // Cancel on a brand-new, never-typed-in box discards it rather than
  // leaving an empty annotation.
  await btn(page, 'Add a text box (tap the field to place it)').click();
  spot = await canvasPoint(page, 0.6, 0.4);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.getByLabel('Text box content')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect((await canvasState(page)).textBoxes).toHaveLength(0);
});

test('text box: renders on top and wins hit-testing over an icon underneath it', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.5, 0.6);
  await page.mouse.click(spot.x, spot.y);
  expect((await canvasState(page)).playerIcons).toHaveLength(1);

  await btn(page, 'Add a text box (tap the field to place it)').click();
  await page.mouse.click(spot.x, spot.y);
  await page.getByLabel('Text box content').fill('QB');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Same coordinates as the icon — Select-mode tap must hit the text box
  // (rendered on top) rather than the icon underneath it.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(spot.x, spot.y);
  await expect(page.getByLabel('Text box content')).toBeVisible();
  await expect(page.getByLabel('Player label')).not.toBeVisible();
});

test('snap: centerline + yard grid on placement, row alignment, magnet toggles off', async ({ page }) => {
  await openDesigner(page);

  // Q placed slightly off-center snaps to the field centerline (x = 0.5)
  // and its y quantizes to the 1-yard grid (field is 30 yards tall).
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.505, 0.652);
  await page.mouse.click(spot.x, spot.y);

  let state = await canvasState(page);
  expect(state.playerIcons[0].x).toBe(0.5);
  const yards = state.playerIcons[0].y * 30;
  expect(Math.abs(yards - Math.round(yards))).toBeLessThan(1e-9);

  // A placed a few px off Q's row snaps to exactly Q's y — icon row
  // alignment wins over the yard grid.
  const qY = state.playerIcons[0].y;
  await btn(page, 'Player A').click();
  const spot2 = await canvasPoint(page, 0.3, qY);
  await page.mouse.click(spot2.x, spot2.y + 5);

  state = await canvasState(page);
  expect(state.playerIcons[1].y).toBe(qY);

  // Magnet off: a placement near the centerline stays freeform.
  await btn(page, 'Snap to alignment').click();
  await btn(page, 'Player B').click();
  const spot3 = await canvasPoint(page, 0.505, 0.3);
  await page.mouse.click(spot3.x, spot3.y);

  state = await canvasState(page);
  expect(state.playerIcons[2].x).not.toBe(0.5);
});

test('distribute: dragging between two row-mates snaps to the equidistant point (B-17)', async ({ page }) => {
  await openDesigner(page);

  // Two anchors on one row. The second click sits a few px off the first's
  // row so row alignment proves the y matches exactly. Anchors avoid
  // straddling x=0.5 symmetrically so the midpoint isn't also the
  // centerline (which plain alignment would already snap to).
  await btn(page, 'Player Q').click();
  const a1 = await canvasPoint(page, 0.2, 0.6);
  await page.mouse.click(a1.x, a1.y);

  let state = await canvasState(page);
  const rowY = state.playerIcons[0].y;

  await btn(page, 'Player A').click();
  const a2 = await canvasPoint(page, 0.56, rowY);
  await page.mouse.click(a2.x, a2.y + 4);

  state = await canvasState(page);
  expect(state.playerIcons[1].y).toBe(rowY);
  const mid = (state.playerIcons[0].x + state.playerIcons[1].x) / 2;

  // Third icon placed away from the row, then dragged to a spot a few px
  // off the midpoint — it should land exactly equidistant on the row.
  await btn(page, 'Player B').click();
  const spot = await canvasPoint(page, 0.4, 0.3);
  await page.mouse.click(spot.x, spot.y);

  state = await canvasState(page);
  const from = await canvasPoint(page, state.playerIcons[2].x, state.playerIcons[2].y);
  const target = await canvasPoint(page, mid, rowY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 5, target.y + 3, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  expect(state.playerIcons[2].y).toBe(rowY);
  expect(state.playerIcons[2].x).toBeCloseTo(mid, 10);
  // Equal gaps either side
  const [q, a, b] = state.playerIcons;
  expect(b.x - q.x).toBeCloseTo(a.x - b.x, 10);
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
  // Effective shape, not the raw field: toolbar chips now carry an explicit
  // shape, where before they left it undefined for iconShape() to default.
  // Either way the icon renders as a circle, which is what this asserts.
  expect(state.playerIcons[0].shape ?? 'circle').toBe('circle');
  expect(state.paths[0].color).toBe(originalColor);
});

test('tap-to-customize survives sub-pixel pointer jitter, real drags still move the icon', async ({ page }) => {
  // Regression test: real mice/trackpads/touchscreens commonly fire at least
  // one pointermove event during what a user experiences as a stationary
  // tap. handlePointerDown/Move/Up in Canvas.tsx used to flag *any* move
  // during a press as a drag (no distance threshold), so that jitter alone
  // was enough to permanently block the tap-to-customize popover from
  // opening on real hardware, even though synthetic test clicks (which never
  // emit an intermediate pointermove) never triggered it.
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);

  let state = await canvasState(page);
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  // A "tap" with 1px of jitter between pointerdown and pointerup must still
  // open the popover (DRAG_THRESHOLD_PX in Canvas.tsx is 4).
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(icon.x + 1, icon.y + 1);
  await page.mouse.up();

  const labelInput = page.getByLabel('Player label');
  await expect(labelInput).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(labelInput).not.toBeVisible();

  // A real drag (past the threshold) must still move the icon and must NOT
  // open the popover.
  const target = await canvasPoint(page, 0.6, 0.4);
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();

  await expect(labelInput).not.toBeVisible();
  state = await canvasState(page);
  expect(state.playerIcons[0].x).toBeCloseTo(0.6, 1);
  expect(state.playerIcons[0].y).toBeCloseTo(0.4, 1);
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

test('SavePlayModal (B-22): free user one play from the cap sees an early usage nudge', async ({ page }) => {
  // The nudge (14 of 15 plays used) must appear before the PBP01 wall above,
  // and only for a new play — not when editing an existing one in place.
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
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }),
  );
  await page.route('**/rest/v1/plays**', (route) => {
    if (route.request().method() !== 'HEAD') return route.continue();
    return route.fulfill({
      status: 200,
      headers: { 'content-range': '*/14', 'access-control-expose-headers': 'content-range' },
      body: '',
    });
  });

  await openDesigner(page);
  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.65);
  await page.mouse.click(spot.x, spot.y);

  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByText('14 of 15 free plays used.')).toBeVisible();
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
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'founding' }) }),
  );
  // Usage counts (B-13) arrive as HEAD requests; supabase-js reads the count
  // from the Content-Range header.
  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-range': '*/23', 'access-control-expose-headers': 'content-range' }, body: '' }),
  );
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-range': '*/4', 'access-control-expose-headers': 'content-range' }, body: '' }),
  );

  await page.goto('/account');

  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  await expect(page.getByText('Member Since')).toBeVisible();
  // The username section is where the crash happened (icon next to the input)
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.getByText('Delete Account').first()).toBeVisible();
  // B-4: Founding Member badge (grandfathered subscriptions row) — in the
  // page header and again in the B-13 Plan & Usage card.
  await expect(page.getByText('Founding Member').first()).toBeVisible();
  // B-13: founding user sees the unlimited summary and NO upgrade CTA
  await expect(page.getByText('Plan & Usage')).toBeVisible();
  await expect(page.getByText('unlimited on your plan')).toBeVisible();
  await expect(page.getByRole('button', { name: /Upgrade to Pro/ })).toHaveCount(0);
  // Icon-picker avatar option was removed — custom photo upload only.
  await expect(page.getByRole('button', { name: 'Choose Icon' })).toHaveCount(0);
  await expect(page.getByText('Upload Photo')).toBeVisible();
  expect(errors, errors.map((e) => e.message).join('\n')).toHaveLength(0);
});

test('account settings: free-plan user sees no Founding Member badge', async ({ page }) => {
  const userJson = {
    id: '22222222-2222-2222-2222-222222222222',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'freeuser@example.com',
    app_metadata: {},
    user_metadata: { username: 'freeuser' },
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
  // No subscriptions row for this user (free plan) -- PostgREST returns 200 + null for maybeSingle().
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-range': '*/9', 'access-control-expose-headers': 'content-range' }, body: '' }),
  );
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-range': '*/1', 'access-control-expose-headers': 'content-range' }, body: '' }),
  );

  await page.goto('/account');

  await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
  await expect(page.getByText('Founding Member')).toHaveCount(0);
  // B-13: free user sees live usage meters + the upgrade CTA
  await expect(page.getByText('Free plan')).toBeVisible();
  await expect(page.getByText('9 of 15')).toBeVisible();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /Upgrade to Pro/ })).toBeVisible();
});

test('loads a saved defensive play via /designer?play= (mocked backend)', async ({ page }) => {
  // Covers the client half of the save→reload seam without needing an
  // authenticated Supabase session: version-3 canvas_data with icons, a
  // route, and a zone must all land back on the canvas. No textBoxes key at
  // all (pre-dates the feature) — the loader must fall back to [] rather
  // than throwing.
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
  expect(state.textBoxes).toEqual([]);

  // Editing mode + defense roster active
  await expect(page.getByText('(editing)')).toBeVisible();
  await expect(btn(page, 'Player S')).toBeVisible();
  await expect(page.getByRole('button', { name: 'defense', exact: true })).toBeDisabled();
});

test('"Use as Template" (/designer?template=): loads the source play, prefixes the name, and Save does an INSERT not an UPDATE', async ({ page }) => {
  const userJson = {
    id: '55555555-5555-5555-5555-555555555555',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

  // Source play belongs to a DIFFERENT user and is public — the scenario
  // this feature exists for (a community play used as a template). Loading
  // it must still succeed (RLS already permits reading public plays), and
  // saving afterward must never attempt to touch this row.
  const sourcePlayId = '00000000-0000-0000-0000-0000000000aa';
  const canvasData = JSON.stringify({
    version: 4,
    paths: [],
    playerIcons: [{ x: 0.5, y: 0.6, letter: 'QB', color: '#3B82F6' }],
    zones: [],
  });

  const methodsSeen: string[] = [];
  await page.route('**/rest/v1/plays**', (route) => {
    const method = route.request().method();
    methodsSeen.push(method);
    if (method === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: sourcePlayId,
          name: 'Mesh',
          type: 'offense',
          canvas_data: canvasData,
          description: '',
          is_public: true,
          user_id: '99999999-9999-9999-9999-999999999999', // not this test's user
          metadata: { playName: 'Mesh' },
        }),
      });
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: '00000000-0000-0000-0000-0000000000bb' }),
      });
    }
    // A PATCH here would mean the client tried to update the source play —
    // exactly what this feature must never do.
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'unexpected write' }) });
  });

  await page.goto(`/designer?template=${sourcePlayId}`);
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  // Template mode: never shows "(editing)", header button reads "Save".
  await expect(page.getByText('(editing)')).toHaveCount(0);
  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByPlaceholder('Enter play name...')).toHaveValue('Copy of Mesh');

  await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
  await page.getByRole('button', { name: 'Save Play' }).click();
  await expect(page.getByText('Play saved!')).toBeVisible();

  expect(methodsSeen).toContain('GET');
  expect(methodsSeen).toContain('POST');
  expect(methodsSeen).not.toContain('PATCH');
});

// A coach opening an existing play from the Plays page, updating it, and
// saving expects to land back on the Plays page — not be left staring at the
// designer wondering whether the save landed. The Plays page marks its edit
// links with ?from=plays so the designer knows to return there afterward.
test('editing a play opened from the Plays page (?from=plays) returns there after Update', async ({ page }) => {
  const userJson = {
    id: '66666666-6666-6666-6666-666666666666',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }));
  await page.route('**/rest/v1/play_votes**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  const playId = '00000000-0000-0000-0000-0000000000cc';
  const canvasData = JSON.stringify({
    version: 4,
    paths: [],
    playerIcons: [{ x: 0.5, y: 0.6, letter: 'QB', color: '#3B82F6' }],
    zones: [],
  });

  const methodsSeen: string[] = [];
  await page.route('**/rest/v1/plays**', (route) => {
    const req = route.request();
    const method = req.method();
    methodsSeen.push(method);
    if (method === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (req.url().includes(`id=eq.${playId}`)) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: playId, name: 'Mesh', type: 'offense', canvas_data: canvasData,
          description: '', is_public: false, user_id: userJson.id,
          metadata: { playName: 'Mesh' },
        }),
      });
    }
    // The Plays page's own list fetch after the redirect.
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto(`/designer?play=${playId}&from=plays`);
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });
  await expect(page.getByText('(editing)')).toBeVisible();

  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByPlaceholder('Enter play name...')).toHaveValue('Mesh');
  await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
  await page.getByRole('button', { name: 'Save Play' }).click();

  await expect(page).toHaveURL(/\/plays$/);
  expect(methodsSeen).toContain('PATCH');
});

// The redirect is scoped to the Plays page specifically (via ?from=plays) —
// editing a play from anywhere else (Playbooks' "Edit Play", or a bare
// /designer?play= link) must keep the coach on the designer after Update,
// unchanged from prior behavior.
test('editing a play without ?from=plays stays on the designer after Update', async ({ page }) => {
  const userJson = {
    id: '77777777-7777-7777-7777-777777777777',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));

  const playId = '00000000-0000-0000-0000-0000000000dd';
  const canvasData = JSON.stringify({
    version: 4,
    paths: [],
    playerIcons: [{ x: 0.5, y: 0.6, letter: 'QB', color: '#3B82F6' }],
    zones: [],
  });

  await page.route('**/rest/v1/plays**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: playId, name: 'Mesh', type: 'offense', canvas_data: canvasData,
        description: '', is_public: false, user_id: userJson.id,
        metadata: { playName: 'Mesh' },
      }),
    });
  });

  await page.goto(`/designer?play=${playId}`);
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByPlaceholder('Enter play name...')).toHaveValue('Mesh');
  await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
  await page.getByRole('button', { name: 'Save Play' }).click();

  await expect(page.getByText('Play updated!')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/designer\\?play=${playId}$`));
});

test('loads a saved play with a legacy mode:"block" path (pre-dates capStyle) without choking', async ({ page }) => {
  // Regression guard: 'block' used to be a whole draw mode; it's now just
  // the fallback capStyle for paths saved before capStyle existed (see
  // renderScene's useBlockCap). Old saved JSON with mode: 'block' and no
  // capStyle/dashed fields must still load cleanly.
  const canvasData = JSON.stringify({
    version: 3,
    paths: [
      { points: [{ x: 0.5, y: 0.6 }, { x: 0.5, y: 0.35 }], color: '#14B8A6', startIconIndex: 0, mode: 'block' },
    ],
    playerIcons: [
      { x: 0.5, y: 0.6, letter: 'C', color: '#14B8A6' },
    ],
    zones: [],
  });

  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Legacy block route',
        type: 'offense',
        canvas_data: canvasData,
        description: '',
        is_public: false,
        metadata: { playName: 'Legacy block route' },
      }),
    }),
  );

  await page.goto('/designer?play=00000000-0000-0000-0000-000000000002');
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  const state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].mode).toBe('block');
  expect(state.paths[0].capStyle).toBeUndefined();
});

test('loads a saved play with text boxes via /designer?play= (mocked backend, version 4)', async ({ page }) => {
  const canvasData = JSON.stringify({
    version: 4,
    paths: [],
    playerIcons: [{ x: 0.45, y: 0.7, letter: 'S', color: '#E11D48' }],
    zones: [],
    textBoxes: [{ x: 0.5, y: 0.2, text: 'COVER 2', color: '#000000', fontSize: 28 }],
  });

  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Cover 2 Text',
        type: 'defense',
        canvas_data: canvasData,
        description: '',
        is_public: false,
        metadata: { playName: 'Cover 2 Text' },
      }),
    }),
  );

  await page.goto('/designer?play=00000000-0000-0000-0000-000000000004');
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  const state = await canvasState(page);
  expect(state.textBoxes).toHaveLength(1);
  expect(state.textBoxes[0].text).toBe('COVER 2');
  expect(state.textBoxes[0].fontSize).toBe(28);
});

// B-27 regression: the load path used to collapse any non-'defense' saved
// type to 'offense', so a reopened special-teams play silently lost its
// roster/zone tools and showed the wrong play-type pill selected.
test('loads a saved special-teams play via /designer?play= (mocked backend)', async ({ page }) => {
  const canvasData = JSON.stringify({
    version: 3,
    paths: [],
    playerIcons: [{ x: 0.3, y: 0.4, letter: 'COV', color: '#EAB308' }],
    zones: [{ iconIndex: 0, cx: 0.3, cy: 0.4, rx: 0.1, ry: 0.08, color: '#EAB308' }],
  });

  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Punt Coverage',
        type: 'special_teams',
        canvas_data: canvasData,
        description: '',
        is_public: false,
        metadata: { playName: 'Punt Coverage' },
      }),
    }),
  );

  await page.goto('/designer?play=00000000-0000-0000-0000-000000000002');
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  const state = await canvasState(page);
  expect(state.playerIcons[0].letter).toBe('COV');
  expect(state.zones).toHaveLength(1);

  // Special-teams roster active + pill shows special teams as selected/locked
  await expect(btn(page, 'Player K/P')).toBeVisible();
  await expect(page.getByRole('button', { name: 'special teams', exact: true })).toBeDisabled();
});

// Regression: opening an existing play and hitting Update used to reset
// Play Name to blank and Game Type/Play Type/Difficulty/visibility to
// generic defaults, because SavePlayModal never read the play's own saved
// values — only account preferences (or hardcoded fallbacks) for new
// plays. Found while seeding the B-31 starter library: a blind Update
// silently corrupted metadata on every save. This asserts the modal shows
// the play's real values without the user typing anything.
test('editing an existing play prefills Save with its real values, not blanks or defaults', async ({ page }) => {
  const userJson = {
    id: '33333333-3333-3333-3333-333333333333',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'coach@example.com',
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
  // Account has no saved preferences row — getUserPreferences() falls back
  // to its hardcoded defaults (5v5/pass/private). If the modal ever prefers
  // these over the play's own values, this test catches it.
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }),
  );

  const canvasData = JSON.stringify({
    version: 3,
    paths: [],
    playerIcons: [{ x: 0.5, y: 0.6, letter: 'QB', color: '#3B82F6' }],
    zones: [],
  });
  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Four Verts',
        type: 'offense',
        canvas_data: canvasData,
        description: 'Four receivers push vertically to stretch the defense deep.',
        is_public: true,
        metadata: {
          playName: 'Four Verts', gameType: '11v11', playType: 'pass',
          formation: 'Spread', difficulty: 'intermediate', tags: ['four verts'],
          description: 'Four receivers push vertically to stretch the defense deep.',
        },
      }),
    }),
  );

  await page.goto('/designer?play=00000000-0000-0000-0000-000000000003');
  await page.waitForFunction(() => {
    const bridge = (window as unknown as { __PBP_TEST__?: { getCanvasState: () => { playerIcons: unknown[] } } }).__PBP_TEST__;
    return bridge ? bridge.getCanvasState().playerIcons.length === 1 : false;
  });

  await page.locator('button[title="Save play"]:visible').click();
  await expect(page.getByPlaceholder('Enter play name...')).toHaveValue('Four Verts');
  await expect(page.locator('select').nth(0)).toHaveValue('11v11');
  await expect(page.locator('select').nth(1)).toHaveValue('pass');
  await expect(page.locator('select').nth(2)).toHaveValue('intermediate');
  await expect(page.getByPlaceholder('e.g., I-Formation, Spread, etc.')).toHaveValue('Spread');
  await expect(page.locator('#isPublic')).toBeChecked();
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

test('Community Play Library: type/game-format/formation filters compose correctly', async ({ page }) => {
  const publicPlays = [
    { id: 'p1', name: 'Four Verts', description: '', type: 'offense', thumbnail: null, upvotes: 3,
      metadata: { gameType: '11v11', formation: 'Spread' }, user_id: 'u1' },
    { id: 'p2', name: 'Mesh', description: '', type: 'offense', thumbnail: null, upvotes: 1,
      metadata: { gameType: '7v7', formation: 'Twins' }, user_id: 'u1' },
    { id: 'p3', name: 'Cover 2 Zone', description: '', type: 'defense', thumbnail: null, upvotes: 2,
      metadata: { gameType: '11v11', formation: '4-3 Cover 2' }, user_id: 'u2' },
    { id: 'p4', name: '5v5 Blitz', description: '', type: 'defense', thumbnail: null, upvotes: 0,
      metadata: { gameType: '5v5', formation: 'Blitz' }, user_id: 'u2' },
    { id: 'p5', name: 'Punt Coverage', description: '', type: 'special_teams', thumbnail: null, upvotes: 0,
      metadata: { gameType: '11v11', formation: 'Punt' }, user_id: 'u2' },
  ];

  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPlays) }),
  );
  await page.route('**/rest/v1/rpc/get_community_authors**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/plays?tab=community');
  const cards = page.locator('.grid > div.bg-board-light');
  await expect(cards).toHaveCount(5);

  // Type filter alone
  await page.getByRole('button', { name: 'defense', exact: true }).click();
  await expect(cards).toHaveCount(2);

  // Compose with game format — only p3 is defense + 11v11
  await page.getByRole('button', { name: '11v11', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Cover 2 Zone')).toBeVisible();

  // Formation dropdown only offers values actually present in the data
  const formationOptions = await page.locator('select').first().locator('option').allTextContents();
  expect(formationOptions).toEqual(
    expect.arrayContaining(['All formations', 'Spread', 'Twins', '4-3 Cover 2', 'Blitz', 'Punt']),
  );

  // Clear filters via the empty-state button after narrowing to zero results
  await page.locator('select').first().selectOption('Spread'); // combined with defense+11v11 => 0 results
  await expect(cards).toHaveCount(0);
  await expect(page.getByText('No plays match those filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards).toHaveCount(5);
});

test('Community Play Library: "Use as Template" navigates to /designer?template=<id> (signed in) or /auth (signed out)', async ({ page }) => {
  const publicPlays = [
    { id: 'p1', name: 'Four Verts', description: '', type: 'offense', thumbnail: null, upvotes: 3,
      metadata: { gameType: '11v11', formation: 'Spread' }, user_id: 'u1' },
  ];
  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPlays) }),
  );
  await page.route('**/rest/v1/rpc/get_community_authors**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  // Signed out: clicking "Use as Template" redirects to sign-in, same gate
  // as the existing "Copy to My Plays" button, instead of opening the
  // Designer only to fail on Save.
  await page.goto('/plays?tab=community');
  await page.locator('button[title="Sign in to use this play as a template"]').click();
  await expect(page).toHaveURL(/\/auth/);

  // Signed in: navigates straight to the template load.
  const userJson = {
    id: '66666666-6666-6666-6666-666666666666',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));

  await page.goto('/plays?tab=community');
  await page.locator('button[title="Open in the Designer to edit and save as a new play"]').click();
  await expect(page).toHaveURL(/\/designer\?template=p1/);
});

test('PlaysPage (B-22): free user one play from the cap sees a usage nudge', async ({ page }) => {
  const userJson = {
    id: '33333333-3333-3333-3333-333333333333',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'coach@example.com',
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
  await page.route('**/rest/v1/admin_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }),
  );
  await page.route('**/rest/v1/plays**', (route) => {
    if (route.request().method() === 'HEAD') {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': '*/14', 'access-control-expose-headers': 'content-range' },
        body: '',
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/plays');
  await expect(page.getByText('14 of 15 free plays used.')).toBeVisible();
});

test('My Plays: card shows a "Use as Template" link to /designer?template=<id>', async ({ page }) => {
  const userJson = {
    id: '77777777-7777-7777-7777-777777777777',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/admin_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }));
  await page.route('**/rest/v1/plays**', (route) => {
    if (route.request().method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { 'content-range': '*/1', 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'my-play-1', name: 'Trips Right', type: 'offense', thumbnail: null, is_public: false, upvotes: 0 }]),
    });
  });

  await page.goto('/plays');
  await expect(page.locator('a[href="/designer?template=my-play-1"]')).toBeVisible();
});

test('My Plays: a non-admin owner can delete their own play', async ({ page }) => {
  // Regression test: "Delete Play" used to be gated on isAdmin instead of
  // ownership, so a regular coach had no way to delete a play they made —
  // even though the DB's RLS policy ("Users can manage their own plays")
  // already permitted it. This page's query is always scoped to the
  // signed-in user's own plays (see fetchPlays' .eq('user_id', ...)), so
  // ownership needs no separate check — the button just needs to render.
  const userJson = {
    id: '88888888-8888-8888-8888-888888888888',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  // Explicitly non-admin.
  await page.route('**/rest/v1/admin_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }));

  let deleteRequestUrl: string | null = null;
  await page.route('**/rest/v1/plays**', (route) => {
    const req = route.request();
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { 'content-range': '*/1', 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    if (req.method() === 'DELETE') {
      deleteRequestUrl = req.url();
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'my-play-1', name: 'Trips Right', type: 'offense', thumbnail: null, is_public: false, upvotes: 0, user_id: userJson.id }]),
    });
  });

  await page.goto('/plays');
  const deleteButton = page.getByTitle('Delete Play');
  await expect(deleteButton).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await deleteButton.click();

  await expect.poll(() => deleteRequestUrl).not.toBeNull();
  expect(deleteRequestUrl).toContain('id=eq.my-play-1');
});

test('PlaybooksPage (B-22/B-23): free user one playbook from the cap sees a usage nudge', async ({ page }) => {
  // Regression test for B-23: PlaybooksPage used to resolve its user via
  // getSession() + onAuthStateChange *and* a separate useEntitlement() call
  // (its own getUser() + onAuthStateChange) — two concurrent gotrue-js auth
  // calls that could deadlock gotrue's internal session lock, hanging the
  // page on "Loading playbooks..." forever. Both call sites now resolve the
  // user once via a single getUser() call.
  const userJson = {
    id: '44444444-4444-4444-4444-444444444444',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'coach@example.com',
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
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }),
  );
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'pb-1', name: 'Home Playbook', description: '', created_at: '2025-09-01T00:00:00Z', user_id: userJson.id, playbook_plays: [] },
      ]),
    }),
  );

  await page.goto('/playbooks');
  await expect(page.getByText('1 of 2 free playbooks used.')).toBeVisible();
});

test('PlaybooksPage: play count reflects the actual number of plays, not always 1', async ({ page }) => {
  // Regression test: `playbook_plays(count)` is PostgREST's aggregate-embed
  // syntax — it always returns a ONE-element array wrapping the aggregate
  // object (e.g. [{ count: 7 }]), never one element per play. Reading
  // `.length` off that array was therefore always 1 for any playbook with at
  // least one play, no matter how many it actually had. The fixture below
  // uses the REAL shape — [{ count: N }] — unlike the usage-nudge test above,
  // whose `playbook_plays: []` fixture happens to read as 0 under the old
  // buggy code too, which is exactly how this slipped through unnoticed.
  const userJson = {
    id: '55555555-5555-5555-5555-555555555555',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) }));
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'pb-1', name: 'Game Plan', description: '', created_at: '2025-09-01T00:00:00Z', user_id: userJson.id, playbook_plays: [{ count: 7 }] },
        { id: 'pb-2', name: 'Empty Playbook', description: '', created_at: '2025-09-02T00:00:00Z', user_id: userJson.id, playbook_plays: [{ count: 0 }] },
      ]),
    }),
  );

  await page.goto('/playbooks');
  await expect(page.getByText('7 plays')).toBeVisible();
  await expect(page.getByText('0 plays')).toBeVisible();
  await expect(page.getByText('1 plays')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * PlaybooksPage — drag-to-reorder plays within a playbook (List view).
 * ──────────────────────────────────────────────────────────────────────────── */

type PlayFixture = { id: string; name: string; order_position: number };

function playbookPlaysRow({ id, name, order_position }: PlayFixture) {
  return {
    order_position,
    plays: {
      id,
      name,
      description: '',
      thumbnail: '',
      created_at: '2025-09-01T00:00:00Z',
      type: 'offense',
      metadata: {},
    },
  };
}

type PatchCall = { playId: string; position: number };

/** Signs in, stubs the playbooks list (one playbook) and its plays, and
 * records every playbook_plays PATCH (the reorder mutation) into `patchCalls`.
 * `shouldFailPatch(attempt)`, if given, is checked against each PATCH's
 * 1-indexed attempt number across the whole test; a `true` fails that PATCH
 * with a 500 instead of succeeding (and it's not recorded into `patchCalls`).
 * Deliberately does NOT layer a second `page.route` on top of this one to
 * inject the failure: `route.continue()` sends the request straight to the
 * live network rather than falling through to an earlier-registered handler
 * for the same pattern, so a second route here would silently bypass this
 * mock instead of chaining with it. */
async function mockPlaybookWithPlays(
  page: Page,
  plays: PlayFixture[],
  shouldFailPatch?: (attempt: number) => boolean
): Promise<PatchCall[]> {
  const userJson = {
    id: '66666666-6666-6666-6666-666666666666',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free' }) }));
  await page.route('**/rest/v1/user_preferences**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/playbooks**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'pb-1', name: 'Game Plan', description: '', created_at: '2025-09-01T00:00:00Z', user_id: userJson.id, playbook_plays: [{ count: plays.length }] },
      ]),
    }));

  const patchCalls: PatchCall[] = [];
  let patchAttempt = 0;
  await page.route('**/rest/v1/playbook_plays**', (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(plays.map(playbookPlaysRow)),
      });
    }
    if (req.method() === 'PATCH') {
      patchAttempt++;
      if (shouldFailPatch?.(patchAttempt)) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
      }
      const url = new URL(req.url());
      const playId = (url.searchParams.get('play_id') ?? '').replace(/^eq\./, '');
      const body = req.postDataJSON() as { order_position: number };
      patchCalls.push({ playId, position: body.order_position });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.continue();
  });

  await page.goto('/playbooks');
  await page.getByText('Game Plan').click();
  return patchCalls;
}

/** Drags a row (via its grip handle) onto another row's position. */
async function dragPlayRow(page: Page, fromPlayName: string, ontoPlayName: string) {
  const fromHandle = page.getByLabel(`Drag to reorder ${fromPlayName}`);
  const toRow = page.getByText(ontoPlayName, { exact: true });
  const fromBox = await fromHandle.boundingBox();
  const toBox = await toRow.boundingBox();
  if (!fromBox || !toBox) throw new Error('row not found');

  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Small initial move to clear PointerSensor's activation distance, then
  // step toward the target so dnd-kit's collision detection tracks it.
  await page.mouse.move(startX, startY + 10, { steps: 5 });
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

const rowNames = (page: Page) => page.locator('h3.truncate').allTextContents();

test('PlaybooksPage: Grid view is the default and unaffected by the List view feature', async ({ page }) => {
  await mockPlaybookWithPlays(page, [
    { id: 'play-a', name: 'Play A', order_position: 10 },
    { id: 'play-b', name: 'Play B', order_position: 20 },
  ]);

  await expect(page.getByText('Play A')).toBeVisible();
  await expect(page.getByText('Play B')).toBeVisible();
  await expect(page.getByLabel(/Drag to reorder/)).toHaveCount(0);
  await expect(page.locator('button[title="Grid view"]')).toHaveAttribute('aria-pressed', 'true');
});

test('PlaybooksPage: dragging a play in List view reorders it and writes a two-phase PATCH', async ({ page }) => {
  const patchCalls = await mockPlaybookWithPlays(page, [
    { id: 'play-a', name: 'Play A', order_position: 10 },
    { id: 'play-b', name: 'Play B', order_position: 20 },
    { id: 'play-c', name: 'Play C', order_position: 30 },
    { id: 'play-d', name: 'Play D', order_position: 40 },
  ]);

  await page.locator('button[title="List view — drag to reorder"]').click();
  await expect(rowNames(page)).resolves.toEqual(['Play A', 'Play B', 'Play C', 'Play D']);

  await dragPlayRow(page, 'Play A', 'Play B');

  // Optimistic update: the visible order flips immediately.
  await expect(rowNames(page)).resolves.toEqual(['Play B', 'Play A', 'Play C', 'Play D']);

  await expect.poll(() => patchCalls.length).toBe(4);
  // Phase A: both affected rows bumped to temporary negative positions first.
  // order_position is a Postgres `integer` (32-bit) — a temp value generated
  // from Date.now() (epoch milliseconds, ~1.8e12 today) overflows it and
  // fails with 22003 before any write succeeds. Must stay within int32.
  expect(patchCalls[0].position).toBeLessThan(0);
  expect(patchCalls[0].position).toBeGreaterThanOrEqual(-2147483648);
  expect(patchCalls[1].position).toBeLessThan(0);
  expect(patchCalls[1].position).toBeGreaterThanOrEqual(-2147483648);
  // Phase B: final real positions — a straight swap of A and B's original values.
  expect(patchCalls[2]).toEqual({ playId: 'play-b', position: 10 });
  expect(patchCalls[3]).toEqual({ playId: 'play-a', position: 20 });
  // Untouched rows never appear in any reorder write.
  expect(patchCalls.some((c) => c.playId === 'play-c' || c.playId === 'play-d')).toBe(false);
});

test('PlaybooksPage: a failed reorder write rolls the visible order back', async ({ page }) => {
  // Every PATCH fails, including the compensating revert's own writes — the
  // screen must still recover to the pre-drag order from client state alone.
  await mockPlaybookWithPlays(
    page,
    [
      { id: 'play-a', name: 'Play A', order_position: 10 },
      { id: 'play-b', name: 'Play B', order_position: 20 },
    ],
    () => true
  );

  page.once('dialog', (d) => d.accept());
  await page.locator('button[title="List view — drag to reorder"]').click();
  await dragPlayRow(page, 'Play A', 'Play B');

  await expect.poll(() => rowNames(page)).toEqual(['Play A', 'Play B']);
});

test('PlaybooksPage: a failed reorder reverts the DATABASE, not just the screen', async ({ page }) => {
  // Regression test: a reorder that fails partway used to only roll back the
  // on-screen order — the temp-negative writes already committed by phase A
  // were never undone. That stranded a row on a negative order_position
  // forever, so every later reorder in that playbook collided with it and
  // failed immediately (23505 on playbook_plays_playbook_id_order_position_key).
  //
  // Fail only the 3rd PATCH attempt — phase A (2 calls) succeeds, then the
  // first phase B write fails, forcing the compensating revert to run.
  const patchCalls = await mockPlaybookWithPlays(
    page,
    [
      { id: 'play-a', name: 'Play A', order_position: 10 },
      { id: 'play-b', name: 'Play B', order_position: 20 },
    ],
    (attempt) => attempt === 3
  );

  page.once('dialog', (d) => d.accept());
  await page.locator('button[title="List view — drag to reorder"]').click();
  await dragPlayRow(page, 'Play A', 'Play B');
  await expect.poll(() => rowNames(page)).toEqual(['Play A', 'Play B']);

  // 2 (phase A) + 2 (revert phase A) + 2 (revert phase B) = 6 successful
  // writes recorded; the failed 3rd attempt isn't among them.
  await expect.poll(() => patchCalls.length).toBe(6);
  expect(patchCalls[0].position).toBeLessThan(0); // original phase A
  expect(patchCalls[1].position).toBeLessThan(0);
  expect(patchCalls[2].position).toBeLessThan(0); // revert's own phase A
  expect(patchCalls[3].position).toBeLessThan(0);
  // The revert's final phase must write each row back to its OWN original
  // position — not leave anything on a temporary negative value.
  expect(patchCalls[4]).toEqual({ playId: 'play-b', position: 20 });
  expect(patchCalls[5]).toEqual({ playId: 'play-a', position: 10 });
});

test('PlaybooksPage: a second reorder after a successful first one does not collide', async ({ page }) => {
  // Regression test: arrayMove repositions the play objects in state but
  // never updated each one's own order_position field — it stayed frozen at
  // its pre-drag value forever. The next reorder computed its target
  // positions off that stale data, which no longer matched the database
  // (the first reorder had already changed it), and could try to write a
  // value some other row already held — 23505 on every reorder after the
  // first one, exactly as reported.
  const patchCalls = await mockPlaybookWithPlays(page, [
    { id: 'play-a', name: 'Play A', order_position: 10 },
    { id: 'play-b', name: 'Play B', order_position: 20 },
    { id: 'play-c', name: 'Play C', order_position: 30 },
  ]);

  let dialogSeen = false;
  page.on('dialog', (d) => { dialogSeen = true; d.accept(); });

  await page.locator('button[title="List view — drag to reorder"]').click();
  await expect(rowNames(page)).resolves.toEqual(['Play A', 'Play B', 'Play C']);

  // First reorder: rotate A from the front to the back.
  await dragPlayRow(page, 'Play A', 'Play C');
  await expect(rowNames(page)).resolves.toEqual(['Play B', 'Play C', 'Play A']);
  await expect.poll(() => patchCalls.length).toBe(6); // 3 temp + 3 final
  expect(patchCalls.slice(3, 6)).toEqual([
    { playId: 'play-b', position: 10 },
    { playId: 'play-c', position: 20 },
    { playId: 'play-a', position: 30 },
  ]);

  // Second reorder: drag A (now last) back to the front — undoes the rotation.
  await dragPlayRow(page, 'Play A', 'Play B');
  await expect.poll(() => rowNames(page)).toEqual(['Play A', 'Play B', 'Play C']);

  expect(dialogSeen).toBe(false); // no "Failed to reorder plays" alert
  await expect.poll(() => patchCalls.length).toBe(12); // + 3 temp + 3 final
  // The second operation's final writes must reflect what the first one
  // actually left in the database (B=10, C=20, A=30) — not each play's
  // stale pre-drag field (which would instead try B=20, C=30, A=10, and
  // collide with whichever row already holds that value).
  expect(patchCalls.slice(9, 12)).toEqual([
    { playId: 'play-a', position: 10 },
    { playId: 'play-b', position: 20 },
    { playId: 'play-c', position: 30 },
  ]);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Admin Dashboard — entitlement management.
 *
 * These are the first tests to touch /admin. The route has no client-side
 * guard by design: gating is server-side (every RPC raises for non-admins), so
 * these stub the RPCs directly rather than trying to simulate real admin auth.
 * ──────────────────────────────────────────────────────────────────────────── */

const ADMIN_USER = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  aud: 'authenticated', role: 'authenticated', email: 'admin@example.com',
  app_metadata: {}, user_metadata: { username: 'TheAdmin' }, created_at: '2025-01-01T00:00:00Z',
};

/** Signs in as an admin and stubs admin_list_users() with the given rows. */
async function mockAdmin(page: Page, rows: Record<string, unknown>[]) {
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem('pbp-analytics-consent', 'denied');
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: ADMIN_USER, storageKey: AUTH_STORAGE_KEY });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ADMIN_USER) }));
  await page.route('**/rest/v1/admin_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: ADMIN_USER.id }) }));
  await page.route('**/rest/v1/rpc/admin_list_users**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
}

const freeRow = {
  id: '11111111-1111-1111-1111-111111111111', email: 'freecoach@example.com',
  username: 'FreeCoach', created_at: '2026-08-05T12:00:00Z', is_admin_user: false,
  plan: 'free', current_period_end: null, is_stripe_backed: false,
};
const stripeRow = {
  id: '22222222-2222-2222-2222-222222222222', email: 'payingcoach@example.com',
  username: 'PayingCoach', created_at: '2026-08-05T13:00:00Z', is_admin_user: false,
  plan: 'pro', current_period_end: '2027-08-05T00:00:00Z', is_stripe_backed: true,
};

test('admin users tab: a user with no subscription row shows as Free', async ({ page }) => {
  await mockAdmin(page, [freeRow]);
  await page.goto('/admin');

  await expect(page.getByRole('cell', { name: 'freecoach@example.com' })).toBeVisible();
  await expect(page.getByLabel('Plan for freecoach@example.com')).toHaveValue('free');
});

test('admin users tab: changing the dropdown calls admin_set_user_plan', async ({ page }) => {
  await mockAdmin(page, [freeRow]);

  let body: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/admin_set_user_plan**', (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  await page.goto('/admin');
  await page.getByLabel('Plan for freecoach@example.com').selectOption('founding');

  await expect.poll(() => body).not.toBeNull();
  expect(body).toEqual({ target_user_id: freeRow.id, new_plan: 'founding' });
  // Optimistic update sticks when the call succeeds.
  await expect(page.getByLabel('Plan for freecoach@example.com')).toHaveValue('founding');
});

test('admin users tab: a Stripe-backed subscriber is read-only, not a dropdown', async ({ page }) => {
  // The server refuses these (PBP06), so the UI must not offer a control that
  // can only fail.
  await mockAdmin(page, [stripeRow]);
  await page.goto('/admin');

  await expect(page.getByRole('cell', { name: 'payingcoach@example.com' })).toBeVisible();
  await expect(page.getByText('Pro (Stripe)')).toBeVisible();
  await expect(page.getByLabel('Plan for payingcoach@example.com')).toHaveCount(0);
});

test('admin users tab: a PBP06 rejection shows its real message and rolls back', async ({ page }) => {
  await mockAdmin(page, [freeRow]);
  await page.route('**/rest/v1/rpc/admin_set_user_plan**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PBP06',
        message: 'This user has an active Stripe subscription. Cancel it in Stripe before changing their plan.',
        details: null, hint: null,
      }),
    }));

  await page.goto('/admin');
  await page.getByLabel('Plan for freecoach@example.com').selectOption('founding');

  // errors.ts must pass PBP06 through verbatim rather than the generic fallback.
  await expect(page.getByText('This user has an active Stripe subscription.', { exact: false })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  // Failed write must roll the optimistic change back.
  await expect(page.getByLabel('Plan for freecoach@example.com')).toHaveValue('free');
});

test('admin users tab: search filters the list', async ({ page }) => {
  await mockAdmin(page, [freeRow, stripeRow]);
  await page.goto('/admin');
  await expect(page.getByText('2 of 2 users')).toBeVisible();

  await page.getByLabel('Search users').fill('paying');
  await expect(page.getByText('1 of 2 users')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'freecoach@example.com' })).toHaveCount(0);
});

test('nav "Play Designer" opens in the same tab, not a new one', async ({ page, context }) => {
  // The nav item used to carry newTab:true (target="_blank"), which orphaned
  // tabs and broke SPA navigation. Guard the desktop nav and the mobile menu.
  await page.goto('/');
  await page.getByRole('link', { name: 'Play Designer' }).click();

  await expect(page).toHaveURL(/\/designer/);
  expect(context.pages()).toHaveLength(1);

  // Mobile menu path.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('nav button').last().click();
  await page.getByRole('link', { name: 'Play Designer' }).click();

  await expect(page).toHaveURL(/\/designer/);
  expect(context.pages()).toHaveLength(1);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Sign out. useEntitlement() used to call auth.getUser() from inside an
 * onAuthStateChange callback; gotrue dispatches those while holding its
 * session lock, so that re-entrant call deadlocked the lock permanently and
 * every later auth call — signOut() included — hung forever. The Sign Out
 * button silently did nothing.
 * ──────────────────────────────────────────────────────────────────────────── */

const SIGNED_IN_USER = {
  id: '77777777-7777-7777-7777-777777777777',
  aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
  app_metadata: {}, user_metadata: { username: 'Coach' }, created_at: '2025-01-01T00:00:00Z',
};

/** gotrue decodes the access token, so the fixture must be a structurally
 *  valid JWT — a placeholder string makes it report "Auth session missing"
 *  before any network call and the test stops exercising the real path. */
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FAKE_JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
  sub: SIGNED_IN_USER.id, aud: 'authenticated', role: 'authenticated',
  session_id: 'sess-1', email: SIGNED_IN_USER.email,
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.sig`;

async function signedInHome(page: Page, logout: (route: never) => unknown) {
  await page.addInitScript(({ u, k, jwt }) => {
    localStorage.setItem('pbp-analytics-consent', 'denied');
    // Seed ONCE. addInitScript re-runs on every navigation, and a failed
    // sign-out deliberately hard-reloads — re-seeding would silently undo the
    // very thing under test.
    if (sessionStorage.getItem('pbp-seeded')) return;
    sessionStorage.setItem('pbp-seeded', '1');
    localStorage.setItem(k, JSON.stringify({
      access_token: jwt, refresh_token: 'ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: u,
    }));
  }, { u: SIGNED_IN_USER, k: AUTH_STORAGE_KEY, jwt: FAKE_JWT });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIGNED_IN_USER) }));
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/logout**', logout as never);
  await page.goto('/');
}

test('auth calls do not deadlock the gotrue session lock on the homepage', async ({ page }) => {
  // The root cause, asserted directly: if the lock is stuck, these never settle.
  await signedInHome(page, ((route: { fulfill: (o: unknown) => unknown }) =>
    route.fulfill({ status: 204, body: '' })) as never);
  await page.waitForTimeout(1200);

  const settled = await page.evaluate(async () => {
    const mod = await import('/src/lib/supabase.ts');
    const sb = (mod as { supabase: { auth: { getSession: () => Promise<unknown> } } }).supabase;
    return Promise.race([
      sb.auth.getSession().then(() => true),
      new Promise((res) => setTimeout(() => res(false), 5000)),
    ]);
  });
  expect(settled).toBe(true);
});

test('Sign Out signs the user out and returns them home', async ({ page }) => {
  let logoutCalled = false;
  await signedInHome(page, ((route: { fulfill: (o: unknown) => unknown }) => {
    logoutCalled = true;
    return route.fulfill({ status: 204, body: '' });
  }) as never);

  await page.getByRole('button', { name: 'Coach' }).click();
  await page.getByRole('button', { name: 'Sign Out' }).click();

  await expect.poll(() => logoutCalled, { timeout: 10000 }).toBe(true);
  await expect(page.getByRole('button', { name: 'Coach' })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), AUTH_STORAGE_KEY)).toBeNull();
});

test('Sign Out still works when the server rejects the logout', async ({ page }) => {
  // Very common: the session is already gone server-side, so /logout 403s. The
  // user must still end up signed out locally rather than stuck.
  await signedInHome(page, ((route: { fulfill: (o: unknown) => unknown }) =>
    route.fulfill({
      status: 403, contentType: 'application/json',
      body: JSON.stringify({ code: 403, error_code: 'session_not_found', msg: 'Session not found' }),
    })) as never);

  await page.getByRole('button', { name: 'Coach' }).click();
  await page.getByRole('button', { name: 'Sign Out' }).click();

  await expect(page.getByRole('button', { name: 'Coach' })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), AUTH_STORAGE_KEY)).toBeNull();
});

test('feedback submit is not wedged by the auth lock', async ({ page }) => {
  // Same root cause as the Sign Out bug, different symptom: FeedbackButton
  // awaits auth.getUser() AFTER setLoading(true), so a wedged session lock left
  // the button disabled at opacity-50 reading "Submitting..." forever — users
  // reported "it shades out and nothing happens" — and the insert never fired.
  let insertPosted = false;
  await page.addInitScript(({ u, k, jwt }) => {
    localStorage.setItem('pbp-analytics-consent', 'denied');
    if (sessionStorage.getItem('pbp-seeded')) return;
    sessionStorage.setItem('pbp-seeded', '1');
    localStorage.setItem(k, JSON.stringify({
      access_token: jwt, refresh_token: 'ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: u,
    }));
  }, { u: SIGNED_IN_USER, k: AUTH_STORAGE_KEY, jwt: FAKE_JWT });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SIGNED_IN_USER) }));
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    if (req.url().includes('/feedback') && req.method() === 'POST') {
      insertPosted = true;
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');
  await page.getByTitle('Give Feedback').click();
  await page.getByLabel('Your Feedback').fill('The kickoff formation is missing.');
  await page.getByRole('button', { name: 'Submit Feedback' }).click();

  await expect.poll(() => insertPosted, { timeout: 10000 }).toBe(true);
  await expect(page.getByText('Thank you for your feedback!')).toBeVisible();
});

/* ────────────────────────────────────────────────────────────────────────────
 * Saved toolbar rosters. A coach can relabel/recolor/reshape the built-in
 * chips once and have it stick, instead of re-customizing on every play.
 * ──────────────────────────────────────────────────────────────────────────── */

const ROSTER_USER = {
  id: '55555555-5555-5555-5555-555555555555',
  aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
  app_metadata: {}, user_metadata: { username: 'Coach' }, created_at: '2025-01-01T00:00:00Z',
};

/** Signs in and stubs user_preferences with the given custom_roster.
 *  Returns a getter for whatever the app last wrote back. */
async function withRoster(page: Page, customRoster: unknown) {
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(({ u, k }) => {
    localStorage.setItem('pbp-analytics-consent', 'denied');
    localStorage.setItem(k, JSON.stringify({
      access_token: 'tok', refresh_token: 'ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: u,
    }));
  }, { u: ROSTER_USER, k: AUTH_STORAGE_KEY });
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROSTER_USER) }));
  await page.route('**/rest/v1/user_preferences**', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.method() === 'HEAD') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ custom_roster: customRoster }),
      });
    }
    writes.push(req.postDataJSON());
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  return () => writes;
}

test('saved roster: a customized chip replaces the built-in one', async ({ page }) => {
  await withRoster(page, {
    offense: [{ id: 'off-q', letter: '1', color: '#E11D48', shape: 'star' }],
  });
  await openDesigner(page);

  // The override wins…
  await expect(btn(page, 'Player 1')).toBeVisible();
  await expect(btn(page, 'Player Q')).toHaveCount(0);
  // …and chips with no override keep their defaults.
  await expect(btn(page, 'Player R')).toBeVisible();
});

test('saved roster: a custom shape survives click-to-place AND drag-to-place', async ({ page }) => {
  // Guards three paths that all used to drop `shape`: the chip render, the
  // click payload, and the drag payload (Canvas reads data.shape but the
  // toolbar never sent it).
  await withRoster(page, {
    offense: [{ id: 'off-q', letter: '1', color: '#E11D48', shape: 'star' }],
  });
  await openDesigner(page);

  await btn(page, 'Player 1').click();
  const spot = await canvasPoint(page, 0.4, 0.6);
  await page.mouse.click(spot.x, spot.y);

  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);
  expect(state.playerIcons[0].letter).toBe('1');
  expect(state.playerIcons[0].color).toBe('#E11D48');
  expect(state.playerIcons[0].shape).toBe('star');

  // Drag-to-place carries the same shape through the dataTransfer payload.
  const dropped = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('button[title="Player 1"]')].find(
      (b) => (b as HTMLElement).offsetParent !== null,
    )!;
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    return dt.getData('application/json');
  });
  expect(JSON.parse(dropped)).toMatchObject({ letter: '1', color: '#E11D48', shape: 'star' });
});

test('saved roster: editing a chip persists it to user_preferences', async ({ page }) => {
  const getWrites = await withRoster(page, null);
  await openDesigner(page);

  await btn(page, 'Edit your players').click();
  await btn(page, 'Edit player Q').click();

  const labelInput = page.getByLabel('Player label');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('QB1');
  await page.getByLabel('Color #E11D48').click();
  await page.getByRole('button', { name: 'Save Player' }).click();

  await expect.poll(() => getWrites().length, { timeout: 10000 }).toBeGreaterThan(0);
  const body = getWrites()[0] as { custom_roster?: { offense?: { id: string; letter: string; color: string }[] } };
  const saved = body.custom_roster?.offense?.find((c) => c.id === 'off-q');
  expect(saved).toMatchObject({ letter: 'QB1', color: '#E11D48' });

  // Applied immediately, without a reload.
  await expect(btn(page, 'Edit player QB1')).toBeVisible();
});

test('saved roster: reset drops the override for that play type only', async ({ page }) => {
  const getWrites = await withRoster(page, {
    offense: [{ id: 'off-q', letter: '1', color: '#E11D48', shape: 'star' }],
    defense: [{ id: 'def-d', letter: 'DE', color: '#F97316', shape: 'circle' }],
  });
  await openDesigner(page);

  await btn(page, 'Edit your players').click();
  await btn(page, 'Reset these players to the defaults').click();

  await expect.poll(() => getWrites().length, { timeout: 10000 }).toBeGreaterThan(0);
  const body = getWrites()[0] as { custom_roster?: Record<string, unknown> };
  expect(body.custom_roster?.offense).toBeUndefined();
  // The defensive override is untouched — reset is scoped to what's on screen.
  expect(body.custom_roster?.defense).toBeDefined();
});

test('saved roster: a malformed saved chip falls back to its default', async ({ page }) => {
  // custom_roster is user-controlled JSON that round-trips through the DB, so
  // a bad entry must not put an empty label or arbitrary string into a style.
  await withRoster(page, {
    offense: [
      { id: 'off-q', letter: '', color: '#E11D48', shape: 'star' },        // empty label
      { id: 'off-r', letter: 'RB', color: 'javascript:alert(1)' },          // not a hex color
      { id: 'nonexistent-chip', letter: 'ZZ', color: '#000000' },           // unknown id
    ],
  });
  await openDesigner(page);

  await expect(btn(page, 'Player Q')).toBeVisible(); // fell back
  await expect(btn(page, 'Player R')).toBeVisible(); // fell back
  await expect(btn(page, 'Player ZZ')).toHaveCount(0); // ignored
});

test('saved roster: signed out, roster editing is not offered', async ({ page }) => {
  await openDesigner(page);
  await expect(btn(page, 'Player Q')).toBeVisible();
  await expect(btn(page, 'Edit your players')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Route color independent of player-icon color. A route's color used to have
 * exactly one source — the origin icon's color at draw time — and got
 * silently re-baked forever: recoloring the icon later always overwrote the
 * route's color too. Feedback: rec leagues want routes to keep matching the
 * player (leave this alone); travel/NFL flag teams want positions
 * color-coded but every route black, with one "hot route" in red.
 * ──────────────────────────────────────────────────────────────────────────── */

const ROUTE_COLOR_TRIGGER = 'Route color: Auto (match player) or a fixed color for every new route';

test('route color: sticky non-Auto default survives the icon being recolored later', async ({ page }) => {
  await openDesigner(page);

  // Set the sticky default to a fixed color (black) before drawing.
  await btn(page, ROUTE_COLOR_TRIGGER).click();
  await page.getByLabel('Color #000000').click();
  await page.getByRole('button', { name: 'Set' }).click();

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  expect(state.paths[0].color).toBe('#000000');
  expect(state.paths[0].independentColor).toBe(true);
  // The icon itself is untouched — only the sticky route default changed.
  expect(state.playerIcons[0].color).not.toBe('#000000');

  // Recoloring the icon afterward must NOT drag the route's color with it —
  // this is the actual regression guard for the applyIconStyle fix.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Player label')).toBeVisible();
  await page.getByLabel('Color #E11D48').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.playerIcons[0].color).toBe('#E11D48');
  expect(state.paths[0].color).toBe('#000000');
});

test('route color: Auto (default) still follows the icon, including after a later recolor', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe(state.playerIcons[0].color);
  expect(state.paths[0].independentColor).toBeFalsy();

  // Pins down the "still syncs when not overridden" baseline explicitly —
  // nothing previously asserted this for routes, only for zones.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Player label')).toBeVisible();
  await page.getByLabel('Color #10B981').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.playerIcons[0].color).toBe('#10B981');
  expect(state.paths[0].color).toBe('#10B981');
});

test('route color: Recolor Route mode changes only the tapped player\'s route', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spotQ = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spotQ.x, spotQ.y);
  await btn(page, 'Player R').click();
  const spotR = await canvasPoint(page, 0.6, 0.6);
  await page.mouse.click(spotR.x, spotR.y);

  let state = await canvasState(page);
  await btn(page, 'Straight Line Route').click();
  const iconQ = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(iconQ.x, iconQ.y);
  await page.waitForTimeout(TAP_GAP);
  const endQ = await canvasPoint(page, 0.3, 0.4);
  await page.mouse.click(endQ.x, endQ.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  const iconR = await canvasPoint(page, state.playerIcons[1].x, state.playerIcons[1].y);
  await btn(page, 'Straight Line Route').click();
  await page.mouse.click(iconR.x, iconR.y);
  await page.waitForTimeout(TAP_GAP);
  const endR = await canvasPoint(page, 0.6, 0.4);
  await page.mouse.click(endR.x, endR.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  state = await canvasState(page);
  const rOriginalColor = state.paths[1].color;

  await btn(page, 'Recolor a route (tap the route)').click();
  await page.mouse.click(iconQ.x, iconQ.y);
  await expect(page.getByLabel('Custom route color')).toBeVisible();
  await page.getByLabel('Color #E11D48').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe('#E11D48');
  expect(state.paths[0].independentColor).toBe(true);
  // R's route, drawn from a different icon, is untouched.
  expect(state.paths[1].color).toBe(rOriginalColor);
  expect(state.paths[1].independentColor).toBeFalsy();
});

test('route color: picking Auto in the popover reverts the override and resumes syncing', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  // Override to red via Recolor Route mode.
  await btn(page, 'Recolor a route (tap the route)').click();
  await page.mouse.click(icon.x, icon.y);
  await page.getByLabel('Color #E11D48').click();
  await page.getByRole('button', { name: 'Apply' }).click();
  state = await canvasState(page);
  expect(state.paths[0].independentColor).toBe(true);

  // Still in Recolor Route mode from above (Apply doesn't exit the mode) —
  // tapping the icon again reopens the popover; re-clicking the toggle
  // button here would instead turn the mode OFF.
  await page.mouse.click(icon.x, icon.y);
  await page.getByRole('button', { name: 'Auto (match player)' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe(state.playerIcons[0].color);
  expect(state.paths[0].independentColor).toBeFalsy();

  // And recoloring the icon now propagates again — proves the flag was
  // genuinely cleared, not just visually reset once.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Player label')).toBeVisible();
  await page.getByLabel('Color #F59E0B').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe('#F59E0B');
});

test('route color: Recolor Route mode is mutually exclusive with other tools', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.4, 0.6);
  await page.mouse.click(spot.x, spot.y);
  const state = await canvasState(page);

  await btn(page, 'Straight Line Route').click();
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.4, 0.4);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  // Enter Recolor Route mode and confirm tapping the icon opens the ROUTE
  // color popover, not the icon-style popover.
  await btn(page, 'Recolor a route (tap the route)').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Custom route color')).toBeVisible();
  await expect(page.getByLabel('Player label')).toHaveCount(0);

  // Switching to Select mode must close that popover AND leave recolor mode,
  // so the SAME tap now opens the icon-style popover instead.
  await btn(page, 'Select / Move').click();
  await expect(page.getByLabel('Custom route color')).toHaveCount(0);
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Player label')).toBeVisible();
  await expect(page.getByLabel('Custom route color')).toHaveCount(0);
});

test('route color: overriding a route leaves the icon\'s zone color unaffected', async ({ page }) => {
  await openDesigner(page);
  await page.getByRole('button', { name: 'defense', exact: true }).click();

  await btn(page, 'Player S').click();
  const spot = await canvasPoint(page, 0.5, 0.55);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  // A route AND a zone from the same defender.
  await btn(page, 'Straight Line Route').click();
  await page.mouse.click(icon.x, icon.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.5, 0.35);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  await btn(page, 'Draw a zone of responsibility (drag from a player)').click();
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(icon.x + 90, icon.y + 60, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  const originalIconColor = state.playerIcons[0].color;
  expect(state.zones[0].color).toBe(originalIconColor);

  // Override just the route to black.
  await btn(page, 'Recolor a route (tap the route)').click();
  await page.mouse.click(icon.x, icon.y);
  await page.getByLabel('Color #000000').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe('#000000');
  expect(state.zones[0].color).toBe(originalIconColor);

  // Recoloring the icon: zone follows (as always), route keeps its override.
  await btn(page, 'Select / Move').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByLabel('Player label')).toBeVisible();
  await page.getByLabel('Color #6366F1').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.playerIcons[0].color).toBe('#6366F1');
  expect(state.zones[0].color).toBe('#6366F1');
  expect(state.paths[0].color).toBe('#000000');
});

/* ────────────────────────────────────────────────────────────────────────────
 * Community Forum — Top Contributors sidebar.
 *
 * Regression coverage for a real bug: this sidebar used to be hardcoded mock
 * data (three made-up usernames, stock Unsplash photos, fabricated
 * reputation numbers) rendered as if it were real community activity. Now
 * backed by get_top_contributors(), a real query over user_reputation.
 * ──────────────────────────────────────────────────────────────────────────── */

const OLD_MOCK_CONTRIBUTOR_NAMES = ['CoachMike', 'DefensiveGuru', 'PlayMaker'];

test('Community Forum: Top Contributors shows real data, not the old fabricated names', async ({ page }) => {
  await page.route('**/rest/v1/posts**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/get_top_contributors**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'u1', username: 'RealCoach99', avatar_url: null, reputation: 340 },
        { id: 'u2', username: 'FlagFootballFan', avatar_url: null, reputation: 120 },
      ]),
    }));

  await page.goto('/community');
  await expect(page.getByText('RealCoach99')).toBeVisible();
  await expect(page.getByText('340', { exact: false })).toBeVisible();
  for (const name of OLD_MOCK_CONTRIBUTOR_NAMES) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
});

test('Community Forum: no real contributors yet shows an honest empty state, not fabricated ones', async ({ page }) => {
  await page.route('**/rest/v1/posts**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/get_top_contributors**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/community');
  await expect(page.getByText('No contributors yet')).toBeVisible();
  for (const name of OLD_MOCK_CONTRIBUTOR_NAMES) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
});

test('Community Forum: no fabricated "Trending Topics" section (no real topic/tag data exists)', async ({ page }) => {
  await page.route('**/rest/v1/posts**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/get_top_contributors**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/community');
  await expect(page.getByText('Top Contributors')).toBeVisible(); // page loaded correctly
  await expect(page.getByText('Trending Topics')).toHaveCount(0);
  await expect(page.getByText('#defensivestrategies')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Community Forum — editing and deleting your own posts. RLS already scopes
 * the writes to the owner (auth.uid() = user_id); these tests cover the UI
 * half: the buttons only render on your own posts, and edit/delete actually
 * reach the backend and update what's on screen afterward.
 * ──────────────────────────────────────────────────────────────────────────── */

const COMMUNITY_USER = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
  app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
};
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function signInAsCommunityUser(page: Page) {
  return page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: COMMUNITY_USER, storageKey: AUTH_STORAGE_KEY });
}

async function mockCommunityAuthors(page: Page) {
  await page.route('**/rest/v1/rpc/get_top_contributors**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/get_community_authors**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: COMMUNITY_USER.id, username: 'Coach', avatar_url: null },
        { id: OTHER_USER_ID, username: 'OtherCoach', avatar_url: null },
      ]),
    }));
}

test('Community Forum: Edit/Delete only render on your own post, never on someone else\'s', async ({ page }) => {
  await signInAsCommunityUser(page);
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COMMUNITY_USER) }));
  await mockCommunityAuthors(page);
  await page.route('**/rest/v1/posts**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'own-post', title: 'My Post', content: 'Mine', user_id: COMMUNITY_USER.id, upvotes: 0, downvotes: 0, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
        { id: 'other-post', title: 'Their Post', content: 'Not mine', user_id: OTHER_USER_ID, upvotes: 0, downvotes: 0, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
      ]),
    }));

  await page.goto('/community');
  await expect(page.getByText('My Post')).toBeVisible();
  await expect(page.getByText('Their Post')).toBeVisible();

  const ownArticle = page.locator('article', { hasText: 'My Post' });
  const otherArticle = page.locator('article', { hasText: 'Their Post' });
  await expect(ownArticle.locator('button[title="Edit Post"]')).toBeVisible();
  await expect(ownArticle.locator('button[title="Delete Post"]')).toBeVisible();
  await expect(otherArticle.locator('button[title="Edit Post"]')).toHaveCount(0);
  await expect(otherArticle.locator('button[title="Delete Post"]')).toHaveCount(0);
});

test('Community Forum: signed out, no post shows Edit/Delete', async ({ page }) => {
  await mockCommunityAuthors(page);
  await page.route('**/rest/v1/posts**', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: 'own-post', title: 'My Post', content: 'Mine', user_id: COMMUNITY_USER.id, upvotes: 0, downvotes: 0, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
      ]),
    }));

  await page.goto('/community');
  await expect(page.getByText('My Post')).toBeVisible();
  await expect(page.locator('button[title="Edit Post"]')).toHaveCount(0);
  await expect(page.locator('button[title="Delete Post"]')).toHaveCount(0);
});

test('Community Forum: editing a post saves the change and shows an "edited" marker; an untouched post shows none', async ({ page }) => {
  await signInAsCommunityUser(page);
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COMMUNITY_USER) }));
  await mockCommunityAuthors(page);

  let edited = false;
  const patchBodies: any[] = [];
  await page.route('**/rest/v1/posts**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      patchBodies.push(route.request().postDataJSON());
      edited = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: 'own-post',
        title: edited ? 'Updated title' : 'Original title',
        content: edited ? 'Updated content' : 'Original content',
        user_id: COMMUNITY_USER.id, upvotes: 0, downvotes: 0,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: edited ? '2026-08-01T01:00:00Z' : '2026-08-01T00:00:00Z',
      }]),
    });
  });

  await page.goto('/community');
  await expect(page.getByText('Original title')).toBeVisible();
  // Not edited yet — no marker.
  await expect(page.getByText('edited', { exact: false })).toHaveCount(0);

  await page.locator('button[title="Edit Post"]').click();
  await expect(page.getByRole('heading', { name: 'Edit Post' })).toBeVisible();
  const titleInput = page.locator('#title');
  const contentInput = page.locator('#content');
  await expect(titleInput).toHaveValue('Original title');
  await expect(contentInput).toHaveValue('Original content');

  await titleInput.fill('Updated title');
  await contentInput.fill('Updated content');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Updated title')).toBeVisible();
  await expect(page.getByText('edited', { exact: false })).toBeVisible();
  expect(patchBodies).toHaveLength(1);
  expect(patchBodies[0]).toMatchObject({ title: 'Updated title', content: 'Updated content' });
  // Update never touches user_id — RLS's WITH CHECK is the real boundary, but
  // the client shouldn't even attempt to send a different one.
  expect(patchBodies[0].user_id).toBeUndefined();
});

test('Community Forum: deleting a post confirms, deletes, and removes it from the list', async ({ page }) => {
  await signInAsCommunityUser(page);
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(COMMUNITY_USER) }));
  await mockCommunityAuthors(page);

  let deleted = false;
  const deletedIds: string[] = [];
  await page.route('**/rest/v1/posts**', (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      deleted = true;
      const url = new URL(route.request().url());
      deletedIds.push(url.searchParams.get('id') || '');
      return route.fulfill({ status: 204, contentType: 'application/json', body: '' });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(deleted ? [] : [
        { id: 'own-post', title: 'Doomed Post', content: 'Going away', user_id: COMMUNITY_USER.id, upvotes: 0, downvotes: 0, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
      ]),
    });
  });

  await page.goto('/community');
  await expect(page.getByText('Doomed Post')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('button[title="Delete Post"]').click();

  await expect(page.getByText('Doomed Post')).toHaveCount(0);
  expect(deletedIds[0]).toContain('own-post');
});

/* ────────────────────────────────────────────────────────────────────────────
 * Two routes per player — a short option and a deep option on one player.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Draws one straight-line route from `origin` to `end` (page coords) and
 * finishes it — the same click/wait/click/Finish sequence used throughout
 * this file's existing route-drawing tests. */
async function drawStraightRoute(page: Page, origin: { x: number; y: number }, end: { x: number; y: number }) {
  await btn(page, 'Straight Line Route').click();
  await page.mouse.click(origin.x, origin.y);
  await page.waitForTimeout(TAP_GAP);
  await page.mouse.click(end.x, end.y);
  await page.waitForTimeout(TAP_GAP);
  await page.getByRole('button', { name: 'Finish Route' }).click();
}

test('routes: a player can have two independent routes (short + deep option); a third is blocked', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  const shortEnd = await canvasPoint(page, 0.5, 0.6);
  await drawStraightRoute(page, icon, shortEnd);
  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);

  const deepEnd = await canvasPoint(page, 0.3, 0.15);
  await drawStraightRoute(page, icon, deepEnd);
  state = await canvasState(page);
  expect(state.paths).toHaveLength(2);
  expect(state.paths[0].startIconIndex).toBe(0);
  expect(state.paths[1].startIconIndex).toBe(0);

  // A third attempt on the same player is blocked (cap is 2).
  await btn(page, 'Straight Line Route').click();
  await page.mouse.click(icon.x, icon.y);
  await expect(page.getByText('This player already has 2 routes', { exact: false })).toBeVisible();
  state = await canvasState(page);
  expect(state.paths).toHaveLength(2);
});

test('routes: Recolor Route mode targets one of a player\'s two routes independently', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  const shortEnd = await canvasPoint(page, 0.5, 0.6);
  await drawStraightRoute(page, icon, shortEnd);
  const deepEnd = await canvasPoint(page, 0.3, 0.15);
  await drawStraightRoute(page, icon, deepEnd);

  state = await canvasState(page);
  expect(state.paths).toHaveLength(2);
  const deepRouteOriginalColor = state.paths[1].color;

  // Recolor only the SHORT route by tapping near ITS end, away from the
  // shared origin the two routes both start from.
  await btn(page, 'Recolor a route (tap the route)').click();
  await page.mouse.click(shortEnd.x, shortEnd.y);
  await expect(page.getByLabel('Custom route color')).toBeVisible();
  await page.getByLabel('Color #E11D48').click();
  await page.getByRole('button', { name: 'Apply' }).click();

  state = await canvasState(page);
  expect(state.paths[0].color).toBe('#E11D48');
  expect(state.paths[0].independentColor).toBe(true);
  // The deep route, drawn from the same icon, is untouched.
  expect(state.paths[1].color).toBe(deepRouteOriginalColor);
  expect(state.paths[1].independentColor).toBeFalsy();
});

test('routes: Remove Route mode deletes one of a player\'s two routes independently', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const icon = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  const shortEnd = await canvasPoint(page, 0.5, 0.6);
  await drawStraightRoute(page, icon, shortEnd);
  const deepEnd = await canvasPoint(page, 0.3, 0.15);
  await drawStraightRoute(page, icon, deepEnd);

  state = await canvasState(page);
  expect(state.paths).toHaveLength(2);

  // Remove only the DEEP route by tapping near its end.
  await btn(page, 'Remove a route (tap the route)').click();
  await page.mouse.click(deepEnd.x, deepEnd.y);

  state = await canvasState(page);
  expect(state.paths).toHaveLength(1);
  // The survivor is the SHORT route — its last point is near y=0.6, not the
  // deep route's y=0.15.
  expect(state.paths[0].points[state.paths[0].points.length - 1].y).toBeCloseTo(0.6, 1);
});

// Moving a player carries their route(s) with them. The route is the player's
// assignment, so a receiver dragged two yards wider should take their whole
// route along — rigidly translated, not left stranded and not rubber-banded
// from its first point (which would deform the shape the coach drew).
test('routes: dragging a player translates their route with them, preserving its shape', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  const state = await canvasState(page);
  const iconPx = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  // A dog-leg so the assertion below would catch a shape change, not just a
  // translation: out to the right, then straight upfield.
  await btn(page, 'Straight Line Route').click();
  await page.mouse.click(iconPx.x, iconPx.y);
  await page.waitForTimeout(TAP_GAP);
  const mid = await canvasPoint(page, 0.45, 0.6);
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(TAP_GAP);
  const end = await canvasPoint(page, 0.45, 0.25);
  await page.mouse.click(end.x, end.y);
  await page.getByRole('button', { name: 'Finish Route' }).click();

  const before = await canvasState(page);
  expect(before.paths).toHaveLength(1);
  const iconBefore = before.playerIcons[0];
  const ptsBefore = before.paths[0].points;

  // Drag the player. Magnet snapping is on by default and there's only one
  // icon on the field, so nothing can pull the drop point off the pointer.
  await btn(page, 'Select / Move').click();
  const from = await canvasPoint(page, iconBefore.x, iconBefore.y);
  const to = await canvasPoint(page, iconBefore.x + 0.2, iconBefore.y - 0.1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const after = await canvasState(page);
  const iconAfter = after.playerIcons[0];
  const ptsAfter = after.paths[0].points;

  // The icon actually moved.
  const dx = iconAfter.x - iconBefore.x;
  const dy = iconAfter.y - iconBefore.y;
  expect(Math.abs(dx)).toBeGreaterThan(0.1);
  expect(Math.abs(dy)).toBeGreaterThan(0.05);

  // Every route point moved by that same delta — so the route followed AND
  // kept its exact geometry.
  expect(ptsAfter).toHaveLength(ptsBefore.length);
  ptsAfter.forEach((pt, i) => {
    expect(pt.x).toBeCloseTo(ptsBefore[i].x + dx, 5);
    expect(pt.y).toBeCloseTo(ptsBefore[i].y + dy, 5);
  });

  // The route's origin still sits on the player it belongs to.
  expect(ptsAfter[0].x).toBeCloseTo(iconAfter.x, 5);
  expect(ptsAfter[0].y).toBeCloseTo(iconAfter.y, 5);

  // One undo reverts the whole drag — icon and route together, not the icon
  // alone leaving the route displaced.
  await btn(page, 'Undo').click();
  const undone = await canvasState(page);
  expect(undone.playerIcons[0].x).toBeCloseTo(iconBefore.x, 5);
  expect(undone.playerIcons[0].y).toBeCloseTo(iconBefore.y, 5);
  undone.paths[0].points.forEach((pt, i) => {
    expect(pt.x).toBeCloseTo(ptsBefore[i].x, 5);
    expect(pt.y).toBeCloseTo(ptsBefore[i].y, 5);
  });
});

// A player may carry two routes (short + deep option) — dragging them must
// move both, not just the first one found.
test('routes: dragging a player with two routes moves both', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  const state = await canvasState(page);
  const iconPx = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  await drawStraightRoute(page, iconPx, await canvasPoint(page, 0.5, 0.6));
  await drawStraightRoute(page, iconPx, await canvasPoint(page, 0.3, 0.2));

  const before = await canvasState(page);
  expect(before.paths).toHaveLength(2);
  const iconBefore = before.playerIcons[0];

  await btn(page, 'Select / Move').click();
  const from = await canvasPoint(page, iconBefore.x, iconBefore.y);
  const to = await canvasPoint(page, iconBefore.x + 0.15, iconBefore.y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const after = await canvasState(page);
  const dx = after.playerIcons[0].x - iconBefore.x;
  expect(Math.abs(dx)).toBeGreaterThan(0.1);

  after.paths.forEach((path, pi) => {
    path.points.forEach((pt, i) => {
      expect(pt.x).toBeCloseTo(before.paths[pi].points[i].x + dx, 5);
      expect(pt.y).toBeCloseTo(before.paths[pi].points[i].y, 5);
    });
  });
});

// Only the dragged player's routes move — a teammate's route must stay put.
test('routes: dragging a player leaves another player\'s route untouched', async ({ page }) => {
  await openDesigner(page);

  await btn(page, 'Player Q').click();
  const qSpot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(qSpot.x, qSpot.y);
  await btn(page, 'Player X').click();
  const xSpot = await canvasPoint(page, 0.7, 0.6);
  await page.mouse.click(xSpot.x, xSpot.y);

  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(2);
  const qPx = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);
  const xPx = await canvasPoint(page, state.playerIcons[1].x, state.playerIcons[1].y);

  await drawStraightRoute(page, qPx, await canvasPoint(page, 0.3, 0.25));
  await drawStraightRoute(page, xPx, await canvasPoint(page, 0.7, 0.25));

  const before = await canvasState(page);
  expect(before.paths).toHaveLength(2);
  const qRouteIdx = before.paths.findIndex((p) => p.startIconIndex === 0);
  const xRouteIdx = before.paths.findIndex((p) => p.startIconIndex === 1);
  const xPtsBefore = before.paths[xRouteIdx].points;

  // Drag Q straight down; X and X's route must not budge.
  await btn(page, 'Select / Move').click();
  const from = await canvasPoint(page, before.playerIcons[0].x, before.playerIcons[0].y);
  const to = await canvasPoint(page, before.playerIcons[0].x, before.playerIcons[0].y + 0.12);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  const after = await canvasState(page);
  expect(after.playerIcons[1].x).toBeCloseTo(before.playerIcons[1].x, 5);
  expect(after.playerIcons[1].y).toBeCloseTo(before.playerIcons[1].y, 5);
  after.paths[xRouteIdx].points.forEach((pt, i) => {
    expect(pt.x).toBeCloseTo(xPtsBefore[i].x, 5);
    expect(pt.y).toBeCloseTo(xPtsBefore[i].y, 5);
  });
  // …while Q's route did move.
  expect(after.paths[qRouteIdx].points[0].y).toBeGreaterThan(before.paths[qRouteIdx].points[0].y + 0.05);
});

// A zone's dashed connector to its icon is only meaningful once the icon is
// visibly outside the zone. It used to be decided by comparing the icon's
// raw distance from the zone center against a threshold scaled off the
// zone's OWN radius (max(rx, ry) * 0.6) — so stretching the zone larger
// inflated the very threshold used to decide whether to show the line, and
// a wide zone could hide the connector even though the icon sat clearly
// outside the ellipse in the other axis. zoneConnectorVisible() fixes this
// by normalizing each axis by its own radius (ellipse-relative), which is
// unit-invariant — normalized 0–1 fractions and pixel coordinates give the
// same answer, since only the ratios matter.
test('zone connector: visibility is ellipse-relative, not tied to the zone\'s own size', () => {
  // Reproduces the reported bug with concrete numbers: a zone dragged well
  // above its icon (a real vertical gap), then stretched wide horizontally.
  const zone = { cx: 0.5, cy: 0.3, rx: 0.35, ry: 0.05 };
  const icon = { x: 0.5, y: 0.45 }; // 0.15 below the zone center — 3x the zone's own height (ry)

  // The old formula, inlined here to document exactly what broke: a single
  // threshold derived from the zone's largest radius, applied regardless of
  // which axis the icon actually diverges on.
  const oldDist = Math.hypot(icon.x - zone.cx, icon.y - zone.cy);
  const oldVisible = oldDist > Math.max(zone.rx, zone.ry) * 0.6;
  expect(oldVisible).toBe(false); // the bug: hidden despite the icon being well outside the ellipse

  expect(zoneConnectorVisible(zone, icon)).toBe(true);

  // Sanity check the other direction too: an icon still close to a small,
  // unstretched zone should not show a connector.
  expect(zoneConnectorVisible({ cx: 0.5, cy: 0.5, rx: 0.05, ry: 0.05 }, { x: 0.51, y: 0.5 })).toBe(false);

  // No icon (shouldn't happen for a live zone, but iconIndex is a plain
  // array index with no referential guarantee) never draws a connector.
  expect(zoneConnectorVisible(zone, undefined)).toBe(false);
});

test('defense: zone connector stays visible after stretching the zone wide (regression for the reported bug)', async ({ page }) => {
  await openDesigner(page);

  await page.getByRole('button', { name: 'defense', exact: true }).click();
  await btn(page, 'Player S').click();
  const spot = await canvasPoint(page, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  let state = await canvasState(page);
  const iconPx = await canvasPoint(page, state.playerIcons[0].x, state.playerIcons[0].y);

  // Create a zone directly on the icon (creation always centers the zone on
  // its icon — see Canvas.tsx's zoneDraft) — big enough that its edge sits
  // well clear of the icon's own hit radius.
  await btn(page, 'Draw a zone of responsibility (drag from a player)').click();
  await page.mouse.move(iconPx.x, iconPx.y);
  await page.mouse.down();
  await page.mouse.move(iconPx.x + 90, iconPx.y + 60, { steps: 6 });
  await page.mouse.up();

  // Drag the zone body (not the icon — grabbed away from center, near the
  // right edge, so this can't land on the icon) straight up, away from the
  // icon, so a real vertical gap opens up. One continuous drag both selects
  // the zone and moves it, same as a coach dragging a freshly-drawn zone.
  await btn(page, 'Select / Move').click();
  state = await canvasState(page);
  const grabPx = await canvasPoint(page, state.zones[0].cx + state.zones[0].rx * 0.7, state.zones[0].cy);
  await page.mouse.move(grabPx.x, grabPx.y);
  await page.mouse.down();
  await page.mouse.move(grabPx.x, grabPx.y - 150, { steps: 8 });
  await page.mouse.up();

  state = await canvasState(page);
  const zoneAfterMove = state.zones[0];
  // The move actually landed on the zone, not the icon — the icon is still
  // where it was placed, and the zone center is now well above it.
  expect(state.playerIcons[0].y).toBeCloseTo(0.6, 1);
  expect(zoneAfterMove.cy).toBeLessThan(state.playerIcons[0].y - 0.05);
  expect(zoneConnectorVisible(zoneAfterMove, state.playerIcons[0])).toBe(true);

  // Now stretch the zone horizontally via its right-edge (x-axis) resize
  // handle — the exact action reported: "stretching the zone horizontally."
  const handlePx = await canvasPoint(page, zoneAfterMove.cx + zoneAfterMove.rx, zoneAfterMove.cy);
  await page.mouse.move(handlePx.x, handlePx.y);
  await page.mouse.down();
  await page.mouse.move(handlePx.x + 250, handlePx.y, { steps: 10 });
  await page.mouse.up();

  state = await canvasState(page);
  // The stretch actually landed…
  expect(state.zones[0].rx).toBeGreaterThan(zoneAfterMove.rx + 0.1);
  // …the resize handle only touched rx, not the vertical gap that makes the
  // connector meaningful…
  expect(state.zones[0].ry).toBeCloseTo(zoneAfterMove.ry, 5);
  expect(state.zones[0].cy).toBeCloseTo(zoneAfterMove.cy, 5);
  // …and the connector — the actual bug report — is still visible.
  expect(zoneConnectorVisible(state.zones[0], state.playerIcons[0])).toBe(true);
});
