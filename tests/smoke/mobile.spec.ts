import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';

// supabase-js reads its session from localStorage under a key derived from
// VITE_SUPABASE_URL — same seeding trick as designer.spec.ts.
const SUPABASE_URL = readFileSync('.env', 'utf-8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? '';
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

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

test('no page scrolls sideways at phone width', async ({ page }) => {
  // /playbooks used to put 458px of content in a 375px viewport — a whole
  // document that scrolled horizontally — from one non-wrapping button
  // cluster. Nothing caught it because every individual element was "visible".
  // Asserting document width is the cheap guard that would have.
  const userJson = {
    id: '22222222-2222-2222-2222-222222222222',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 't', refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });

  // Catch-all for anything the pages above reach for that isn't named here —
  // play_votes, the community-author RPC, reputation. Unmocked, these go to
  // whatever VITE_SUPABASE_URL points at, and against a placeholder host they
  // don't fail fast, they hang: the nightly routine reported this test as a
  // 30s page.goto timeout on /plays?tab=community when nothing was wrong with
  // the app. A test that depends on the network reaching a real backend isn't
  // testing what it claims to.
  //
  // Registered FIRST on purpose: Playwright checks route handlers in reverse
  // registration order, so the specific mocks below take precedence over this.
  await page.route('**/rest/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/admin_users**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/subscriptions**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'founding' }) }));
  await page.route('**/rest/v1/user_preferences**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/playbooks**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'pb-1', name: 'Game Plan', description: '', created_at: '2025-09-01T00:00:00Z', user_id: userJson.id, playbook_plays: [{ count: 1 }] },
    ]) }));
  await page.route('**/rest/v1/plays**', (r) => {
    if (r.request().method() === 'HEAD') {
      return r.fulfill({ status: 200, headers: { 'content-range': '*/1', 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'play-a', name: 'Trips Right Zip Motion Y Corner', type: 'offense', thumbnail: null, is_public: true, upvotes: 5, user_id: userJson.id, metadata: { formation: 'Trips', gameType: '7v7' } },
    ]) });
  });

  for (const route of ['/', '/plays', '/plays?tab=community', '/playbooks', '/account', '/community', '/blog']) {
    // domcontentloaded, not the default 'load': a single slow font or image
    // shouldn't decide whether a layout assertion gets to run.
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(scrollW, `${route} scrolls horizontally at ${clientW}px`).toBeLessThanOrEqual(clientW + 1);
  }
});

test('navigating to a new route scrolls back to the top', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 600));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Blog' }).click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});


/* ── Touch-target floor (B-51) ─────────────────────────────────────────────
   Fitts' Law: a fingertip needs ~44px. This walks the app's main surfaces
   under touch emulation and fails on ANY interactive control smaller than
   that, rather than spot-checking a hand-written list — the list I worked
   from was three days stale and had already drifted through two refactors.
   The `.tap-target` utility is coarse-pointer-gated, so none of this changes
   desktop density. */
const TT_USER = {
  id: '88888888-8888-8888-8888-888888888888',
  aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
  app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
};

const TT_PLAYS = [
  { id: 'p1', name: 'Trips Right', type: 'offense', thumbnail: null, is_public: true, upvotes: 5, user_id: TT_USER.id, description: 'x', created_at: '2025-09-01T00:00:00Z', metadata: { formation: 'Trips', gameType: '7v7' } },
  { id: 'p2', name: 'Cover 3', type: 'defense', thumbnail: null, is_public: false, upvotes: 0, user_id: TT_USER.id, description: '', created_at: '2025-09-02T00:00:00Z', metadata: {} },
];

async function seedForTapTargets(page: Page) {
  await page.addInitScript(({ user, storageKey }: any) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 't', refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: TT_USER, storageKey: AUTH_STORAGE_KEY });
  const j = (b: any) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  // Registered first so the specific mocks below win — Playwright checks route
  // handlers in reverse registration order. See the overflow test's note.
  await page.route('**/rest/v1/**', (r) => r.fulfill(j([])));
  await page.route('**/auth/v1/user**', (r) => r.fulfill(j(TT_USER)));
  await page.route('**/rest/v1/admin_users**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/subscriptions**', (r) => r.fulfill(j({ plan: 'founding' })));
  await page.route('**/rest/v1/user_preferences**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.route('**/rest/v1/play_votes**', (r) => r.fulfill(j([])));
  await page.route('**/rest/v1/posts**', (r) => r.fulfill(j([
    { id: 'post-1', user_id: TT_USER.id, title: 'Best 5v5 blitz?', content: 'What do you run', upvotes: 3, downvotes: 0, created_at: '2025-09-01T00:00:00Z', updated_at: '2025-09-01T00:00:00Z' },
  ])));
  await page.route('**/rest/v1/comments**', (r) => r.fulfill(j([])));
  await page.route('**/rest/v1/votes**', (r) => r.fulfill(j([])));
  await page.route('**/rest/v1/user_reputation**', (r) => r.fulfill(j([])));
  await page.route('**/rest/v1/playbooks**', (r) => r.fulfill(j([
    { id: 'pb-1', name: 'Game Plan', description: '', created_at: '2025-09-01T00:00:00Z', user_id: TT_USER.id, playbook_plays: [{ count: 2 }] },
  ])));
  await page.route('**/rest/v1/playbook_plays**', (r) => r.fulfill(j(
    TT_PLAYS.map((p, i) => ({ id: `pp-${i}`, play_id: p.id, order_position: (i + 1) * 10, plays: p })),
  )));
  await page.route('**/rest/v1/plays**', (r) => {
    if (r.request().method() === 'HEAD') {
      return r.fulfill({ status: 200, headers: { 'content-range': `*/${TT_PLAYS.length}`, 'access-control-expose-headers': 'content-range' }, body: '' });
    }
    return r.fulfill(j(TT_PLAYS));
  });
  await page.route('**/rest/v1/rpc/**', (r) => r.fulfill(j([])));
}


