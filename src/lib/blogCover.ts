/**
 * Deterministic, per-slug generated cover art parameters — pure data, no
 * JSX. See BlogCoverArt.tsx for the SVG that renders this.
 *
 * Design v2. The first version composed a scene (turf band + chalk
 * yardlines + floodlights + grid + a football glyph + 2-4 bright-green
 * "product diagram" route fragments) and read as generic/cluttered —
 * user feedback: "Random arrows, half drawn field yardlines, and a
 * generic football doesn't work." The mistake was mixing two different
 * visual registers: PlayDiagramCard's routes are a literal, precise
 * product diagram (solid #1FA75D on white, meant to be read exactly) —
 * using that same bold styling for decorative fragments invited reading
 * them AS a real play, which they weren't, so they looked like broken
 * scribbles. And the football/turf-band motifs were generic sports-blog
 * clipart with no connection to this brand specifically.
 *
 * v2 instead extends the brand's own existing, already-established
 * AMBIENT doodle vocabulary verbatim — Logo.tsx's icon and Hero.tsx's
 * route doodle both use the exact same recipe: a faint cream origin dot,
 * ONE long confident curved stroke (not a fragment), ONE green
 * arrowhead, and a few small restrained yard-hash ticks. Nothing else.
 * One deliberate mark per cover, not a crowded scene.
 */

/** FNV-1a 32-bit. Deterministic and stable across sessions/machines. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough distribution for visual variety. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIEW_W = 1600;
const VIEW_H = 900;

/**
 * A route "family" — one long, deliberate curve in a local coordinate
 * space (roughly 0-480 wide, 0-400 tall), matching the scale and
 * confidence of Hero.tsx's own doodle (`M16 244 V50 Q16 30 36 30 H340`).
 * `end`/`endAngle` place the arrowhead: angle in degrees, 0 = pointing
 * right, matching the canonical arrowhead shape in BlogCoverArt.tsx.
 * `origin` places the start-circle (the route's "player").
 */
type RouteFamily = {
  d: string;
  origin: { x: number; y: number };
  end: { x: number; y: number };
  endAngle: number;
};

const ROUTE_FAMILIES: RouteFamily[] = [
  // corner-cut — Hero.tsx's own doodle shape
  { d: 'M20 380 V80 Q20 40 60 40 H460', origin: { x: 20, y: 380 }, end: { x: 460, y: 40 }, endAngle: 0 },
  // diagonal sweep
  { d: 'M20 380 Q220 340 460 60', origin: { x: 20, y: 380 }, end: { x: 460, y: 60 }, endAngle: -58 },
  // s-curve
  { d: 'M20 40 Q220 40 250 200 Q280 360 460 360', origin: { x: 20, y: 40 }, end: { x: 460, y: 360 }, endAngle: 42 },
  // hook / comeback
  { d: 'M20 380 Q320 380 420 220 Q460 140 380 90', origin: { x: 20, y: 380 }, end: { x: 380, y: 90 }, endAngle: -150 },
  // deep arc
  { d: 'M20 300 Q240 10 460 280', origin: { x: 20, y: 300 }, end: { x: 460, y: 280 }, endAngle: 48 },
  // low sweep
  { d: 'M20 120 Q240 300 460 170', origin: { x: 20, y: 120 }, end: { x: 460, y: 170 }, endAngle: -22 },
];

export type Cone = { cx: number; cy: number; rx: number; ry: number; alpha: number };

export type CoverParams = {
  cones: Cone[];
  gridOffset: { x: number; y: number };
  route: RouteFamily;
  /** Where the route is placed and how large, in viewBox units — chosen so
   *  the origin dot and arrowhead both land well inside the region that
   *  survives a crop to the post hero's wider 21:9 frame. */
  transform: { tx: number; ty: number; scale: number; mirror: boolean };
  /** Small yard-hash ticks (Logo.tsx's exact motif) along one vertical
   *  edge — which edge, and how many pairs. */
  hashes: { side: 'left' | 'right'; count: number };
};

export function coverParams(slug: string): CoverParams {
  const seed = hashString(slug);
  const rand = seededRandom(seed);

  const route = ROUTE_FAMILIES[seed % ROUTE_FAMILIES.length];
  const mirror = Math.floor(seed / ROUTE_FAMILIES.length) % 2 === 0;

  const coneCount = 1 + (seed % 2);
  const cones: Cone[] = Array.from({ length: coneCount }, (_, i) => ({
    cx: coneCount === 1 ? 50 : i === 0 ? 15 + rand() * 12 : 75 + rand() * 15,
    cy: -18 - rand() * 8,
    rx: 60 + rand() * 25,
    ry: 55 + rand() * 20,
    alpha: 0.3 + rand() * 0.14,
  }));

  const gridOffset = { x: Math.floor(rand() * 60), y: Math.floor(rand() * 60) };

  // Scale the ~480x400 local route family up to a large, confident mark —
  // never a small decorative fragment. scale 1.4-1.7 -> a 672x560 to
  // 816x680 mark; combined with tx/ty below, its bottom edge stays within
  // 780-840 and right edge within 896-1416, comfortably inside the
  // 1600x900 canvas with margin for the post hero's tighter 21:9 crop.
  // (Verified with a standalone script before wiring this up — the first
  // version of this math was wrong and would have made the route taller
  // than the canvas itself.)
  const scale = 1.4 + rand() * 0.3;
  const tx = 80 + rand() * 520;
  const ty = 100 + rand() * 60;

  const hashes: { side: 'left' | 'right'; count: number } = {
    side: (seed >> 3) % 2 === 0 ? 'left' : 'right',
    count: 3 + (seed % 2),
  };

  return { cones, gridOffset, route, transform: { tx, ty, scale, mirror }, hashes };
}

export const COVER_VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;
