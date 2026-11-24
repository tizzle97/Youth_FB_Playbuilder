import { test, expect, Page } from '@playwright/test';
import { createHash } from 'crypto';

/**
 * Full-screen designer: the play area is the canvas and the screen is a window
 * onto it — by default it's drawn just large enough to cover the screen, so
 * every visible pixel is usable field, and the view moves around inside it.
 * The tools float in draggable panels.
 *
 * None of that may change a file: exports must stay byte-identical to what
 * they were before (hashes recorded on main 2026-11-24).
 */

type Bridge = {
  getCanvasState: () => { paths: unknown[]; playerIcons: { x: number; y: number }[]; zones: unknown[]; textBoxes: unknown[] };
  exportImage: (w?: number, h?: number) => string;
  loadState: (data: unknown) => void;
};
/** sha256 prefixes of exportImage(): empty field full-size, empty thumbnail,
 *  SEED full-size, SEED thumbnail — recorded on unmodified main (7a19b54,
 *  plus only this bridge's exportImage/loadState), with webfonts loaded:
 *  identical across 6 runs. (A first recording taken without waiting for
 *  fonts captured fallback-font yard numbers and was discarded.) */
const BASELINE_EXPORT_HASHES = ['8398983eeff134de', 'd27c10fd03771e8e', '13a1308279e6a30a', '33f1aaa35ed1d6a0'];

