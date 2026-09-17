import { test, expect, type Page } from '@playwright/test';

/**
 * Retina backing for the designer canvas (Canvas.tsx draw()).
 *
 * Until this change the canvas backing store was CSS pixels, so on a 2x
 * display every 1px yard line was resampled to a grey smear — the soft,
 * washed-out texture that reads as "not premium". /vs already backed its
 * canvas at device resolution; the designer now does too.
 *
 * ⚠ Playwright's default deviceScaleFactor is 1, under which backing == CSS
 * px and none of this is exercised. Every test here opts into 2x.
 */
test.use({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });

type CanvasState = { playerIcons: Array<{ x: number; y: number }> };

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

/** Backing-store size vs. the element's CSS size, read from the live canvas. */
function backing(page: Page) {
  return page.evaluate(() => {
    const c = document.getElementById('play-canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { bw: c.width, bh: c.height, cssW: r.width, cssH: r.height };
  });
}

async function canvasPoint(page: Page, fx: number, fy: number) {
  const box = await page.locator('#play-canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

test('the canvas is backed at 2x device pixels on a retina display', async ({ page }) => {
  await openDesigner(page);
  const b = await backing(page);
  expect(b.bw).toBe(Math.round(b.cssW * 2));
  expect(b.bh).toBe(Math.round(b.cssH * 2));
});

test('hit-testing is unaffected by the backing scale', async ({ page }) => {
  await openDesigner(page);
  // Pointer math normalizes against getBoundingClientRect(), never
  // canvas.width — a click at the field's center must store 0.5, 0.5 exactly
  // as it did before the backing store doubled.
  await page.locator('button[title="Player Q"]:visible').first().click();
  const spot = await canvasPoint(page, 0.5, 0.5);
  await page.mouse.click(spot.x, spot.y);
  const state = await canvasState(page);
  expect(state.playerIcons).toHaveLength(1);
  expect(state.playerIcons[0].x).toBeCloseTo(0.5, 1);
  expect(state.playerIcons[0].y).toBeCloseTo(0.5, 1);
});

test('retina never removes a zoom level, and the backing store stays under budget', async ({ page }) => {
  await openDesigner(page);

  // Zoom steps are decided in CSS px (PlayDesigner's MAX_CANVAS_PIXELS) and
  // must not shrink because the display is 2x — the first step is still 150%.
  await page.locator('button[title="Zoom in"]').click();
  await expect(page.locator('button[title="Reset zoom"]')).toHaveText('150%');

  // The device-pixel budget is the separate clamp: at 1280x900 and 1.5x the
  // canvas is ~2M CSS px, so 2x backing (~8M) still fits and stays sharp.
  const b = await backing(page);
  expect(b.bw).toBe(Math.round(b.cssW * 2));
  expect(b.bw * b.bh).toBeLessThanOrEqual(16_000_000);
  // Never below 1x whatever the clamp does.
  expect(b.bw).toBeGreaterThanOrEqual(Math.floor(b.cssW));
});
