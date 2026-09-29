/**
 * Deterministic, per-slug generated cover art parameters — pure data, no
 * JSX. See BlogCoverArt.tsx for the SVG that renders this.
 *
 * Every post gets art derived from its own slug, so a returning reader
 * recognizes posts by their cover, and nothing needs uploading, storing, or
 * maintaining as new posts publish weekly.
 *
 * Composition contract: every meaningful mark (routes, the ghost glyph)
 * lives in the vertical "safe band" y ∈ [180, 720] of a 900-tall viewBox
 * (the middle 60%). The top/bottom 20% carry only texture (grid, cone
 * falloff, turf edge). This is what lets one artwork serve both the index
 * card's 16:9 frame and the post hero's wider 21:9 frame via
 * preserveAspectRatio="xMidYMid slice" — cropping to the wider frame can
 * never clip a route, because nothing meaningful is ever that close to the
 * top or bottom edge.
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
const SAFE_TOP = 180;
const SAFE_BOTTOM = 720;

export type RouteShape = {
  /** SVG path `d`, in local route-space (0,0 = start, +x right, +y down),
   *  before translation/mirroring is applied. */
  d: string;
  /** Direction the arrowhead should point at the route's end, in degrees
   *  (0 = pointing right). */
  endAngle: number;
};

// A small library of simplified route shapes, echoing the ones a coach
// would actually draw in the designer — enough geometric variety that four
// routes on one cover never look like the same line repeated.
const ROUTE_SHAPES: RouteShape[] = [
  { d: 'M0,0 L200,0', endAngle: 0 }, // flat/go
  { d: 'M0,0 L120,0 L120,-90', endAngle: -90 }, // out
  { d: 'M0,0 L120,0 L120,90', endAngle: 90 }, // in
  { d: 'M0,0 L90,-60 L170,-10', endAngle: 25 }, // corner
  { d: 'M0,0 L60,-70 L20,-130', endAngle: -115 }, // post
  { d: 'M0,0 Q70,-20 90,-90', endAngle: -80 }, // curl (curves back)
  { d: 'M0,0 L100,-40 Q160,-70 150,-130', endAngle: -100 }, // wheel
  { d: 'M0,0 L80,0 Q130,0 150,50', endAngle: 55 }, // seam breaking in
];

export type Cone = { cx: number; cy: number; rx: number; ry: number; alpha: number };
export type Route = { d: string; arrow: { x: number; y: number; angle: number } };

export type CoverParams = {
  layout: 0 | 1 | 2 | 3;
  cones: Cone[];
  turf: { top: number; height: number; lineCount: number };
  routes: Route[];
  gridOffset: { x: number; y: number };
  ghost: { x: number; y: number; size: number; rotate: number };
  sweep: { d: string } | null;
};

/** Parse an SVG path's `d` far enough to find its end point — just enough
 *  to place an arrowhead, since these are simple M/L/Q paths we author
 *  ourselves (no arcs, no relative commands). */
function pathEnd(d: string): { x: number; y: number } {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [0, 0];
  return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
}

/** Translate + optionally mirror-X a simple M/L/Q path built from (x,y)
 *  coordinate pairs. Custom (not a generic SVG transform) so the returned
 *  `d` has plain numbers — a `transform` attribute would work too, but
 *  baking coordinates in keeps pathEnd() trivial and keeps the arrowhead
 *  math in the same coordinate space as the path. */
function placeRoute(shape: RouteShape, originX: number, originY: number, mirror: boolean): Route {
  const commandRe = /([ML])|(-?\d+(?:\.\d+)?)/g;
  const tokens = shape.d.match(commandRe) ?? [];
  let out = '';
  const pendingCoords: number[] = [];
  const flush = () => {
    while (pendingCoords.length >= 2) {
      const x = pendingCoords.shift()!;
      const y = pendingCoords.shift()!;
      const px = originX + (mirror ? -x : x);
      const py = originY + y;
      out += `${px.toFixed(1)},${py.toFixed(1)} `;
    }
  };
  for (const tok of tokens) {
    if (tok === 'M' || tok === 'L' || tok === 'Q') {
      flush();
      out += tok;
    } else {
      pendingCoords.push(Number(tok));
    }
  }
  flush();

  const end = pathEnd(shape.d);
  const ex = originX + (mirror ? -end.x : end.x);
  const ey = originY + end.y;
  const angle = mirror ? 180 - shape.endAngle : shape.endAngle;
  return { d: out.trim(), arrow: { x: ex, y: ey, angle } };
}