async function openDesigner(page: Page) {
  await page.addInitScript(() => localStorage.setItem('pbp-analytics-consent', 'denied'));
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

/** Every icon shape, every route style/cap, a zone and a text box. */
const SEED = {
  playerIcons: [
    { x: 0.5, y: 0.6, letter: 'C', color: '#000000', shape: 'square' },
    { x: 0.5, y: 0.68, letter: 'Q', color: '#3B82F6', shape: 'circle' },
    { x: 0.15, y: 0.6, letter: 'X', color: '#8B5CF6', shape: 'triangle' },
    { x: 0.85, y: 0.6, letter: 'Z', color: '#84CC16', shape: 'star' },
    { x: 0.7, y: 0.6, letter: 'Y', color: '#EC4899', shape: 'circle' },
  ],
  paths: [
    { points: [{ x: 0.15, y: 0.6 }, { x: 0.15, y: 0.3 }, { x: 0.3, y: 0.2 }], color: '#8B5CF6', startIconIndex: 2, mode: 'straight', capStyle: 'arrow', lineStyle: 'solid' },
    { points: [{ x: 0.85, y: 0.6 }, { x: 0.8, y: 0.35 }, { x: 0.6, y: 0.25 }], color: '#84CC16', startIconIndex: 3, mode: 'curved', capStyle: 'arrow', lineStyle: 'dotted' },
    { points: [{ x: 0.5, y: 0.6 }, { x: 0.5, y: 0.5 }], color: '#000000', startIconIndex: 0, mode: 'straight', capStyle: 'block', lineStyle: 'solid' },
    { points: [{ x: 0.7, y: 0.6 }, { x: 0.6, y: 0.45 }], color: '#EC4899', startIconIndex: 4, mode: 'straight', capStyle: 'arrow', lineStyle: 'motion' },
  ],
  zones: [{ iconIndex: 4, cx: 0.65, cy: 0.35, rx: 0.08, ry: 0.06, color: '#EC4899' }],
  textBoxes: [{ x: 0.3, y: 0.85, text: 'Trips Right Flood', color: '#000000', fontSize: 20 }],
};

async function exportHashes(page: Page) {
  const urls = await page.evaluate(async (seed) => {
    const b = (window as unknown as { __PBP_TEST__: Bridge }).__PBP_TEST__;
    // Text renders in a webfont; exporting before it loads changes the bytes
    // (seen under a loaded parallel run), so wait for fonts, then for the
    // seeded scene to actually be applied — not a fixed delay.
    await document.fonts.ready;
    const out: string[] = [b.exportImage(), b.exportImage(660, 510)];
    b.loadState(seed);
    const deadline = Date.now() + 5000;
    while (b.getCanvasState().playerIcons.length !== seed.playerIcons.length && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    out.push(b.exportImage(), b.exportImage(660, 510));
    return out;
  }, SEED);
  return urls.map((u) => createHash('sha256').update(u).digest('hex').slice(0, 16));
}

test('exports are byte-identical to before the full-screen surround', async ({ page }) => {
  await openDesigner(page);
  expect(await exportHashes(page)).toEqual(BASELINE_EXPORT_HASHES);
});

// ── Helpers ────────────────────────────────────────────────────────────────

type Box = { x: number; y: number; width: number; height: number };
const fieldBox = (page: Page) => page.locator('#play-canvas').boundingBox() as Promise<Box>;

function view(page: Page) {
  return page.evaluate(() => {
    const m = document.querySelector('main') as HTMLElement;
    return {
      scrollLeft: m.scrollLeft, scrollTop: m.scrollTop,
      maxLeft: m.scrollWidth - m.clientWidth, maxTop: m.scrollHeight - m.clientHeight,
      vw: m.clientWidth, vh: m.clientHeight,
    };
  });
}

function state(page: Page) {
  return page.evaluate(() => (window as unknown as { __PBP_TEST__: Bridge }).__PBP_TEST__.getCanvasState());
}

/** The % label (its title flips between the two toggle actions). */
const zoomButton = (page: Page) =>
  page.locator('button[title="Show the whole play"]:visible, button[title="Fill the screen"]:visible');
const zoomLabel = (page: Page) => zoomButton(page).innerText();

/** Normalized field coords of a client point. */
async function fieldPointAt(page: Page, x: number, y: number) {
  const b = await fieldBox(page);
  return { x: (x - b.x) / b.width, y: (y - b.y) / b.height };
}

/** Two touch points moving together (or apart) via CDP, as real fingers do. */
async function twoFingerGesture(
  page: Page,
  from: [{ x: number; y: number }, { x: number; y: number }],
  to: [{ x: number; y: number }, { x: number; y: number }],
  steps = 12,
) {
  const cdp = await page.context().newCDPSession(page);
  const pts = (t: number) => from.map((p, i) => ({
    x: p.x + (to[i].x - p.x) * t, y: p.y + (to[i].y - p.y) * t, id: i,
  }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(0) });
  for (let s = 1; s <= steps; s++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(s / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
];

// ── The play area covers the screen ────────────────────────────────────────

for (const size of SIZES) {
  test(`at ${size.width}x${size.height} the play area covers the whole screen, overflowing one way, centred`, async ({ page }) => {
    await page.setViewportSize(size);
    await openDesigner(page);
    await expect.poll(async () => {
      const b = await fieldBox(page);
      return Math.min(Math.abs(b.width - size.width), Math.abs(b.height - size.height));
    }).toBeLessThan(2);
    const b = await fieldBox(page);
    // Covers every pixel of the screen — no unusable space around it.
    expect(b.x).toBeLessThanOrEqual(0.5);
    expect(b.y).toBeLessThanOrEqual(0.5);
    expect(b.x + b.width).toBeGreaterThanOrEqual(size.width - 0.5);
    expect(b.y + b.height).toBeGreaterThanOrEqual(size.height - 0.5);
    // Centred on the overflowing axis.
    expect(Math.abs(b.x + b.width / 2 - size.width / 2)).toBeLessThan(2);
    expect(Math.abs(b.y + b.height / 2 - size.height / 2)).toBeLessThan(2);
    expect(await zoomLabel(page)).toBe('100%');
  });
}

test('the view stops at the play area edges — never shows space outside it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft = 0; });
  expect(Math.abs((await fieldBox(page)).x)).toBeLessThan(1);
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft = 1e6; });
  const b = await fieldBox(page);
  expect(Math.abs(b.x + b.width - 390)).toBeLessThan(1);
  // And on the axis it fits exactly, there's nothing to scroll at all.
  expect((await view(page)).maxTop).toBeLessThanOrEqual(1);
});

test('the % button toggles between the whole play and filling the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const fill = await fieldBox(page);
  await page.locator('button[title="Show the whole play"]').click();
  await expect.poll(async () => (await fieldBox(page)).height).toBeLessThan(901);
  const whole = await fieldBox(page);
  // Every bit of the play on screen, centred.
  expect(whole.x).toBeGreaterThanOrEqual(-0.5);
  expect(whole.y).toBeGreaterThanOrEqual(-0.5);
  expect(whole.x + whole.width).toBeLessThanOrEqual(1440.5);
  expect(whole.y + whole.height).toBeLessThanOrEqual(900.5);
  expect(Math.abs(whole.x + whole.width / 2 - 720)).toBeLessThan(2);
  await page.locator('button[title="Fill the screen"]').click();
  await expect.poll(async () => Math.round((await fieldBox(page)).width)).toBe(Math.round(fill.width));
  await expect(zoomButton(page)).toHaveText('100%');
});

