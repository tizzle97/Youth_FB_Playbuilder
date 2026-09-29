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

/* ── iOS home-screen safe area ────────────────────────────────────────────
   Added to the home screen, the app runs standalone with
   apple-mobile-web-app-status-bar-style: black-translucent (index.html) —
   the page draws UNDER the iPhone status bar in that mode, unlike a normal
   Safari tab where the browser chrome already reserves that space. Navbar
   had a top-0 sticky bar with no top inset at all, so the hamburger button
   rendered directly under the status bar/notch: reported as blocked and
   unusable. `viewport-fit=cover` (also index.html) is what makes
   env(safe-area-inset-top) resolve to a real value instead of 0 in that
   mode; CDP's Emulation.setSafeAreaInsetsOverride simulates that value here
   since Chromium has no real notch to report one from on its own. */
test('mobile nav toggle clears the iOS status bar when the site is a home-screen app', async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 59, topMax: 59, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 },
  });

  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  const box = (await toggle.boundingBox())!;

  // The button's own top edge must clear the simulated 59px status bar —
  // this is the exact regression: the button used to sit at y < 59.
  expect(box.y, 'menu button rendered under the simulated status bar').toBeGreaterThanOrEqual(59);

  // And it must still actually work, not just be positioned correctly.
  await toggle.click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
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

test('community post card: edit/delete buttons stay inside the card with a long username', async ({ page }) => {
  // Regression: PostList's byline row (avatar/"Posted by"/username/"•") was
  // all shrink-0 except the trailing timestamp, and its flex-1 content
  // column was missing min-w-0 — so a long username could force the whole
  // header wider than the card, spilling the delete button's red highlight
  // past the card's own rounded border. See PostList.tsx.
  const userJson = {
    id: '44444444-4444-4444-4444-444444444444',
    aud: 'authenticated', role: 'authenticated', email: 'coach@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
  };
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 't', refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: userJson, storageKey: AUTH_STORAGE_KEY });

  // Catch-all first — see the sideways-scroll test's note above on why.
  await page.route('**/rest/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/user**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userJson) }));
  await page.route('**/rest/v1/posts**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      {
        id: 'post-1', user_id: userJson.id, title: 'Best blitz package for 5v5?',
        content: 'What do you all run on 3rd and long', upvotes: 3, downvotes: 0,
        created_at: '2025-09-01T00:00:00Z', updated_at: '2025-09-01T00:00:00Z',
      },
    ]) }));
  await page.route('**/rest/v1/rpc/get_community_authors**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: userJson.id, username: 'GoodtimeCharlieAndTheGang2026', avatar_url: null },
    ]) }));
  await page.route('**/rest/v1/comments**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  const deleteButton = page.getByTitle('Delete Post');
  await expect(deleteButton).toBeVisible();
  const card = page.locator('article').first();

  const cardBox = await card.boundingBox();
  const buttonBox = await deleteButton.boundingBox();
  if (!cardBox || !buttonBox) throw new Error('Expected both the card and delete button to have a layout box');

  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
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

/* ── PWA & mobile meta (B-45) ────────────────────────────────────────────────
   No theme-color meant mobile browser chrome stayed light against the dark
   app; no apple-touch-icon meant iOS "Add to Home Screen" fell back to a
   screenshot of the page (iOS doesn't rasterize SVG favicons); no manifest;
   no global tap-highlight/overscroll-behavior. */
test('theme-color and apple-touch-icon are present and resolve', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101D2E');

  const iconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(iconHref).toBeTruthy();
  const iconRes = await request.get(iconHref!);
  expect(iconRes.ok()).toBe(true);
  expect(iconRes.headers()['content-type']).toContain('image/png');
});

test('the web app manifest is linked and resolves to valid JSON with icons', async ({ page, request }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const res = await request.get(manifestHref!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.theme_color).toBe('#101D2E');
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);
});