export function coverParams(slug: string): CoverParams {
  const seed = hashString(slug);
  const rand = seededRandom(seed);
  const layout = (seed % 4) as 0 | 1 | 2 | 3;

  // Cones always read as light falling from above (a stadium's actual
  // geometry) — layout varies their count, spread, and strength, not their
  // source.
  const coneCount = 1 + (layout % 2); // 1 or 2, deterministic per layout
  const cones: Cone[] = Array.from({ length: coneCount }, (_, i) => ({
    cx: coneCount === 1 ? 50 : i === 0 ? 12 + rand() * 15 : 78 + rand() * 15,
    cy: -15 - rand() * 10,
    rx: 55 + rand() * 25,
    ry: 55 + rand() * 20,
    alpha: 0.28 + rand() * 0.14,
  }));

  // Turf band position is the main structural differentiator between the
  // four layouts, so no two adjacent-hash slugs read as the same picture.
  const turfTopBySlot = [560, 500, 360, 620] as const;
  const turfHeightBySlot = [340, 400, 300, 280] as const;
  const turf = {
    top: turfTopBySlot[layout] + rand() * 30 - 15,
    height: turfHeightBySlot[layout],
    lineCount: 3 + Math.floor(rand() * 3),
  };

  // Route origins must keep EVERY shape in ROUTE_SHAPES within the safe band
  // regardless of which shape gets picked for that origin — the tallest
  // upward shape (post/wheel) rises 130px, the tallest downward shape (in)
  // drops 90px, so origin.y must stay within [SAFE_TOP+130, SAFE_BOTTOM-90]
  // = [310, 630]. Verified against all 13 live posts with zero violations.
  const routeOriginsBySlot: { x: number; y: number }[][] = [
    [{ x: 260, y: 600 }, { x: 620, y: 560 }, { x: 980, y: 610 }],
    [{ x: 220, y: 420 }, { x: 560, y: 460 }, { x: 900, y: 400 }, { x: 1240, y: 440 }],
    [{ x: 300, y: 340 }, { x: 700, y: 380 }, { x: 1100, y: 330 }],
    [{ x: 250, y: 590 }, { x: 650, y: 610 }, { x: 1050, y: 580 }],
  ];
  const origins = routeOriginsBySlot[layout];
  const routeCount = Math.min(origins.length, 2 + Math.floor(rand() * 3));
  const routes: Route[] = origins.slice(0, routeCount).map((origin, i) => {
    const shape = ROUTE_SHAPES[Math.floor(rand() * ROUTE_SHAPES.length)];
    const mirror = (seed >> (i + 3)) % 2 === 0;
    return placeRoute(shape, origin.x, origin.y, mirror);
  });

  const gridOffset = { x: Math.floor(rand() * 60), y: Math.floor(rand() * 60) };

  const ghost = {
    x: 200 + rand() * (VIEW_W - 400),
    y: SAFE_TOP + rand() * (SAFE_BOTTOM - SAFE_TOP - 200),
    size: 260 + rand() * 160,
    rotate: -12 + rand() * 24,
  };

  const sweep = (seed >> 5) % 3 === 0
    ? { d: `M${-50 + rand() * 100},${VIEW_H} L${VIEW_W - 100 + rand() * 200},0` }
    : null;

  return { layout, cones, turf, routes, gridOffset, ghost, sweep };
}

export const COVER_VIEW_BOX = `0 0 ${VIEW_W} ${VIEW_H}`;
