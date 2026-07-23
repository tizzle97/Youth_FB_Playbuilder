// One-shot data migration (2026-07-23): the designer field deepened from
// 15-up/10-down (25 yards) to 17-up/13-down (30 yards). Play coordinates are
// stored normalized 0–1 against the field window, so without this remap every
// existing play's icons/routes/zones would slide ~2 yards off their yard
// lines under the new geometry.
//
// Remap (keeps every point at its exact yards-from-LOS):
//   yards       = y_old * 25 - 15            (old window: LOS at 0.6)
//   y_new       = (yards + 17) / 30          => y_new = (y_old * 25 + 2) / 30
//   zone ry_new = ry_old * 25 / 30           (vertical radius keeps its yardage)
//   x / rx      unchanged                    (width semantics unchanged)
//
// Idempotent/re-runnable: only rows whose canvas_data.version is < 4 are
// touched, and migrated rows are stamped version 4 (the deployed app now
// saves version 4 in new-window coords). A stale pre-deploy browser tab
// still runs old code and writes version 3 in old-window coords — re-running
// this script any time later cleans those up, which is exactly why it keys
// on the version number instead of migrating blindly.
//
// Usage:
//   node scripts/migrate-field-depth-2026-07.mjs --dry-run   # print, no writes
//   node scripts/migrate-field-depth-2026-07.mjs             # migrate

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');

const OLD_ABOVE = 15, OLD_TOTAL = 25;
const NEW_ABOVE = 17, NEW_TOTAL = 30;

const remapY = (y) => (y * OLD_TOTAL + (NEW_ABOVE - OLD_ABOVE)) / NEW_TOTAL;
const remapRy = (ry) => (ry * OLD_TOTAL) / NEW_TOTAL;

function loadEnv() {
  const env = {};
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const i = line.indexOf('=');
    if (i === -1) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function migrateCanvasData(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch {
    return { skipped: 'unparseable' };
  }
  if ((parsed.version ?? 0) >= 4) return { skipped: 'already v4' };

  const icons = Array.isArray(parsed.playerIcons) ? parsed.playerIcons : [];
  const paths = Array.isArray(parsed.paths) ? parsed.paths : [];
  const zones = Array.isArray(parsed.zones) ? parsed.zones : [];

  const next = {
    ...parsed,
    version: 4,
    playerIcons: icons.map((i) => ({ ...i, y: remapY(i.y) })),
    paths: paths.map((p) => ({
      ...p,
      points: (p.points || []).map((pt) => ({ ...pt, y: remapY(pt.y) })),
    })),
    zones: zones.map((z) => ({ ...z, cy: remapY(z.cy), ry: remapRy(z.ry) })),
  };
  return { next };
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error } = await admin.from('plays').select('id, name, canvas_data');
  if (error) throw new Error(`fetch failed: ${error.message}`);
  console.log(`${rows.length} plays fetched. ${DRY_RUN ? '(DRY RUN — no writes)' : ''}`);

  let migrated = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const { next, skipped: why } = migrateCanvasData(row.canvas_data);
    if (!next) {
      skipped++;
      console.log(`  - skip "${row.name}" (${why})`);
      continue;
    }

    if (DRY_RUN) {
      const oldIcon = (JSON.parse(row.canvas_data).playerIcons || [])[0];
      const newIcon = next.playerIcons[0];
      console.log(
        `  ~ would migrate "${row.name}": ` +
        (oldIcon
          ? `icon0 y ${oldIcon.y.toFixed(4)} (${(oldIcon.y * OLD_TOTAL - OLD_ABOVE).toFixed(1)}yd) -> ` +
            `${newIcon.y.toFixed(4)} (${(newIcon.y * NEW_TOTAL - NEW_ABOVE).toFixed(1)}yd)`
          : 'no icons'),
      );
      migrated++;
      continue;
    }

    const { error: upErr } = await admin
      .from('plays')
      .update({ canvas_data: JSON.stringify(next) })
      .eq('id', row.id);
    if (upErr) {
      failed++;
      console.error(`  ✗ FAILED "${row.name}": ${upErr.message}`);
    } else {
      migrated++;
      console.log(`  ✓ migrated "${row.name}"`);
    }
  }

  console.log(`\n${DRY_RUN ? 'Would migrate' : 'Migrated'}: ${migrated}, skipped: ${skipped}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