// ── Moving around ──────────────────────────────────────────────────────────

test('dragging empty field in Select mode moves the view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const before = await view(page);
  await page.mouse.move(250, 300);
  await page.mouse.down();
  await page.mouse.move(130, 300, { steps: 6 });
  await page.mouse.up();
  const after = await view(page);
  expect(after.scrollLeft - before.scrollLeft).toBeCloseTo(120, -1);
  expect((await state(page)).playerIcons).toHaveLength(0);
});

test('Space + drag moves the view while a drawing tool is active, and draws nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Player Q"]:visible').click();
  const b = await fieldBox(page);
  const q = { x: b.x + b.width * 0.5, y: b.y + b.height * 0.6 };
  await page.mouse.click(q.x, q.y);
  await page.locator('button[title^="Multi-Segment Route with sharp corners"]:visible').click();

  const before = await view(page);
  await page.keyboard.down('Space');
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y - 60, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const after = await view(page);
  expect(after.scrollTop - before.scrollTop).toBeCloseTo(60, -1);
  expect((await state(page)).paths).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Finish Route' })).toHaveCount(0);
});

test('Ctrl + wheel zooms at the cursor; a plain wheel scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const b = await fieldBox(page);
  const at = { x: b.x + b.width * 0.3, y: 450 };
  await page.mouse.move(at.x, at.y);

  const before = await view(page);
  await page.mouse.wheel(0, 80);
  await expect.poll(async () => (await view(page)).scrollTop).toBeGreaterThan(before.scrollTop);
  expect(await zoomLabel(page)).toBe('100%');

  const pointBefore = await fieldPointAt(page, at.x, at.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(() => zoomLabel(page)).not.toBe('100%');
  const pointAfter = await fieldPointAt(page, at.x, at.y);
  expect(Math.abs(pointAfter.x - pointBefore.x)).toBeLessThan(0.003);
  expect(Math.abs(pointAfter.y - pointBefore.y)).toBeLessThan(0.003);
});

test('zooming out from the whole play keeps the point under the cursor (centring offset)', async ({ page }) => {
  // Crossing between "smaller than the screen" (centred, offset) and
  // "overflowing" is where the anchor maths has to account for the offset.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Show the whole play"]').click();
  const b = await fieldBox(page);
  const at = { x: b.x + b.width * 0.7, y: b.y + b.height * 0.35 };
  await page.mouse.move(at.x, at.y);
  const pointBefore = await fieldPointAt(page, at.x, at.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -60);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await fieldBox(page)).width).toBeGreaterThan(b.width + 50);
  const pointAfter = await fieldPointAt(page, at.x, at.y);
  expect(Math.abs(pointAfter.x - pointBefore.x)).toBeLessThan(0.003);
  expect(Math.abs(pointAfter.y - pointBefore.y)).toBeLessThan(0.003);
});

test('a tap lands at the right field spot after the view has been moved', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await page.locator('button[title="Snap to alignment"]:visible').click(); // exact placement
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft -= 230; });
  await page.locator('button[title="Player R"]:visible').click();
  const b = await fieldBox(page);
  // A point on screen, converted to its field fraction.
  const target = { x: 120, y: 420 };
  const expected = await fieldPointAt(page, target.x, target.y);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await state(page)).playerIcons.length).toBe(1);
  const [icon] = (await state(page)).playerIcons;
  expect(icon.x).toBeCloseTo(expected.x, 2);
  expect(icon.y).toBeCloseTo(expected.y, 2);
  expect(b.x).toBeLessThan(0); // the view really was moved off the left edge
});

