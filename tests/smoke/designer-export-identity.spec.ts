import { test, expect, type Page } from '@playwright/test';

/**
 * The export must be the white printed-playbook page no matter what the
 * on-screen canvas is drawing.
 *
 * renderScene() gained a `fieldTheme` option so the live designer can draw
 * on dark turf; exports, stored thumbnails, PDF sheets and wristband cells
 * all take the default 'print' theme. This is the one place the suite
 * deliberately samples pixels, because pixels ARE the contract here: an
 * export that came out dark would print a black page.
 *
 * (Full byte-identity against the pre-theme renderer was proven once with a
 * hash harness during the change; this guards the invariant going forward.)
 */

type Bridge = { __PBP_TEST__: { exportImage: (w?: number, h?: number) => string } };

/** Decode a PNG data URL in the page and read one pixel plus its size. */
async function samplePng(page: Page, dataUrl: string, x: number, y: number) {
  return page.evaluate(
    async ({ url, px, py }) => {
      const blob = await (await fetch(url)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(px, py, 1, 1).data;
      return { w: bmp.width, h: bmp.height, r: d[0], g: d[1], b: d[2], a: d[3] };
    },
    { url: dataUrl, px: x, py: y },
  );
}

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

test('exportImage() is 1650x1275 and white, whatever the screen shows', async ({ page }) => {
  await openDesigner(page);
  const url = await page.evaluate(() => (window as unknown as Bridge).__PBP_TEST__.exportImage());
  expect(url.startsWith('data:image/png;base64,')).toBe(true);

  // (2,2) is inside the field but outside the sideline border inset (8px at
  // REF_SIZE, ~17px at export scale) — pure page white on the print theme.
  const px = await samplePng(page, url, 2, 2);
  expect(px).toEqual({ w: 1650, h: 1275, r: 255, g: 255, b: 255, a: 255 });
});

test('the live canvas draws dark turf while the export stays white', async ({ page }) => {
  await openDesigner(page);

  // Top edge, horizontal center: inside the field, above the sideline pad's
  // chalk border, on either the turf base or a mow stripe — both deep green.
  const screen = await page.evaluate(() => {
    const c = document.getElementById('play-canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(Math.round(c.width / 2), 2, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  });
  expect(screen.g).toBeGreaterThan(screen.r);
  expect(Math.max(screen.r, screen.g, screen.b)).toBeLessThan(96);

  // …and the very same canvas's export is still the white page.
  const url = await page.evaluate(() => (window as unknown as Bridge).__PBP_TEST__.exportImage());
  const px = await samplePng(page, url, 2, 2);
  expect(px).toEqual({ w: 1650, h: 1275, r: 255, g: 255, b: 255, a: 255 });
});

test('the stored-thumbnail size renders white too', async ({ page }) => {
  await openDesigner(page);
  // PlayDesigner persists exportImage(660, 510) to plays.thumbnail.
  const url = await page.evaluate(() => (window as unknown as Bridge).__PBP_TEST__.exportImage(660, 510));
  const px = await samplePng(page, url, 2, 2);
  expect(px).toEqual({ w: 660, h: 510, r: 255, g: 255, b: 255, a: 255 });
});
