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
    const canvasData = JSON.stringify({ version: 3, paths: play.paths, playerIcons: play.icons, zones: play.zones || [] });
    const { data, error } = await admin
      .from('plays')
      .insert({
        name: play.name,
        type: play.type || 'offense',
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
    // SavePlayModal now prefills Play Name/Game Type/Play Type/Formation/
    // Difficulty/Tags/Description/visibility straight from the play being
    // edited (fixed 2026-07-21 — it used to only ever prefill from account
    // preferences/hardcoded defaults, racing an async preferences fetch
    // that could stomp a manual fill). Since this play was just inserted
    // with the correct metadata, the modal should already show it with no
    // typing needed — verify that instead of re-entering everything, so a
    // regression in the prefill fails loudly instead of silently reverting
    // to defaults again.
    await page.locator('button[title="Save play"]:visible').click();
    await page.getByRole('heading', { name: 'Save Play' }).waitFor();

    const shown = {
      name: await page.getByPlaceholder('Enter play name...').inputValue(),
      gameType: await page.locator('select').nth(0).inputValue(),
      playType: await page.locator('select').nth(1).inputValue(),
      formation: await page.getByPlaceholder('e.g., I-Formation, Spread, etc.').inputValue(),
      difficulty: await page.locator('select').nth(2).inputValue(),
      isPublic: await page.locator('#isPublic').isChecked(),
    };
    const wantIsPublic = false; // every seeded play stays a private draft
    const mismatches = Object.entries({
      name: [shown.name, play.name],
      gameType: [shown.gameType, play.metadata.gameType],
      playType: [shown.playType, play.metadata.playType],
      formation: [shown.formation, play.metadata.formation],
      difficulty: [shown.difficulty, play.metadata.difficulty],
      isPublic: [shown.isPublic, wantIsPublic],
    }).filter(([, [got, want]]) => got !== want);
    if (mismatches.length > 0) {
      throw new Error(`"${play.name}": Save modal didn't prefill correctly — ${JSON.stringify(mismatches)}`);
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
