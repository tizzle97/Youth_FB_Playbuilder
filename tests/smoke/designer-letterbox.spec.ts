import { test, expect, Page } from '@playwright/test';

/**
 * The designer's letterbox: the field is aspect-locked to the print sheet, so
 * the space around it is a navy "board" (it was bg-white, the field's own
 * color, and the two fused into one white slab). At sm+ the board also pads
 * the field, which the fit and the zoom-anchor math both have to account for.
 */

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
];

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

/** The scroll container's content box and the field's rect, in page px. */
function geometry(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#play-canvas') as HTMLElement;
    const main = canvas.closest('main') as HTMLElement;
    const cs = getComputedStyle(main);
    const m = main.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return {
      bg: cs.backgroundColor,
      content: {
        left: m.left + parseFloat(cs.paddingLeft),
        top: m.top + parseFloat(cs.paddingTop),
        right: m.right - parseFloat(cs.paddingRight),
        bottom: m.bottom - parseFloat(cs.paddingBottom),
      },
      field: { left: c.left, top: c.top, right: c.right, bottom: c.bottom, width: c.width, height: c.height },
    };
  });
}

for (const size of SIZES) {
  test(`letterbox is the board, and the field fits inside it at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openDesigner(page);
    // Polled: the fit lands via a layout effect + ResizeObserver.
    await expect.poll(async () => {
      const g = await geometry(page);
      return g.field.left >= g.content.left - 1 && g.field.right <= g.content.right + 1
        && g.field.top >= g.content.top - 1 && g.field.bottom <= g.content.bottom + 1;
    }).toBe(true);
    const g = await geometry(page);
    expect(g.bg).not.toBe('rgb(255, 255, 255)');
    // Still fills one axis — padding mustn't shrink the field more than it needs to.
    const slackX = (g.content.right - g.content.left) - g.field.width;
    const slackY = (g.content.bottom - g.content.top) - g.field.height;
    expect(Math.min(slackX, slackY)).toBeLessThan(2);
  });
}

test('a click at the field center still lands at 0.5/0.5 with the padding', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);
  await page.locator('button[title="Player Q"]:visible').click();
  const g = await geometry(page);
  await page.mouse.click((g.field.left + g.field.right) / 2, (g.field.top + g.field.bottom) / 2);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __PBP_TEST__: { getCanvasState: () => { playerIcons: { x: number; y: number }[] } } })
      .__PBP_TEST__.getCanvasState().playerIcons.length)).toBe(1);
  const [icon] = await page.evaluate(() =>
    (window as unknown as { __PBP_TEST__: { getCanvasState: () => { playerIcons: { x: number; y: number }[] } } })
      .__PBP_TEST__.getCanvasState().playerIcons);
  // Snap may nudge to the centerline/grid; it must not be off by the padding (16px ≈ 0.015).
  expect(Math.abs(icon.x - 0.5)).toBeLessThan(0.01);
  expect(Math.abs(icon.y - 0.5)).toBeLessThan(0.03);
});

test('zooming keeps the field point under the viewport center fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDesigner(page);

  /** Normalized field coords of the point at the scroll viewport's center. */
  const centerOnField = () => page.evaluate(() => {
    const canvas = document.querySelector('#play-canvas') as HTMLElement;
    const m = (canvas.closest('main') as HTMLElement).getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return { x: ((m.left + m.right) / 2 - c.left) / c.width, y: ((m.top + m.bottom) / 2 - c.top) / c.height };
  });

  await page.locator('button[title="Zoom in"]').click();
  await expect(page.locator('button[title="Reset zoom"]')).toHaveText('150%');
  const before = await centerOnField();
  await page.locator('button[title="Zoom in"]').click();
  await expect(page.locator('button[title="Reset zoom"]')).toHaveText('200%');
  const after = await centerOnField();
  // The un-padded math drifted by pad*(k-1) px — measured 0.0025 of the field here.
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.0012);
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.0012);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the mobile chip row is the topmost element where it is drawn', async ({ page }) => {
    // Emulation can't reproduce the iOS-only dead-row bug from PR #152, but it
    // does catch the board or its shadow covering the toolbar.
    await openDesigner(page);
    for (const title of ['Player Q', 'Player R', 'Defense']) {
      const el = page.locator(`button[title="${title}"]:visible, button:visible:has-text("${title}")`).first();
      const box = (await el.boundingBox())!;
      const hit = await page.evaluate(([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return e?.closest('button')?.getAttribute('title') ?? e?.closest('button')?.textContent ?? null;
      }, [box.x + box.width / 2, box.y + box.height / 2]);
      expect(hit?.toLowerCase()).toContain(title.toLowerCase());
    }
  });
});
