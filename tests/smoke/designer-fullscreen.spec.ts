import { test, expect, Page } from '@playwright/test';
import { createHash } from 'crypto';

/**
 * Full-screen designer: the field fills the screen, a decorative surround
 * continues its lines past the 30-yard play area, the view can be moved
 * around like a map, and the tools float in a draggable panel.
 *
 * None of that may reach a file: exports must stay byte-identical to what
 * they were before the surround existed (hashes recorded on main 2026-11-24,
 * before any rendering change).
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

const zoomLabel = (page: Page) => page.locator('button[title="Fit play to screen"]:visible').innerText();

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

// ── Full screen + surround ─────────────────────────────────────────────────

for (const size of SIZES) {
  test(`full screen at ${size.width}x${size.height}: the play fills one axis, centred, surround aligned`, async ({ page }) => {
    await page.setViewportSize(size);
    await openDesigner(page);
    await expect.poll(async () => {
      const b = await fieldBox(page);
      return Math.min(Math.abs(b.width - size.width), Math.abs(b.height - size.height));
    }).toBeLessThan(2);
    const b = await fieldBox(page);
    // Whole play visible and centred at the default (fit) view.
    expect(b.x).toBeGreaterThanOrEqual(-1);
    expect(b.y).toBeGreaterThanOrEqual(-1);
    expect(Math.abs(b.x + b.width / 2 - size.width / 2)).toBeLessThan(2);
    expect(Math.abs(b.y + b.height / 2 - size.height / 2)).toBeLessThan(2);

    // The backdrop drew around exactly where the play window is — polled,
    // since it redraws on the next frame.
    await expect.poll(async () => {
      const bd = await page.evaluate(() => (window as unknown as { __PBP_BACKDROP__?: { field: Box & { w: number; h: number } } }).__PBP_BACKDROP__);
      const f = await fieldBox(page);
      if (!bd) return 999;
      return Math.max(Math.abs(bd.field.x - f.x), Math.abs(bd.field.y - f.y), Math.abs(bd.field.w - f.width), Math.abs(bd.field.h - f.height));
    }).toBeLessThan(1);
  });
}

test('the surround is drawn (not blank) beyond the play window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const b = await fieldBox(page);
  // A point above the play window, between the sidelines: field white, not an
  // empty transparent canvas.
  const alpha = await page.evaluate(([x, y]) => {
    const c = document.querySelector('[data-testid="field-backdrop"]') as HTMLCanvasElement;
    return c.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1).data[3];
  }, [b.x + b.width / 2, b.y - 40]);
  expect(alpha).toBe(255);
});

// ── Moving around ──────────────────────────────────────────────────────────

test('at 1x the view moves in every direction, far enough to bring any field edge to the centre', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const v = await view(page);
  expect(v.scrollLeft).toBeGreaterThan(0);
  expect(v.scrollLeft).toBeLessThan(v.maxLeft);
  expect(v.scrollTop).toBeGreaterThan(0);
  expect(v.scrollTop).toBeLessThan(v.maxTop);
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft = 0; m.scrollTop = 0; });
  const b = await fieldBox(page);
  expect(Math.abs(b.x - v.vw / 2)).toBeLessThan(2);
  expect(Math.abs(b.y - v.vh / 2)).toBeLessThan(2);
});

test('Fit recentres the play after moving and zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Zoom in"]').click();
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft = 0; m.scrollTop = 0; });
  await page.locator('button[title="Fit play to screen"]').click();
  await expect(page.locator('button[title="Fit play to screen"]')).toHaveText('100%');
  await expect.poll(async () => {
    const b = await fieldBox(page);
    return Math.abs(b.x + b.width / 2 - 720) + Math.abs(b.y + b.height / 2 - 450);
  }).toBeLessThan(3);
});

test('dragging empty field in Select mode moves the view at 1x', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const before = await view(page);
  const b = await fieldBox(page);
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.6 - 120, b.y + b.height * 0.3 - 80, { steps: 6 });
  await page.mouse.up();
  const after = await view(page);
  expect(after.scrollLeft - before.scrollLeft).toBeCloseTo(120, -1);
  expect(after.scrollTop - before.scrollTop).toBeCloseTo(80, -1);
  expect((await state(page)).playerIcons).toHaveLength(0);
});

test('Space + drag moves the view while a drawing tool is active, and draws nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Player Q"]:visible').click();
  const b = await fieldBox(page);
  const q = { x: b.x + b.width * 0.5, y: b.y + b.height * 0.65 };
  await page.mouse.click(q.x, q.y);
  await page.locator('button[title^="Multi-Segment Route with sharp corners"]:visible').click();

  const before = await view(page);
  await page.locator('main').focus().catch(() => {});
  await page.keyboard.down('Space');
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x - 100, q.y - 60, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const after = await view(page);
  expect(after.scrollLeft - before.scrollLeft).toBeCloseTo(100, -1);
  expect(after.scrollTop - before.scrollTop).toBeCloseTo(60, -1);
  expect((await state(page)).paths).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Finish Route' })).toHaveCount(0);
});

test('Ctrl + wheel zooms at the cursor; a plain wheel scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  const b = await fieldBox(page);
  const at = { x: b.x + b.width * 0.3, y: b.y + b.height * 0.4 };
  await page.mouse.move(at.x, at.y);

  const before = await view(page);
  await page.mouse.wheel(0, 120);
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

test('a tap lands at the right field spot after the view has been moved', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Snap to alignment"]:visible').click(); // exact placement
  await page.evaluate(() => { const m = document.querySelector('main')!; m.scrollLeft -= 230; m.scrollTop -= 140; });
  await page.locator('button[title="Player R"]:visible').click();
  const b = await fieldBox(page);
  await page.mouse.click(b.x + b.width * 0.62, b.y + b.height * 0.7);
  await expect.poll(async () => (await state(page)).playerIcons.length).toBe(1);
  const [icon] = (await state(page)).playerIcons;
  expect(icon.x).toBeCloseTo(0.62, 2);
  expect(icon.y).toBeCloseTo(0.7, 2);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('two fingers moving together move the view, without zooming or drawing', async ({ page }) => {
    await openDesigner(page);
    const b = await fieldBox(page);
    const before = await view(page);
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await twoFingerGesture(page,
      [{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y }],
      [{ x: c.x - 40 - 60, y: c.y - 50 }, { x: c.x + 40 - 60, y: c.y - 50 }]);
    const after = await view(page);
    expect(after.scrollTop - before.scrollTop).toBeGreaterThan(30);
    expect(await zoomLabel(page)).toBe('100%');
    const s = await state(page);
    expect(s.playerIcons).toHaveLength(0);
    expect(s.paths).toHaveLength(0);
  });

  test('pinching zooms, keeping the field point between the fingers in place', async ({ page }) => {
    await openDesigner(page);
    const b = await fieldBox(page);
    const c = { x: b.x + b.width * 0.35, y: b.y + b.height * 0.5 };
    const before = await fieldPointAt(page, c.x, c.y);
    await twoFingerGesture(page,
      [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }],
      [{ x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y }]);
    await expect.poll(() => zoomLabel(page)).not.toBe('100%');
    const after = await fieldPointAt(page, c.x, c.y);
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.01);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.01);
  });

  test('one finger on the surround moves the view', async ({ page }) => {
    await openDesigner(page);
    const b = await fieldBox(page);
    const before = await view(page);
    // Above the play window, clear of the floating actions.
    const p = { x: 195, y: b.y - 60 };
    await page.touchscreen.tap(p.x, p.y); // no-op tap first: must not throw or draw
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 0 }] });
    for (let s = 1; s <= 8; s++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + s * 10, id: 0 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await view(page);
    expect(before.scrollTop - after.scrollTop).toBeGreaterThan(40);
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
  await page.mouse.move(g.x + 20, g.y + g.height / 2);
  await page.mouse.down();
  // (The panel is ~770px tall at 900px, so there's only ~120px of room to
  // move it down before it clamps.)
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
    targetPosition: { x: b.width * 0.8, y: b.height * 0.6 },
  });
  await expect.poll(async () => (await state(page)).playerIcons.length).toBe(1);
});