test('taps get no default highlight flash and the page does not rubber-band', async ({ page }) => {
  await page.goto('/');

  const styles = await page.evaluate(() => ({
    tapHighlight: getComputedStyle(document.body).webkitTapHighlightColor,
    overscrollX: getComputedStyle(document.documentElement).overscrollBehaviorX,
    overscrollY: getComputedStyle(document.documentElement).overscrollBehaviorY,
  }));

  expect(styles.tapHighlight).toBe('rgba(0, 0, 0, 0)');
  expect(styles.overscrollX).toBe('none');
  expect(styles.overscrollY).toBe('none');
});

/** Mocks `/blog/:slug` with a single post (matches BlogPostPage's
 *  `.maybeSingle()` GET). Used by the markdown-rendering tests below. */
async function mockBlogPost(page: Page, overrides: Partial<{
  slug: string; title: string; content: string; description: string | null;
}>) {
  const post = {
    id: 'post-1',
    title: 'Test Post',
    content: '',
    slug: 'test-post',
    description: null,
    author_id: 'someone',
    published_at: '2025-09-01T00:00:00Z',
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2025-09-01T00:00:00Z',
    ...overrides,
  };
  await page.route('**/rest/v1/blog_posts**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(post) }));
  return post;
}

/* ── Blog markdown rendering (step 1 of the blog editorial redesign) ───────
   formatContent() used to split content on blank lines into identical <p>
   tags — no headings, lists, bold, or links were possible no matter what
   the content contained. These guard the replacement: a real CommonMark
   renderer (marked + sanitizeBlogHtml), a heuristic that promotes
   heading-shaped plain paragraphs to real <h2>s for the 13 already-published
   posts (and any future post the agent writes without markdown), and that
   raw HTML in content is neutered regardless of either path. */

test('blog markdown: headings, lists, bold, and links all render as real elements', async ({ page }) => {
  const post = await mockBlogPost(page, {
    slug: 'markdown-post',
    title: 'A post with real markdown',
    content:
      '## Section One\n\nSome **bold** text and a [designer](/designer) link.\n\n' +
      '### Subsection\n\n- a\n- b\n\n1. first\n2. second\n\n> a quote',
  });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  const article = page.locator('article');

  await expect(article.getByRole('heading', { level: 2, name: 'Section One' })).toBeVisible();
  await expect(article.getByRole('heading', { level: 3, name: 'Subsection' })).toBeVisible();
  await expect(article.locator('li')).toHaveCount(4); // 2 ul + 2 ol
  // exact: true — the post page's own in-content product CTA also links to
  // /designer with an accessible name containing "designer" ("Open the play
  // designer"), so a loose substring match here is ambiguous between the
  // two, unrelated links.
  await expect(article.getByRole('link', { name: 'designer', exact: true })).toBeVisible();
  await expect(article.locator('strong', { hasText: 'bold' })).toBeVisible();
  await expect(article.locator('blockquote')).toBeVisible();

  const bodyText = await article.innerText();
  expect(bodyText).not.toContain('##');
  expect(bodyText).not.toContain('**');
});

test('blog markdown: plain prose with no markdown still renders as real paragraphs', async ({ page }) => {
  // Most of the 13 live posts (and, if the authoring agent is never updated
  // to emit markdown, every future post) look exactly like this.
  const paragraphs = Array.from({ length: 6 }, (_, i) => `This is plain paragraph number ${i + 1} of the post.`);
  const post = await mockBlogPost(page, {
    slug: 'plain-prose-post',
    title: 'A post with plain prose',
    content: paragraphs.join('\n\n'),
  });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  const article = page.locator('article');
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();

  expect(await article.locator('p').count()).toBeGreaterThanOrEqual(5);
  await expect(article.locator('h2')).toHaveCount(0);
  const bodyText = await article.innerText();
  expect(bodyText).not.toContain('#');
});

test('blog markdown: heading-shaped plain paragraphs are promoted to real <h2>s', async ({ page }) => {
  // The load-bearing graceful-degradation guarantee: 5 of the 13 live posts
  // have section headings written as ordinary short paragraphs (no markdown
  // syntax at all) — promoteImplicitHeadings() must turn these into real
  // headings with zero data changes and zero agent involvement.
  const content = [
    'This is the lead paragraph introducing the topic in a sentence or two.',
    'Why this matters',
    'A paragraph explaining why the first heading-like line above matters, with enough text to read like real prose.',
    'The pre-snap clues',
    'A paragraph explaining the second heading-like line, again long enough to read as a real paragraph and not a heading itself.',
    'Putting it into practice',
    'A closing paragraph that wraps up the post with the third heading-like line already promoted above it.',
  ].join('\n\n');
  const post = await mockBlogPost(page, { slug: 'implicit-headings-post', title: 'Implicit headings', content });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  const article = page.locator('article');
  await expect(article.locator('h2')).toHaveCount(3);
  await expect(article.getByRole('heading', { level: 2, name: 'Why this matters' })).toBeVisible();
  await expect(article.getByRole('heading', { level: 2, name: 'The pre-snap clues' })).toBeVisible();
  await expect(article.getByRole('heading', { level: 2, name: 'Putting it into practice' })).toBeVisible();
});

test('blog markdown: raw HTML in content is neutered by sanitization', async ({ page }) => {
  const post = await mockBlogPost(page, {
    slug: 'malicious-post',
    title: 'A post with embedded HTML',
    content:
      'Some intro text.\n\n<script>window.__xssFired = true;</script>\n\n' +
      '<img src="x" onerror="window.__xssFired = true;">\n\nMore text after it.',
  });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('article')).toBeVisible();

  expect(await page.locator('article script').count()).toBe(0);
  expect(await page.locator('article [onerror]').count()).toBe(0);
  const fired = await page.evaluate(() => (window as unknown as { __xssFired?: boolean }).__xssFired);
  expect(fired).toBeUndefined();
});

