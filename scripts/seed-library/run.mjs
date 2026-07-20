// B-31 content-seeding pipeline: inserts PLAYS (plays.mjs) as private drafts
// under the official account, then drives the real running app in headless
// Chromium to generate each one's thumbnail through the app's own
// exportImage()-backed save path — so seeded plays render identically to
// user-made ones, per the backlog item's requirement. Nothing is made
// public; that's a manual review step in the designer afterward.
//
// Usage: node scripts/seed-library/run.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (bypasses RLS for the insert;
// the free-tier trigger still runs, but the official account is on the
// 'founding' plan so it's unaffected).
//
// Reusable for future batches (B-32's weekly library rider needs this same
// pipeline): swap plays.mjs's PLAYS export for a different batch and rerun.
// Re-running is NOT idempotent — it inserts a fresh row per play every time.

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { PLAYS } from './plays.mjs';

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

async function insertDrafts(admin, sysUserId) {
  const inserted = [];
  for (const play of PLAYS) {
    const canvasData = JSON.stringify({ version: 3, paths: play.paths, playerIcons: play.icons, zones: [] });
    const { data, error } = await admin
      .from('plays')
      .insert({
        name: play.name,
        type: 'offense',
        canvas_data: canvasData,
        description: play.metadata.description,
        user_id: sysUserId,
        thumbnail: null,
        is_public: false,
        metadata: play.metadata,
      })
      .select('id')
      .single();
    if (error) throw new Error(`insert failed for "${play.name}": ${error.message}`);
    inserted.push({ id: data.id, play });
    console.log(`  inserted draft: ${play.name} (${data.id})`);
  }
  return inserted;
}

async function mintSystemSession(admin, anonUrl, anonKey, email) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) throw new Error(`generateLink failed: ${linkErr.message}`);
  const anon = createClient(anonUrl, anonKey);
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (otpErr) throw new Error(`verifyOtp failed: ${otpErr.message}`);
  return otpData.session;
}

async function generateThumbnails(inserted, session, supabaseUrl) {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: storageKey, session },
  );
  const page = await context.newPage();

  for (const { id, play } of inserted) {
    await page.goto(`${BASE_URL}/designer?play=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (count) => {
        const bridge = window.__PBP_TEST__;
        return bridge ? bridge.getCanvasState().playerIcons.length === count : false;
      },
      play.icons.length,
      { timeout: 15_000 },
    );
    // SavePlayModal reloads account preferences async (user ->
    // getUserPreferences(user.id)) and has a useEffect that overwrites the
    // Game Type/Play Type fields with the (fresh-account) defaults whenever
    // that fetch resolves — which can race a fill no matter how it's
    // ordered. React StrictMode (src/main.tsx) double-invokes that effect
    // in dev, so there are actually *two* of these fetches per page load,
    // not one — waiting for a single matching response left the second one
    // free to land mid-fill and silently revert the selection (confirmed:
    // it did, twice, across two earlier attempts at this same fix).
    // Waiting for the network to go fully idle is the only version of this
    // that isn't a numbers game against however many requests StrictMode
    // happens to fire.
    await page.waitForLoadState('networkidle');

    await page.locator('button[title="Save play"]:visible').click();
    await page.getByPlaceholder('Enter play name...').fill(play.name);
    await page.getByPlaceholder('e.g., I-Formation, Spread, etc.').fill(play.metadata.formation);
    await page.locator('select').nth(2).selectOption(play.metadata.difficulty);
    for (const tag of play.metadata.tags) {
      await page.getByPlaceholder('Add tags (press Enter)').fill(tag);
      await page.getByPlaceholder('Add tags (press Enter)').press('Enter');
    }
    await page.getByPlaceholder('Describe the play strategy, timing, and execution...').fill(play.metadata.description);
    // is_public checkbox is left unchecked — stays a private draft.

    // Game Type / Play Type set LAST, right before advancing: SavePlayModal
    // reloads account preferences async and has a useEffect that overwrites
    // these two fields with the (fresh-account) defaults ('5v5'/'pass')
    // whenever that fetch resolves — which can race ahead of an early fill
    // and silently revert it. Filling last, after several other round trips
    // have already happened, reliably outruns that race.
    await page.locator('select').nth(0).selectOption(play.metadata.gameType);
    await page.locator('select').nth(1).selectOption(play.metadata.playType);
    const gameTypeSet = await page.locator('select').nth(0).inputValue();
    const playTypeSet = await page.locator('select').nth(1).inputValue();
    if (gameTypeSet !== play.metadata.gameType || playTypeSet !== play.metadata.playType) {
      throw new Error(
        `"${play.name}": Game Type/Play Type didn't stick (got ${gameTypeSet}/${playTypeSet}, ` +
        `wanted ${play.metadata.gameType}/${play.metadata.playType}) — the preferences-load race won anyway.`,
      );
    }

    await page.getByRole('button', { name: 'Next: Choose Playbook' }).click();
    await page.getByRole('button', { name: 'Save Play' }).click();
    await page.getByText('Play updated!').waitFor({ timeout: 10_000 });
    console.log(`  thumbnail generated: ${play.name}`);
  }

  await browser.close();
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: users, error: userErr } = await admin.auth.admin.listUsers();
  if (userErr) throw new Error(`listUsers failed: ${userErr.message}`);
  const sysUser = users.users.find((u) => u.email === OFFICIAL_ACCOUNT_EMAIL);
  if (!sysUser) throw new Error(`${OFFICIAL_ACCOUNT_EMAIL} not found`);
  console.log(`Official account: ${sysUser.email} (${sysUser.id})`);

  console.log(`\nInserting ${PLAYS.length} draft plays...`);
  const inserted = await insertDrafts(admin, sysUser.id);

  console.log('\nStarting dev server...');
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(DEV_PORT), '--strictPort'], { stdio: 'pipe' });
  try {
    await waitForServer(BASE_URL);
    console.log('Dev server up.');

    console.log('\nMinting session for the official account...');
    const session = await mintSystemSession(admin, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, OFFICIAL_ACCOUNT_EMAIL);

    console.log('\nGenerating thumbnails via the real designer...');
    await generateThumbnails(inserted, session, env.VITE_SUPABASE_URL);
  } finally {
    server.kill();
  }

  console.log('\nVerifying...');
  const { data: rows } = await admin
    .from('plays')
    .select('id, name, thumbnail, is_public')
    .in('id', inserted.map((i) => i.id));
  for (const row of rows) {
    const ok = Boolean(row.thumbnail) && row.is_public === false;
    console.log(`  ${ok ? '✓' : '✗'} ${row.name} — thumbnail: ${row.thumbnail ? 'yes' : 'NO'}, public: ${row.is_public}`);
  }

  console.log(`\nDone. ${inserted.length} plays seeded as private drafts under ${OFFICIAL_ACCOUNT_EMAIL}.`);
  console.log('Review each in the designer, then flip is_public to publish.');
}

main().catch((err) => {
  console.error('\nSeed pipeline failed:', err);
  process.exit(1);
});
