/**
 * Regenerates src/lib/wristbandDemo.ts from the real seeded play library.
 *
 * The wristband preview used to render a dozen plays I wrote by hand, which
 * were a poor imitation of content that already exists: the official library
 * (GitHub issue #89, seeded via scripts/seed-library/) is live in production
 * under system@playbook.pro with real formations, real spacing and reviewed
 * route concepts. This pulls a curated flag-football slice of it into a
 * checked-in module so the preview shows genuine plays.
 *
 * Snapshot, not a live fetch, on purpose: the Pricing page is marketing and
 * must render instantly, signed-out and offline, with no spinner and no
 * dependency on a play staying published. Re-run this when you want to
 * refresh the set:
 *
 *     node scripts/extract-demo-plays.mjs
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env (same as scripts/seed-library).
 * Writes the file and prints what it picked; safe to re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'src/lib/wristbandDemo.ts');

const PROJECT_REF = 'nlfwfbbpcvyfyugxiysz';
/** The official library account that owns the seeded plays. */
const SYSTEM_EMAIL = 'system@playbook.pro';

/**
 * Curated order, not just a query result. The preview crops to ONE insert,
 * which holds 8 diagram cells, so the first eight are chosen to show eight
 * different looks — six distinct formations across 5v5 and 7v7, plus a screen
 * and a motion play so it isn't all dropback passing. The last four only
 * appear in the text-only layout (20 rows), where more names is better.
 *
 * Flag formats only (5v5/7v7): this app's audience is flag and youth coaches,
 * wristbands are overwhelmingly a flag tool, and 11v11 diagrams carry an
 * offensive line that turns muddy at 4.5in x 2.2in.
 */
const WANTED = [
  'Double Slants',
  'Trips Z-Curl',
  'Quick Out & Up',
  'Stick-Nod',
  'Post-Wheel',
  'Mesh',
  'Motion Return',
  'Center Screen (5v5)',
  'Four Verts (7v7)',
  'Wheel Route',
  'Post-Corner',
  'RB Swing Screen (7v7)',
];

/** The seeding pipeline suffixes names to disambiguate formats in the admin
 *  library ("Center Screen (5v5)"). On a coach's wristband that reads as
 *  clutter, so strip it for display. */
const displayName = (name) => name.replace(/\s*\((?:5v5|6v6|7v7|11v11)\)\s*$/i, '').trim();

/** Trim float noise from normalized coords — these came out of a canvas drag,
 *  so they carry 16 digits of precision that nothing needs. */
const round = (n) => Math.round(n * 1e4) / 1e4;
const pt = (p) => ({ x: round(p.x), y: round(p.y) });

