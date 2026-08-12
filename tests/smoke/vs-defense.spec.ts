import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';

// Same session-seeding trick as designer.spec.ts — supabase-js reads the
// session from localStorage under a key derived from VITE_SUPABASE_URL.
const SUPABASE_URL = readFileSync('.env', 'utf-8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim() ?? '';
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Smoke coverage for the read-only "vs. defense" view (/vs?play=…), where a
 * coach cycles defensive plays over one offensive play to teach QB reads.
 *
 * Assertions read real scene state through the dev-only `window.__PBP_VS_TEST__`
 * bridge (VsDefenseView.tsx) — no pixel sampling. The thing most worth
 * protecting is that cycling swaps the *defense* while leaving the offense
 * untouched, which a screenshot would never catch.
 */

const USER = {
  id: '44444444-4444-4444-4444-444444444444',
  aud: 'authenticated', role: 'authenticated', email: 'vs-coach@example.com',
  app_metadata: {}, user_metadata: {}, created_at: '2025-09-01T00:00:00Z',
};

const scene = (letters: string[], y: number) =>
  JSON.stringify({
    version: 4,
    playerIcons: letters.map((letter, i) => ({ x: 0.2 + i * 0.15, y, letter, color: '#3B82F6' })),
    paths: [], zones: [], textBoxes: [],
  });

const OFFENSE = {
  id: 'off-1', name: 'Smash Concept', type: 'offense', description: null,
  metadata: { gameType: '5v5' }, canvas_data: scene(['Q', 'C', 'X', 'Y', 'Z'], 0.62),
};

const DEFENSES = [
  { id: 'def-1', name: 'Cover 2 Zone', type: 'defense', description: 'Two deep halves',
    metadata: { gameType: '5v5' }, canvas_data: scene(['D', 'CB', 'CB', 'S', 'S'], 0.45) },
  { id: 'def-2', name: 'Man Blitz', type: 'defense', description: null,
    metadata: { gameType: '5v5' }, canvas_data: scene(['D', 'D', 'CB', 'LB'], 0.48) },
  // Deliberately malformed: must be dropped from the deck, not crash the page.
  { id: 'def-3', name: 'Corrupt Look', type: 'defense', description: null,
    metadata: null, canvas_data: '{not json' },
];

type VsState = {
  offenseIcons: Array<{ letter: string }>;
  defenseIcons: Array<{ letter: string }>;
  defenseId: string | null;
  deckLength: number;
  index: number;
  showDefense: boolean;
  notesOpen: boolean;
  noteDraft: string;
  noteSaveState: 'idle' | 'saving' | 'saved' | 'error';
  hasNoteForCurrentDefense: boolean;
};

async function mockBackend(page: Page, defenses: typeof DEFENSES, seededNotes: { defense_play_id: string; note: string }[] = []) {
  await page.addInitScript(({ user, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'test-access-token', refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user,
    }));
  }, { user: USER, storageKey: AUTH_STORAGE_KEY });

  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }));

  // Both play queries hit /rest/v1/plays — the offense fetch is a .single()
  // keyed by id, the deck fetch filters type=eq.defense.
  await page.route('**/rest/v1/plays**', (route) => {
    const url = route.request().url();
    const body = url.includes('type=eq.defense') ? JSON.stringify(defenses) : JSON.stringify(OFFENSE);
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  // matchup_notes: GET returns the seeded deck of notes; any write (upsert/
  // delete) is just acknowledged — the UI updates its own local map from the
  // response of the action that triggered it, not a refetch.
  await page.route('**/rest/v1/matchup_notes**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seededNotes) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
}

function vsState(page: Page): Promise<VsState> {
  return page.evaluate(() =>
    (window as unknown as { __PBP_VS_TEST__: { getState: () => unknown } }).__PBP_VS_TEST__.getState(),
  ) as Promise<VsState>;
}

async function openVs(page: Page, query = `?play=${OFFENSE.id}`) {
  await page.goto(`/vs${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as { __PBP_VS_TEST__?: unknown }).__PBP_VS_TEST__));
  // The bridge mounts on first render, while the view is still "Loading…" —
  // the canvas only appears once the play and the defensive deck have loaded,
  // so wait on it or every assertion reads an empty pre-fetch scene.
  await expect(page.locator('#vs-canvas')).toBeVisible();
}

test('overlays a defense on the offense and cycles without disturbing the offense', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  await mockBackend(page, DEFENSES);
  await openVs(page);

  const first = await vsState(page);
  // The malformed third row is dropped, the two good ones survive.
  expect(first.deckLength).toBe(2);
  expect(first.offenseIcons.map((i) => i.letter)).toEqual(['Q', 'C', 'X', 'Y', 'Z']);
  expect(first.defenseIcons.map((i) => i.letter)).toEqual(['D', 'CB', 'CB', 'S', 'S']);
  await expect(page.locator('#vs-defense-label')).toContainText('Cover 2 Zone');
  await expect(page.getByText('1 of 2', { exact: false })).toBeVisible();

  // Arrow key advances the defense only.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#vs-defense-label')).toContainText('Man Blitz');
  const second = await vsState(page);
  expect(second.defenseIcons.map((i) => i.letter)).toEqual(['D', 'D', 'CB', 'LB']);
  expect(second.offenseIcons).toEqual(first.offenseIcons);
  expect(second.index).toBe(1);

  // Wraps around at the end of the deck.
  await page.keyboard.press('ArrowRight');
  expect((await vsState(page)).index).toBe(0);
  // …and backwards off the front.
  await page.keyboard.press('ArrowLeft');
  expect((await vsState(page)).index).toBe(1);

  // Hiding the defense leaves the offense rendered on its own.
  await page.getByRole('button', { name: /hide defense/i }).click();
  const hidden = await vsState(page);
  expect(hidden.showDefense).toBe(false);
  expect(hidden.defenseIcons).toEqual([]);
  expect(hidden.offenseIcons).toEqual(first.offenseIcons);

  expect(errors, 'no uncaught page errors').toEqual([]);
});

test('?d= restores a specific matchup on reload', async ({ page }) => {
  await mockBackend(page, DEFENSES);
  await openVs(page, `?play=${OFFENSE.id}&d=def-2`);

  const state = await vsState(page);
  expect(state.defenseId).toBe('def-2');
  await expect(page.locator('#vs-defense-label')).toContainText('Man Blitz');

  // Cycling keeps the URL pointed at what's on screen, so a refresh is stable.
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/d=def-1/);
});

test('with no saved defenses, the offense still renders and prompts to create one', async ({ page }) => {
  await mockBackend(page, []);
  await openVs(page);

  const state = await vsState(page);
  expect(state.deckLength).toBe(0);
  expect(state.offenseIcons.map((i) => i.letter)).toEqual(['Q', 'C', 'X', 'Y', 'Z']);
  expect(state.defenseIcons).toEqual([]);
  await expect(page.getByRole('link', { name: /create a defense/i })).toBeVisible();
});

test('B-36: per-matchup coaching notes load, edit, save, and stay scoped per defense', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  // Cover 2 Zone (def-1, first in the deck) already has a note; Man Blitz
  // (def-2) doesn't.
  await mockBackend(page, DEFENSES, [{ defense_play_id: 'def-1', note: 'Seeded note for Cover 2' }]);
  await openVs(page);

  const initial = await vsState(page);
  expect(initial.defenseId).toBe('def-1');
  expect(initial.hasNoteForCurrentDefense).toBe(true);

  // Closed by default; opening loads the existing note into the draft.
  expect(initial.notesOpen).toBe(false);
  await page.getByRole('button', { name: /notes/i }).click();
  expect((await vsState(page)).notesOpen).toBe(true);
  await expect(page.locator('#matchup-note-textarea')).toHaveValue('Seeded note for Cover 2');

  // Edit and save (blur triggers the save, same as clicking the Save button).
  await page.locator('#matchup-note-textarea').fill('vs Cover 2, hit the flat');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect((await vsState(page)).noteDraft).toBe('vs Cover 2, hit the flat');

  // Switching to the other defense shows its own (empty) note, not a leak
  // from the one just edited.
  await page.getByRole('button', { name: 'Next defense' }).click();
  await expect(page.locator('#vs-defense-label')).toContainText('Man Blitz');
  const onSecond = await vsState(page);
  expect(onSecond.hasNoteForCurrentDefense).toBe(false);
  expect(onSecond.noteDraft).toBe('');
  await expect(page.locator('#matchup-note-textarea')).toHaveValue('');

  // Switching back shows the edit that was just saved.
  await page.getByRole('button', { name: 'Previous defense' }).click();
  await expect(page.locator('#matchup-note-textarea')).toHaveValue('vs Cover 2, hit the flat');
  expect((await vsState(page)).hasNoteForCurrentDefense).toBe(true);

  expect(errors, 'no uncaught page errors').toEqual([]);
});

test('B-36 (1): export is Pro-gated — free accounts see the upgrade prompt', async ({ page }) => {
  await mockBackend(page, DEFENSES);
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }));
  await openVs(page);

  await page.getByRole('button', { name: /^export$/i }).click();
  await expect(page.getByText('Matchup export is a Pro feature')).toBeVisible();
  await expect(page.getByText('Export Matchup')).toHaveCount(0);

  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByText('Matchup export is a Pro feature')).toHaveCount(0);
});

test('B-36 (1): Pro accounts can download the current matchup and print the whole deck', async ({ page }) => {
  await mockBackend(page, DEFENSES);
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'pro', current_period_end: null }),
    }));
  await openVs(page);

  await page.getByRole('button', { name: /^export$/i }).click();
  await expect(page.getByText('Export Matchup')).toBeVisible();
  await expect(page.getByText('Whole deck (2 defenses)')).toBeVisible();

  // Download PNG renders offense + the defense currently on screen (Cover 2
  // Zone, first in the sorted deck) to a fixed-resolution offscreen canvas
  // and triggers a native download rather than a popup.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('smash-concept-vs-cover-2-zone.png');
});

test('B-36 (1): export modal has no "whole deck" section when the deck is empty', async ({ page }) => {
  await mockBackend(page, []);
  await page.route('**/rest/v1/subscriptions**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'pro', current_period_end: null }),
    }));
  await openVs(page);

  await page.getByRole('button', { name: /^export$/i }).click();
  await expect(page.getByText('Export Matchup')).toBeVisible();
  await expect(page.getByText('This matchup')).toBeVisible();
  await expect(page.getByText(/Whole deck/)).toHaveCount(0);
});
