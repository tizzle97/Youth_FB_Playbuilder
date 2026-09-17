import { test, expect, type Page } from '@playwright/test';

/**
 * The wristband preview (src/components/WristbandPreview.tsx).
 *
 * "Wristband export" was a three-word bullet on the Pricing page and a Pro
 * lock in the export modal — nothing showed a coach what the format actually
 * produces, which is the one Pro feature you can't picture sight-unseen.
 *
 * These assert the preview renders the REAL export HTML (via an iframe running
 * generateWristbandHTML) in both places and both layouts, and that the locked
 * wristband option opens it rather than the generic upgrade prompt.
 */

const PREVIEW_FRAME = 'iframe[title="Wristband export preview"]';

/** The preview frame's own document, so tests assert on the real sheet markup
 *  rather than on our chrome around it. */
const sheet = (page: Page) => page.frameLocator(PREVIEW_FRAME);

test('pricing: the wristband section renders the real export sheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('What the wristband export gives you')).toBeVisible();

  const frame = page.locator(PREVIEW_FRAME);
  await expect(frame).toBeVisible();

  // Content from generateWristbandHTML itself, not from the React wrapper —
  // proves the preview is the actual export output.
  await expect(sheet(page).locator('.wb-insert').first()).toBeVisible();
  await expect(sheet(page).getByText(/Wristband Inserts/)).toBeVisible();

  // Sample plays are rendered by renderScene into the insert cells.
  await expect(sheet(page).locator('.wb-insert img').first()).toBeVisible();
});

test('pricing: the layout toggle switches between diagram and text-only sheets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(PREVIEW_FRAME)).toBeVisible();

  // Diagram mode: image cells, and the dashed-line cut instruction.
  await expect(sheet(page).locator('.wb-insert img').first()).toBeVisible();
  await expect(sheet(page).getByText(/cut along dashed lines/)).toBeVisible();

  await page.getByRole('button', { name: 'Text only' }).click();

  // Text-only is a fixed fill-in grid: no images, a "Play #" header, and a
  // different cut instruction (there are no dashed lines to cut along).
  await expect(sheet(page).getByText(/cut along the outer border/)).toBeVisible();
  await expect(sheet(page).locator('.wb-insert img')).toHaveCount(0);
  await expect(sheet(page).getByText('Play #').first()).toBeVisible();

  await page.getByRole('button', { name: 'With diagrams' }).click();
  await expect(sheet(page).locator('.wb-insert img').first()).toBeVisible();
});

test('designer: the locked Wristband Sheet opens a preview, not a bare paywall', async ({ page }) => {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByText('Wristband Sheet').first().click();

  // The preview panel, not UpgradePrompt.
  await expect(page.locator(PREVIEW_FRAME)).toBeVisible();
  await expect(sheet(page).locator('.wb-insert').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upgrade to Pro' })).toBeVisible();

  // And it still leads to the upgrade prompt when they want it.
  await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
  await expect(page.getByText('Wristband export is a Pro feature')).toBeVisible();
});

test('designer: Back returns to the format list without closing the modal', async ({ page }) => {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByText('Wristband Sheet').first().click();
  await expect(page.locator(PREVIEW_FRAME)).toBeVisible();

  // exact: the page also has "Back to Home" and the panel's own
  // "Back to export formats" close button.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator(PREVIEW_FRAME)).toHaveCount(0);
  await expect(page.getByText('Choose a print format:')).toBeVisible();
});

test('designer: the other Pro formats still go straight to the upgrade prompt', async ({ page }) => {
  await page.goto('/designer');
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_TEST__?: unknown }).__PBP_TEST__));

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByText('Detailed Playbook').first().click();

  // Regression guard: only the wristband format gets the preview detour.
  await expect(page.locator(PREVIEW_FRAME)).toHaveCount(0);
  await expect(page.getByText('Playbook PDF export is a Pro feature')).toBeVisible();
});