function env(key) {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
  const line = raw.split('\n').find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from .env`);
  return line.slice(key.length + 1).trim();
}

async function rest(path, key) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const KEY = env('SUPABASE_SERVICE_ROLE_KEY');

const users = await rest('/auth/v1/admin/users?per_page=200', KEY);
const system = (users.users ?? users).find((u) => (u.email ?? '') === SYSTEM_EMAIL);
if (!system) throw new Error(`no ${SYSTEM_EMAIL} account found`);

const rows = await rest(
  `/rest/v1/plays?user_id=eq.${system.id}&is_public=eq.true&type=eq.offense&select=name,canvas_data,metadata`,
  KEY,
);

const byName = new Map(rows.map((r) => [r.name, r]));
const missing = WANTED.filter((n) => !byName.has(n));
if (missing.length) {
  throw new Error(
    `These plays are no longer public under ${SYSTEM_EMAIL}: ${missing.join(', ')}\n` +
      `Pick replacements from:\n  ${rows.map((r) => r.name).sort().join('\n  ')}`,
  );
}

const picked = WANTED.map((name) => {
  const row = byName.get(name);
  const canvas = JSON.parse(row.canvas_data);
  const meta = row.metadata ?? {};
  if (canvas.zones?.length) {
    // Offensive plays shouldn't carry coverage ellipses; the preview renders
    // paths + icons only, so flag it rather than silently dropping them.
    console.warn(`  ! ${name} has ${canvas.zones.length} zone(s), not rendered in the preview`);
  }
  return {
    name: displayName(name),
    formation: meta.formation ?? '',
    gameType: meta.gameType ?? '',
    icons: (canvas.playerIcons ?? []).map((i) => ({
      ...pt(i),
      letter: i.letter,
      color: i.color,
      ...(i.shape ? { shape: i.shape } : {}),
    })),
    paths: (canvas.paths ?? []).map((p) => ({
      points: (p.points ?? []).map(pt),
      color: p.color,
      ...(p.startIconIndex === undefined ? {} : { startIconIndex: p.startIconIndex }),
      mode: p.mode ?? 'straight',
      ...(p.capStyle ? { capStyle: p.capStyle } : {}),
      ...(p.dashed ? { dashed: true } : {}),
    })),
  };
});

const body = picked
  .map(
    (p) => `  {
    // ${p.gameType} · ${p.formation}
    name: ${JSON.stringify(p.name)},
    icons: ${JSON.stringify(p.icons)},
    paths: ${JSON.stringify(p.paths)},
  },`,
  )
  .join('\n');

const file = `import { renderScene } from './renderPlayScene';
import type { PathItem, PlayerIcon } from './renderPlayScene';

/**
 * Sample plays for the wristband preview (see components/WristbandPreview).
 *
 * ⚠ GENERATED FILE — do not hand-edit the DEMO_PLAYS data below.
 * Regenerate with:  node scripts/extract-demo-plays.mjs
 *
 * These are a curated flag-football slice of the real seeded play library
 * (issue #89), pulled from the official plays published under
 * ${SYSTEM_EMAIL} — genuine formations and route concepts rather than
 * approximations written for a mockup. A snapshot rather than a live query so
 * the Pricing page renders instantly, signed-out and offline, and so the
 * smoke tests are deterministic.
 *
 * Used only where the viewer has no plays of their own to show (the Pricing
 * page, and a signed-out or nearly-empty designer). Rendered by the same
 * renderScene the designer and every export use, so a preview built from
 * these is a real render of real play data.
 */

type DemoPlay = { name: string; icons: PlayerIcon[]; paths: PathItem[] };

const DEMO_PLAYS: DemoPlay[] = [
${body}
];

/** Matches PlayDesigner's own thumbnail size (exportImage(660, 510)), so a
 *  demo cell and a real play's thumbnail land in the wristband at the same
 *  resolution. */
const THUMB_W = 660;
const THUMB_H = 510;

export type PreviewPlay = { name: string; image: string };

let cached: PreviewPlay[] | null = null;

/**
 * Render the sample plays to PNG data URIs, the same shape a saved play's
 * \`thumbnail\` has. Memoized — the result is identical every call and each
 * render is a full field draw.
 *
 * Returns names with empty images if a 2D context isn't available (jsdom, a
 * locked-down browser); generateWristbandHTML renders its own placeholder for
 * a falsy image, and text-only mode never needs one.
 */
export function demoWristbandPlays(): PreviewPlay[] {
  if (cached) return cached;
  cached = DEMO_PLAYS.map(({ name, icons, paths }) => {
    let image = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderScene(ctx, THUMB_W, THUMB_H, paths, icons);
        image = canvas.toDataURL('image/png');
      }
    } catch {
      // Leave the image empty — the sheet still renders with a placeholder.
    }
    return { name, image };
  });
  return cached;
}
`;

writeFileSync(OUT, file);
console.log(`Wrote ${picked.length} plays to src/lib/wristbandDemo.ts`);
for (const [i, p] of picked.entries()) {
  const slot = i < 8 ? 'diagram insert' : 'text-only only';
  console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(18)} ${p.gameType.padEnd(6)} ${p.formation.padEnd(10)} (${slot})`);
}