test('the instruction and Finish/Cancel bars stay on screen and clear of the panels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  await page.locator('button[title="Player Q"]:visible').click();
  // The instruction bar ("Q selected · Tap the field…") is on screen, below
  // the floating actions.
  const pill = page.getByText(/selected/).first();
  await expect(pill).toBeVisible();
  const actions = (await page.getByRole('toolbar', { name: 'Play actions' }).boundingBox())!;
  const pb = (await pill.boundingBox())!;
  expect(pb.y).toBeGreaterThanOrEqual(actions.y + actions.height);
  expect(pb.y + pb.height).toBeLessThanOrEqual(844);

  // Start a route; Finish/Cancel sits above the dock, on screen.
  await page.mouse.click(195, 420);
  await page.locator('button[title^="Multi-Segment Route with sharp corners"]:visible').click();
  await page.mouse.click(195, 420);
  await page.waitForTimeout(450);
  await page.mouse.click(195, 330);
  const finish = page.getByRole('button', { name: 'Finish Route' });
  await expect(finish).toBeVisible();
  const fb = (await finish.boundingBox())!;
  const dock = (await page.getByRole('toolbar', { name: 'Tools' }).boundingBox())!;
  expect(fb.y + fb.height).toBeLessThanOrEqual(dock.y);
  expect(fb.y).toBeGreaterThan(0);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? '',
    [fb.x + fb.width / 2, fb.y + fb.height / 2]);
  expect(hit).toContain('Finish Route');
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('two fingers moving together move the view, without zooming or drawing', async ({ page }) => {
    await openDesigner(page);
    const before = await view(page);
    const c = { x: 195, y: 420 };
    await twoFingerGesture(page,
      [{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y }],
      [{ x: c.x - 40 - 90, y: c.y }, { x: c.x + 40 - 90, y: c.y }]);
    const after = await view(page);
    expect(after.scrollLeft - before.scrollLeft).toBeGreaterThan(50);
    expect(await zoomLabel(page)).toBe('100%');
    const s = await state(page);
    expect(s.playerIcons).toHaveLength(0);
    expect(s.paths).toHaveLength(0);
  });

  test('pinching zooms, keeping the field point between the fingers in place', async ({ page }) => {
    await openDesigner(page);
    const c = { x: 195, y: 420 };
    const before = await fieldPointAt(page, c.x, c.y);
    await twoFingerGesture(page,
      [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }],
      [{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }]);
    await expect.poll(() => zoomLabel(page)).not.toBe('100%');
    const after = await fieldPointAt(page, c.x, c.y);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.01);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.01);
  });

  test('every docked control is the topmost element where it is drawn', async ({ page }) => {
    await openDesigner(page);
    for (const title of ['Player Q', 'Player R', 'Save play', 'Export', 'Hide tools']) {
      const el = page.locator(`button[title="${title}"]:visible`).first();
      const box = (await el.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('title') ?? null,
        [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit, title).toBe(title);
    }
    const defense = page.getByRole('button', { name: 'Defense' }).first();
    const db = (await defense.boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? '',
      [db.x + db.width / 2, db.y + db.height / 2]);
    expect(hit.toLowerCase()).toContain('defense');
  });
});

// ── Floating tools ─────────────────────────────────────────────────────────

test('the tools panel drags, stays on screen, remembers its spot, and collapses', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const panel = page.getByRole('toolbar', { name: 'Tools' });
  const grip = page.locator('[title="Move tools"]');
  const start = (await panel.boundingBox())!;
  const g = (await grip.boundingBox())!;
  // (The panel is ~770px tall at 900px, so there's only ~120px of room to
  // move it down before it clamps.)
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 20 + 400, g.y + g.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const moved = (await panel.boundingBox())!;
  expect(moved.x - start.x).toBeCloseTo(400, -1);
  expect(moved.y - start.y).toBeCloseTo(60, -1);

  // Dragging far past the edge clamps it inside the viewport.
  const g2 = (await grip.boundingBox())!;
  await page.mouse.move(g2.x + 20, g2.y + g2.height / 2);
  await page.mouse.down();
  await page.mouse.move(5000, 5000, { steps: 4 });
  await page.mouse.up();
  const clamped = (await panel.boundingBox())!;
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(1440);
  expect(clamped.y + clamped.height).toBeLessThanOrEqual(900);

  await page.reload();
  await expect(page.locator('#play-canvas')).toBeVisible();
  await expect.poll(async () => (await page.getByRole('toolbar', { name: 'Tools' }).boundingBox())?.x).toBeCloseTo(clamped.x, 0);

  await page.locator('button[title="Hide tools"]').click();
  await expect(page.locator('button[title="Player Q"]')).toHaveCount(0);
  await page.locator('button[title="Show tools"]').click();
  await expect(page.locator('button[title="Player Q"]:visible')).toHaveCount(1);
});

test('a player chip dragged from the floating panel onto the field is placed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const b = await fieldBox(page);
  await page.locator('button[title="Player Z"]:visible').dragTo(page.locator('#play-canvas'), {
    targetPosition: { x: b.width * 0.8, y: -b.y + 450 },
  });
  await expect.poll(async () => (await state(page)).playerIcons.length).toBe(1);
});
