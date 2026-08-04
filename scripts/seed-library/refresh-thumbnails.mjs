// Regenerates thumbnails for every play owned by the official account by
// opening each one in the real designer and clicking straight through
// Save/Update — the modal prefills from the play's saved values (fixed
// 2026-07-21), so nothing changes except the thumbnail, which re-renders
// through the app's own exportImage() path with the current field style.
//
// Written for the 2026-07-23 field redesign (17/13 window, sideline numbers,
// bold border): stored thumbnails predate it and would show the old field
// on library cards until re-rendered. Run AFTER
// scripts/migrate-field-depth-2026-07.mjs, never before — saving re-writes
// canvas_data through the app, so an unmigrated play would be saved with
// old-window coords stamped as the new version.
//
// Usage: node scripts/seed-library/refresh-thumbnails.mjs

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const OFFICIAL_ACCOUNT_EMAIL = 'system@playbook.pro';
const DEV_PORT = 4518;
const BASE_URL = `http://localhost:${DEV_PORT}`;

function loadEnv() {
  const env = {};
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const i = line.indexOf('=');
    if (i === -1) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() - start > timeoutMs) return reject(new Error(`dev server did not come up at ${url}`));
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: users } = await admin.auth.admin.listUsers();
  const sysUser = users.users.find((u) => u.email === OFFICIAL_ACCOUNT_EMAIL);
  if (!sysUser) throw new Error(`${OFFICIAL_ACCOUNT_EMAIL} not found`);

  const { data: plays, error } = await admin
    .from('plays')
    .select('id, name, is_public, canvas_data')
    .eq('user_id', sysUser.id)
    .order('created_at');
  if (error) throw new Error(error.message);
  console.log(`${plays.length} plays owned by ${OFFICIAL_ACCOUNT_EMAIL}.`);

  const unmigrated = plays.filter((p) => {
    try { return (JSON.parse(p.canvas_data || '{}').version ?? 0) < 4; } catch { return true; }
  });
  if (unmigrated.length > 0) {
    throw new Error(
      `${unmigrated.length} plays still have pre-migration coordinates (version < 4) — ` +
      `run scripts/migrate-field-depth-2026-07.mjs first: ${unmigrated.map((p) => p.name).join(', ')}`,
    );
  }

  console.log('Starting dev server...');
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(DEV_PORT), '--strictPort'], { stdio: 'pipe' });
  try {
    await waitForServer(BASE_URL);

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OFFICIAL_ACCOUNT_EMAIL });
    if (linkErr) throw new Error(linkErr.message);
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: linkData.properties.hashed_token });
    if (otpErr) throw new Error(otpErr.message);
    const session = otpData.session;

    const storageKey = `sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(
      ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
      { key: storageKey, session },
    );
    const page = await context.newPage();

    for (const play of plays) {
      await page.goto(`${BASE_URL}/designer?play=${play.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const bridge = window.__PBP_TEST__;
        return bridge ? bridge.getCanvasState().playerIcons.length > 0 : false;
      }, undefined, { timeout: 15_000 });
      await page.waitForLoadState('networkidle');

      await page.locator('button[title="Save play"]:visible').click();
      await page.getByRole('heading', { name: 'Save Play' }).waitFor();
      // is_public must round-trip untouched — published plays stay published.
      const isPublicShown = await page.locator('#isPublic').isChecked();
      if (isPublicShown !== play.is_public) {
        throw new Error(`"${play.name}": modal shows is_public=${isPublicShown}, DB says ${play.is_public} — prefill regression, aborting`);
      }
      await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
      await page.getByRole('button', { name: 'Save Play' }).click();
      await page.getByText('Play updated!').waitFor({ timeout: 10_000 });
      console.log(`  ✓ refreshed: ${play.name}${play.is_public ? ' (public)' : ''}`);
    }

    await browser.close();
  } finally {
    server.kill();
  }
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
