import { test, expect, type Page } from '@playwright/test';

/**
 * Designer chrome — the sidebar, header and mobile bar around the canvas.
 *
 * The sidebar was a column of hairline-divided rows; it is now grouped under
 * labeled sections (Draw / Route / Edit / Players — the real tool families),
 * with one shared active style and the brand display face on the title.
 * Restyling is exactly the kind of change that quietly drops a button, so the
 * first test walks every tool title the rest of the suite depends on.
 */

async function openDesigner(page: Page) {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));
  await expect(page.locator('#play-canvas')).toBeVisible();
}

/** Every always-present tool, by the title the suite selects it with.
 *  (Mirror appears only in Copy Route mode; Zone tools only for defense.) */
const TOOL_TITLES = [
  'Select / Move',
  'Add a text box (tap the field to place it)',
  'Snap to alignment',
  'Multi-Segment Route with sharp corners at each point (drag or tap to place points, double-tap to finish)',
  'Multi-Segment Route with smooth, curved corners at each point (drag or tap to place points, double-tap to finish)',
  'Ending style: Arrow / Block (perpendicular cap)',
  'Line style: Solid / Dotted / Motion',
  'Remove a route (tap the route)',
  'Recolor a route (tap the route)',
  'Copy a route (tap the route, then tap a player)',
  'Formation templates',
  'Undo',
  'Redo',
  'Clear Routes',
  'Clear All',
];

test('every tool survives the sidebar restructure, on desktop and in the mobile bar', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openDesigner(page);
    for (const title of TOOL_TITLES) {
      await expect(page.locator(`button[title="${title}"]:visible`).first(), title).toBeAttached();
    }
  }
});

test('the desktop sidebar groups tools under labeled sections', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDesigner(page);
  await expect(page.getByTestId('toolbar-section')).toHaveText(['Draw', 'Route', 'Edit', 'Players']);
});

test('the mobile bar has no section labels — dividers only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  // The desktop sidebar is CSS-hidden at this width, so its eyebrows are
  // still in the DOM — what matters is that none is VISIBLE: the mobile bar
  // renders dividers in their place.
  await expect(page.locator('[data-testid="toolbar-section"]:visible')).toHaveCount(0);
});

test('the header title is set in the brand display face', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDesigner(page);
  const family = await page.locator('header').getByText('Play Designer').first().evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family).toMatch(/Anton/);
});

test('.scrollbar-hide hides the tool-row scrollbar for a mouse/trackpad', async ({ page }) => {
  // It was referenced in the toolbar but defined nowhere — a no-op until now.
  // Playwright's default context is a fine pointer, so the rule applies here.
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesigner(page);
  const width = await page.locator('.scrollbar-hide').first().evaluate(
    (el) => getComputedStyle(el).scrollbarWidth,
  );
  expect(width).toBe('none');
});

test.describe('touch', () => {
  // hasTouch is what makes `pointer: coarse` evaluate true (a viewport size
  // alone does not) — see the note in CLAUDE.md.
  test.use({ hasTouch: true });

  test('.scrollbar-hide leaves touch devices alone (iOS Safari hit-testing)', async ({ page }) => {
    // Hiding the scrollbar on a real iPhone made the bottom rows' children
    // un-tappable until the row re-laid-out. Emulation cannot show that bug,
    // so this pins the rule that avoids it: no scrollbar hiding under a
    // coarse pointer.
    await page.setViewportSize({ width: 390, height: 844 });
    await openDesigner(page);
    const width = await page.locator('.scrollbar-hide').first().evaluate(
      (el) => getComputedStyle(el).scrollbarWidth,
    );
    expect(width).not.toBe('none');
  });
});

test('an armed Remove mode is the only time a tool goes amber', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDesigner(page);
  const remove = page.locator('button[title="Remove a route (tap the route)"]:visible').first();
  // At rest it looks like any other tool — no idle warning tint.
  await expect(remove).not.toHaveClass(/amber/);
  await remove.click();
  await expect(remove).toHaveClass(/amber/);
});