test('blog cover art: the same slug renders identical art on the index card and the post hero', async ({ page }) => {
  // BlogCoverArt is a pure function of slug (blogCover.ts's coverParams), so
  // the same slug must produce byte-identical SVG geometry wherever it's
  // used — a reader should recognize a post by its cover.
  const post = {
    id: 'post-1', title: 'Determinism Post', slug: 'determinism-post', description: null,
    author_id: 'someone', published_at: '2025-09-01T00:00:00Z',
    created_at: '2025-09-01T00:00:00Z', updated_at: '2025-09-01T00:00:00Z',
    content: 'Some content for this post.',
  };
  await page.route('**/rest/v1/blog_posts**', (route) => {
    const isSingle = route.request().url().includes('slug=eq.');
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isSingle ? post : [post]),
    });
  });

  // stroke="#F8F6F1" (the hex form) selects the route path specifically —
  // the grid pattern's own <path> (inside <defs>) uses the rgba() form of
  // the same color and has fixed geometry regardless of slug, so matching
  // "any path" here would pass vacuously. Not scoped to `article`: the post
  // hero's cover sits in a sibling div before <article>.
  const routePath = 'svg path[stroke="#F8F6F1"]';

  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Determinism Post')).toBeVisible();
  const cardPathD = await page.locator(routePath).first().getAttribute('d');

  await page.goto('/blog/determinism-post', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Determinism Post' })).toBeVisible();
  const heroPathD = await page.locator(routePath).first().getAttribute('d');

  expect(cardPathD).toBeTruthy();
  expect(cardPathD).toBe(heroPathD);
});