const TT_ROUTES = ['/', '/plays', '/plays?tab=community', '/playbooks', '/community', '/account', '/designer'];

test('every interactive control clears 44px under touch', async ({ page }) => {
  await seedForTapTargets(page);

  const undersized: string[] = [];
  for (const route of TT_ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // The designer mounts its canvas and toolbars asynchronously.
    await page.waitForTimeout(route === '/designer' ? 1200 : 700);

    const found = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('button, a[title], [role="button"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;      // not rendered
        if (r.width >= 44 && r.height >= 44) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        const label = el.getAttribute('title') || el.getAttribute('aria-label') ||
          (el.textContent || '').trim().slice(0, 30) || el.className.toString().slice(0, 50);
        out.push(`${Math.round(r.width)}x${Math.round(r.height)} "${label}"`);
      });
      return [...new Set(out)];
    });
    undersized.push(...found.map((f) => `${route}  ${f}`));
  }

  expect(undersized).toEqual([]);
});

/* ── Modals on phones (B-43) ────────────────────────────────────────────────
   PostFormModal centered itself with `min-h-screen` (100vh), which fights the
   viewport shrink an iOS keyboard causes — the layout kept assuming full
   viewport height while the visual viewport shrank underneath it — and had no
   Escape handling. Both are fixed: the modal now centers with real flexbox
   inside a max-h-[90vh] card instead of a 100vh assumption, and Escape closes
   it via the shared useEscapeKey hook. */
test('Create Post modal: Escape closes it, and the close button survives a keyboard-sized viewport', async ({ page }) => {
  await seedForTapTargets(page);
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Create Post' }).click();
  await expect(page.getByRole('heading', { name: 'Create Post' })).toBeVisible();

  // Simulate the visual viewport an iOS keyboard leaves behind — the failure
  // mode was a 100vh centering assumption that didn't shrink with it.
  await page.setViewportSize({ width: 375, height: 260 });

  const closeButton = page.getByRole('button', { name: 'Close' });
  const box = (await closeButton.boundingBox())!;
  expect(box.y, 'close button should be within the shrunk viewport').toBeGreaterThanOrEqual(0);
  expect(box.y, 'close button should be within the shrunk viewport').toBeLessThan(260);

  const hitsCloseButton = await page.evaluate(
    ([x, y]) => Boolean(document.elementFromPoint(x as number, y as number)?.closest('button[aria-label="Close"]')),
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hitsCloseButton, 'close button should not be covered by scrolled-over content').toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Create Post' })).toHaveCount(0);
});

/* ── Auth form autofill (B-44) ──────────────────────────────────────────────
   AuthPage.tsx reused one <input> for both sign-in and sign-up, hardcoded to
   autoComplete="current-password" — so a password manager offered to *fill*
   a password on signup instead of *generating* one, since "current-password"
   tells it this account already exists. The username field carried no
   autoComplete/autoCapitalize/autoCorrect/spellCheck at all, so iOS
   capitalized the first letter of every new username. */
test('signup password field asks for a new password, not the current one', async ({ page }) => {
  await page.goto('/auth?mode=signup');

  const password = page.locator('#password');
  await expect(password).toHaveAttribute('autocomplete', 'new-password');

  const username = page.locator('#username');
  await expect(username).toHaveAttribute('autocomplete', 'username');
  await expect(username).toHaveAttribute('autocapitalize', 'none');
  await expect(username).toHaveAttribute('autocorrect', 'off');
  await expect(username).toHaveAttribute('spellcheck', 'false');
});

test('sign-in password field still asks for the current password', async ({ page }) => {
  await page.goto('/auth');

  const password = page.locator('#password');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
});
