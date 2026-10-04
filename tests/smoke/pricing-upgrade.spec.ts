import { test, expect } from '@playwright/test';

/**
 * Upgrade from the homepage Pricing section while signed out.
 *
 * Paid ads land visitors here signed out, and create-checkout-session 401s
 * without an account — so the Upgrade button used to dead-end in "Could not
 * start checkout". It must route to sign-up instead, carrying the visitor back
 * to `/?upgrade=pro`, where Pricing reopens the consent step once signed in.
 *
 * The Upgrade button only exists with VITE_BILLING_ENABLED=true; with it off
 * the card reads "Coming soon" and these skip. To run them, start the dev
 * server yourself with the flag on — the config reuses an existing server:
 *
 *   VITE_BILLING_ENABLED=true npm run dev -- --port 4517 --strictPort
 *   npx playwright test tests/smoke/pricing-upgrade.spec.ts
 */

const UPGRADE = /Upgrade to Pro/;
const CONSENT = 'Confirm your Pro subscription';

/** Whether billing is on here. Waits for the Pro card to render first — a bare
 *  count() right after goto can run before React mounts and skip wrongly. */
async function billingOn(page: import('@playwright/test').Page) {
  await expect(page.getByText('Simple Pricing')).toBeAttached();
  return (await page.getByRole('button', { name: UPGRADE }).count()) > 0;
}

test('signed-out Upgrade goes to sign-up with the Pro return path, not checkout', async ({ page }) => {
  let checkoutCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('create-checkout-session')) checkoutCalls++;
  });

  await page.goto('/#pricing');
  test.skip(!(await billingOn(page)), 'billing disabled in this environment');
  const upgrade = page.getByRole('button', { name: UPGRADE });

  // The #pricing anchor (used by ad links) actually scrolls there.
  await expect(upgrade).toBeInViewport();

  await upgrade.click();
  await expect(page).toHaveURL(/\/auth\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBe('signup');
  expect(url.searchParams.get('intent')).toBe('pro');
  expect(url.searchParams.get('next')).toBe('/?upgrade=pro');

  // The visitor is told why they're signing up, in both modes.
  await expect(page.getByText(/Step 1 of 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/Sign in, then you'll continue to/)).toBeVisible();

  expect(checkoutCalls).toBe(0);
});

test('?upgrade=pro does nothing for a signed-out visitor', async ({ page }) => {
  await page.goto('/?upgrade=pro');
  test.skip(!(await billingOn(page)), 'billing disabled in this environment');
  // Give the entitlement read time to resolve, then confirm no consent modal.
  await page.waitForTimeout(1000);
  await expect(page.getByText(CONSENT)).toHaveCount(0);
  await expect(page).toHaveURL(/upgrade=pro/);
});

test('plain sign-up shows no Pro banner', async ({ page }) => {
  await page.goto('/auth?mode=signup');
  await expect(page.getByText('Create your account')).toBeVisible();
  await expect(page.getByText(/Pro checkout/)).toHaveCount(0);
});