test('blog post page: related posts and prev/next are populated from real sibling data, excluding the current post', async ({ page }) => {
  // Regression: prev/next was built from [...otherPosts, post] without
  // first excluding the current post from otherPosts — but otherPosts'
  // query has no slug filter, so it already included the current post,
  // putting it in the list twice. findIndex() then located the wrong
  // occurrence and "Previous" pointed at the post itself.
  const posts = [
    { id: 'p1', slug: 'oldest-post', title: 'Oldest Zone Defense Post', description: 'About zone defense.', content: 'zone defense content', author_id: 'x', published_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    { id: 'p2', slug: 'middle-post', title: 'Man-to-Man Defense Basics', description: 'About man defense.', content: 'man to man defense content', author_id: 'x', published_at: '2025-06-01T00:00:00Z', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z' },
    { id: 'p3', slug: 'newest-post', title: 'Newest Practice Drills', description: 'About practice.', content: 'practice drills content', author_id: 'x', published_at: '2025-09-01T00:00:00Z', created_at: '2025-09-01T00:00:00Z', updated_at: '2025-09-01T00:00:00Z' },
  ];
  await page.route('**/rest/v1/blog_posts**', (route) => {
    const url = route.request().url();
    if (url.includes('slug=eq.')) {
      const slug = decodeURIComponent(url.match(/slug=eq\.([^&]+)/)?.[1] ?? '');
      const match = posts.find((p) => p.slug === slug);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(match ?? null) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
  });

  await page.goto('/blog/middle-post', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Man-to-Man Defense Basics' })).toBeVisible();

  // Related: "Oldest Zone Defense Post" shares the Defense category with
  // this post (man-to-man); "Newest Practice Drills" doesn't. Scoped to the
  // "More from" card specifically — with only 3 posts in this fixture, the
  // same title also legitimately appears in prev/next below.
  const relatedCard = page.locator('text=More from the Playbook').locator('..');
  await expect(relatedCard.getByText('Oldest Zone Defense Post')).toBeVisible();

  // Prev/next must point at the two OTHER posts, never at the current one.
  await expect(page.getByText('Previous')).toBeVisible();
  await expect(page.getByText('Next')).toBeVisible();
  const prevNextText = await page.locator('nav[aria-label="More posts"]').innerText();
  expect(prevNextText).toContain('Oldest Zone Defense Post');
  expect(prevNextText).toContain('Newest Practice Drills');
  expect(prevNextText).not.toContain('Man-to-Man Defense Basics');
});

test('blog post page: sidebar (TOC, related, CTA) holds at 320px with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const posts = [
    { id: 'p1', slug: 'other-post', title: 'A Different Post About Zone Defense Concepts', description: 'zone defense', content: 'zone defense content', author_id: 'x', published_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    {
      id: 'p2', slug: 'main-post',
      title: 'A Very Long Post Title About Beating Zone Defense That Wraps Across Several Lines On A Narrow Phone Screen',
      description: 'zone defense', author_id: 'x',
      published_at: '2025-06-01T00:00:00Z', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z',
      content: [
        'Lead paragraph about zone defense concepts for this test post.',
        'First section heading', 'Body text for the first section, about zone defense.',
        'Second section heading', 'Body text for the second section, still about zone defense.',
        'Third section heading', 'Body text for the third section, wrapping up zone defense.',
      ].join('\n\n'),
    },
  ];
  await page.route('**/rest/v1/blog_posts**', (route) => {
    const url = route.request().url();
    if (url.includes('slug=eq.')) {
      const slug = decodeURIComponent(url.match(/slug=eq\.([^&]+)/)?.[1] ?? '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts.find((p) => p.slug === slug) ?? null) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) });
  });

  await page.goto('/blog/main-post', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('h2')).toHaveCount(3); // implicit headings promoted
  await expect(page.getByText('On this page')).toBeVisible();

  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW).toBeLessThanOrEqual(clientW + 1);
});

// These diagrams animate 'inView' (an IntersectionObserver) — the canvas
// stays at 0% draw progress (icons only, no route lines) until it's
// scrolled into the viewport. test.use({ reducedMotion: 'reduce' }) does
// NOT help here: verified directly that it doesn't propagate to
// window.matchMedia('(prefers-reduced-motion: reduce)') in this test
// environment (CDP media-emulation gaps are already documented elsewhere
// in this project for pointer/hover features — this is the same class of
// issue for reduced-motion). So these tests scroll the diagram into view
// for real, the same trigger a real reader's scroll gives it, then poll
// for the finished draw within the 1.1s animation.

test('blog embedded diagrams: a curated post gets its real play diagram, drawn with real route color', async ({ page }) => {
  const post = {
    id: 'p1', slug: 'flag-football-plays-beat-zone-defense', title: 'Flag Football Plays That Beat Zone Defense',
    description: 'zone defense plays', author_id: 'x',
    published_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    content: 'Intro paragraph about zone defense.\n\n## Flood (three levels to one side)\n\nBody text about the flood concept in this section.',
  };
  await page.route('**/rest/v1/blog_posts**', (route) => {
    const url = route.request().url();
    if (url.includes('slug=eq.')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(post) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([post]) });
  });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();

  // This slug is curated in blogDiagrams.ts's CURATED map with a "flood"
  // placement after a heading containing "Flood" — the mock content above
  // supplies that heading directly as real markdown (rather than relying on
  // promoteImplicitHeadings, which is exercised by other tests already).
  const diagram = page.locator('canvas[role="img"]');
  await expect(diagram).toHaveAttribute('aria-label', /flood/i);

  // Scroll it into view to actually trigger the 'inView' IntersectionObserver
  // — real user behavior, and the only reliable trigger in this environment.
  await diagram.scrollIntoViewIfNeeded();

  // Per CLAUDE.md: check the actual route color, not "any non-white
  // pixel" — the field's own grid lines would satisfy that trivially.
  // expect.poll() (not a one-shot read) rather than a fixed wait, since the
  // draw-in animation takes up to 1.1s — the same "poll, don't one-shot"
  // rule this project's test-bridge-race memory documents for the
  // __PBP_TEST__ bridge applies here too.
  await expect.poll(() =>
    diagram.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0x1f && data[i + 1] === 0xa7 && data[i + 2] === 0x5d) return true;
      }
      return false;
    }),
  ).toBe(true);
});

