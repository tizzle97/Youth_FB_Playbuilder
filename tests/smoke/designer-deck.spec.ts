import { test, expect, type Page } from '@playwright/test';

/**
 * The canvas deck — the margin around the letterboxed field.
 *
 * The canvas is locked to the export aspect ratio (that is what keeps a
 * circular zone from printing as an ellipse), so on most window shapes there
 * is margin around it. That margin used to be the same #FFFFFF as the field,
 * with no frame between them: the two fused into one white slab from the
 * sidebar to the viewport edge. Now the margin is a designed navy deck and
 * the canvas sits on it as a framed object.
 */

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

test('the margin around the canvas is the navy deck, not white', async ({ page }) => {
  // A wide, short window — the shape with the most margin (~22% at 1920x1080).
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openDesigner(page);

  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('main')!).backgroundColor);
  // tailwind `board` = #101D2E
  expect(bg).toBe('rgb(16, 29, 46)');

  // And the aspect lock is untouched by the deck inset.
  const box = await page.locator('#play-canvas').boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(1650 / 1275, 2);
});

test('phones keep every pixel: no deck inset below the sm breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const { canvasW, mainW } = await page.evaluate(() => ({
    canvasW: document.getElementById('play-canvas')!.getBoundingClientRect().width,
    mainW: document.querySelector('main')!.clientWidth,
  }));
  // Width-bound on a phone: the canvas spans the container exactly.
  expect(canvasW).toBeCloseTo(mainW, 0);
});

test('the zoom pill stays on screen when the zoomed canvas overflows', async ({ page }) => {
  // The pill is anchored to the field's corner while the canvas fits, and
  // must snap to the container corner once it overflows — inside the scroll
  // container it would scroll away and zoom-out become unreachable without
  // panning. Playwright's click() auto-scrolls, which would hide exactly
  // that regression, so assert geometry directly instead of clicking.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Zoom in"]').click();
  await page.locator('button[title="Zoom in"]').click();
  await expect(page.locator('button[title="Reset zoom"]')).toHaveText('200%');

  const onScreen = await page.locator('button[title="Zoom out"]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
  });
  expect(onScreen).toBe(true);
});
