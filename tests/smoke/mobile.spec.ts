import { test, expect } from '@playwright/test';

/**
 * Mobile shell regressions. These are the bugs a normal smoke test cannot see:
 * an element buried under a fixed overlay still passes `toBeVisible()`, and a
 * `@media (pointer: coarse)` rule never activates under Playwright's default
 * desktop emulation — so a fix keyed on it would appear tested while actually
 * being inert.
 */

/**
 * `hasTouch` is what makes `pointer: coarse` / `hover: none` evaluate true —
 * and it is the ONLY thing that does. `setViewportSize` alone leaves the page
 * on a fine pointer, and CDP `Emulation.setEmulatedMedia` silently ignores the
 * `pointer`/`hover` features (verified: it reports false for both). Without
 * this every coarse-pointer fix below would look tested while being inert, so
 * each test asserts a real consequence rather than trusting the emulation.
 */
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

test('the touch media queries are actually active in this suite', async ({ page }) => {
  await page.goto('/');
  expect(
    await page.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      noHover: matchMedia('(hover: none)').matches,
    })),
  ).toEqual({ coarse: true, noHover: true });
});

test('the feedback button is tappable, not buried under the cookie banner', async ({ page }) => {
  // Regression: the banner is `fixed bottom-0 z-50` and stacks to ~130px on a
  // phone; the FAB was `fixed bottom-4 right-4 z-40` — entirely inside the
  // banner's footprint at a LOWER z-index, so every first-time mobile visitor
  // had no way to reach it. toBeVisible() passes for an occluded element,
  // which is exactly why this shipped: only hit-testing catches it.
  await page.goto('/');

  const banner = page.getByText('We use Google Analytics');
  await expect(banner).toBeVisible();

  const fab = page.getByRole('button', { name: 'Give Feedback' });
  await expect(fab).toBeVisible();

  const box = (await fab.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Whatever the browser would deliver the tap to must be the button itself.
  const hitsFab = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      return Boolean(el?.closest('button[aria-label="Give Feedback"]'));
    },
    [cx, cy],
  );
  expect(hitsFab, 'the cookie banner is covering the feedback button').toBe(true);

  // And it actually opens.
  await fab.click();
  await expect(page.getByRole('dialog', { name: 'Give Feedback' })).toBeVisible();
});

test('dismissing the cookie banner drops the feedback button back down', async ({ page }) => {
  // The offset is driven by a consent subscription rather than a one-shot
  // localStorage read, so the button has to move without a reload.
  await page.goto('/');

  const fab = page.getByRole('button', { name: 'Give Feedback' });
  const raised = (await fab.boundingBox())!;

  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByText('We use Google Analytics')).toHaveCount(0);

  await expect
    .poll(async () => (await fab.boundingBox())!.y, { message: 'FAB should move back down' })
    .toBeGreaterThan(raised.y);
});

test('touch devices get 16px form controls so iOS does not zoom the page', async ({ page }) => {
  // iOS Safari zooms the whole page when a focused control is under 16px and
  // never zooms back out. The Community tab's formation <select> is `text-sm`
  // (14px) and is one of ~10 such controls; a single coarse-pointer rule in
  // index.css covers all of them.

  // The formation <select> only renders once some play carries a formation,
  // so the fixture needs one.
  await page.route('**/rest/v1/plays**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'pub-1', name: 'Trips Right', type: 'offense', thumbnail: null,
        is_public: true, upvotes: 3, user_id: 'someone-else',
        metadata: { formation: 'Trips', gameType: '7v7' },
      }]),
    }));

  await page.goto('/plays?tab=community');
  const select = page.locator('select').first();
  await expect(select).toBeVisible();

  const fontSize = await select.evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe('16px');
});

test('the mobile nav toggle is labelled, reports state, and closes on navigation', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Open menu' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  const box = (await toggle.boundingBox())!;
  expect(box.width, 'toggle width').toBeGreaterThanOrEqual(44);
  expect(box.height, 'toggle height').toBeGreaterThanOrEqual(44);

  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu')).toBeVisible();

  // Navigating from inside the menu closes it...
  await page.locator('#mobile-menu').getByRole('link', { name: 'Blog' }).click();
  await expect(page.locator('#mobile-menu')).toHaveCount(0);

  // ...and so does browser-back, which previously left it hanging open over
  // the new page because nothing watched location.pathname.
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#mobile-menu')).toHaveCount(0);
});

test('Escape closes the mobile nav menu', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).toHaveCount(0);
});

test('navigating to a new route scrolls back to the top', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 600));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Blog' }).click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