test('blog embedded diagrams: an uncurated post gets an automatic match when a concept word is strong-signal present', async ({ page }) => {
  const post = {
    id: 'p1', slug: 'some-post-about-mesh-concepts', title: 'How to Run the Mesh Concept in Flag Football',
    description: 'mesh routes', author_id: 'x',
    published_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    content: 'Intro paragraph explaining the mesh concept for youth flag football teams.',
  };
  await page.route('**/rest/v1/blog_posts**', (route) => {
    const url = route.request().url();
    if (url.includes('slug=eq.')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(post) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([post]) });
  });

  await page.goto(`/blog/${post.slug}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();
  // The mesh scene's alt text describes the concept rather than naming it
  // ("Two receivers crossing underneath..."), so assert on that text
  // (proving the resolver actually picked the mesh scene) rather than the
  // literal word "mesh".
  await expect(page.locator('canvas[role="img"]')).toHaveAttribute('aria-label', /crossing underneath/i);
});

/* ── Blog post typography on phones (B-49) ──────────────────────────────────
   `prose prose-invert` was inert (no `@tailwindcss/typography` plugin
   registered), so a post carrying a long unbroken token — a URL with no
   spaces — had nothing to wrap it and pushed the whole article sideways.
   The `/blog/<slug>` route wasn't in the existing "no page scrolls
   sideways" sweep (which only exercises unauthenticated fixed routes), so
   this regression had no guard at all. */
test('a long unbroken URL in a blog post does not push the page sideways', async ({ page }) => {
  const longUrl = 'https://example.com/' + 'a'.repeat(120) + '/deep/path/segment';
  await page.route('**/rest/v1/blog_posts**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'post-1',
        title: 'A post with a long link',
        content: `Check this out: ${longUrl}\n\nMore text after it.`,
        slug: 'long-link-post',
        description: null,
        author_id: 'someone',
        published_at: '2025-09-01T00:00:00Z',
        created_at: '2025-09-01T00:00:00Z',
        updated_at: '2025-09-01T00:00:00Z',
      }),
    }));

  await page.goto('/blog/long-link-post', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'A post with a long link' })).toBeVisible();

  // GFM now autolinks the bare URL into a real <a>, and the blog's link
  // behavior effect adds target/rel to it (DOMPurify strips those
  // attributes from content, so they're added post-sanitization) — assert
  // that happened, not just that the page didn't overflow.
  const link = page.locator('article a', { hasText: longUrl });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);

  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW, 'the long URL should wrap instead of widening the document').toBeLessThanOrEqual(clientW + 1);
});
