// ---------------------------------------------
// Pure play-scene rendering — shared by the interactive designer
// (src/components/designer/Canvas.tsx) and any read-only preview (e.g. the
// homepage hero demo). All input data is in normalized 0–1 coordinates, so a
// play renders identically on any screen size and at any export resolution.
// Visual sizes below are defined at a reference canvas size and scaled
// proportionally when rendering. Extracted from Canvas.tsx so both places
// use one implementation and never drift apart.
// ---------------------------------------------
export const REF_SIZE = 600; // reference min(width, height) the base sizes were designed at

// Fixed export resolution (letter-page proportions) — every play prints
// the same regardless of the screen it was designed on. Every on-screen
// canvas is locked to this aspect ratio too (PlayDesigner's and
// VsDefenseView's resize handlers), so shapes — zone ellipses especially —
// look the same on screen as in the printed PDF. Lives here rather than in
// Canvas.tsx so read-only views can lock the same ratio without importing
// the whole interactive designer; Canvas.tsx re-exports both for the
// existing imports across the designer.
export const EXPORT_WIDTH = 1650;
export const EXPORT_HEIGHT = 1275;

export const ROUTE_LINE_WIDTH = 3;
export const ARROWHEAD_SIZE = 14;
export const PLAYER_SIZE = 36;
const PLAYER_FONT = 16;

// 11v11 formations felt crowded at a fixed icon size — not because template
// spacing overlaps (it doesn't), but because a fixed diameter is a larger
// fraction of the gap once 10-11 icons share the field vs. 5v5/7v7. Icons
// shrink smoothly as more of them are on the field, rather than a fixed size
// per game format (which wouldn't help a hand-edited formation with an
// unusual count) or a global shrink (which would needlessly shrink the
// already-fine 5v5/7v7 sizes).
const ICON_SCALE_FULL_AT = 7; // 5v5/7v7-sized rosters stay full size
const ICON_SCALE_MIN_AT = 11; // 11v11-sized rosters hit the floor
const ICON_SCALE_FLOOR = 0.8; // never shrink below 80% — stays legible/tappable

export function iconScaleForCount(n: number): number {
  if (n <= ICON_SCALE_FULL_AT) return 1;
  if (n >= ICON_SCALE_MIN_AT) return ICON_SCALE_FLOOR;
  const t = (n - ICON_SCALE_FULL_AT) / (ICON_SCALE_MIN_AT - ICON_SCALE_FULL_AT);
  return 1 - t * (1 - ICON_SCALE_FLOOR);
}

const FIELD_BG = '#FFFFFF';
const SIDELINE_PADDING = 8;
const FIELD_BORDER_COLOR = '#1a1a1a';
const YARD_LINE_COLOR = '#D8D8D8';
const HASH_COLOR = '#B0B0B0';
const HASH_TICK_LEN = 10;
const YARD_NUMBER_COLOR = '#C4C4C4';
const LOS_COLOR = '#1a1a1a';
// One universal field for every game format (styled after a printed flag
// playbook page): 17 yards upfield of the LOS, 13 behind it. The sideline
// yard numbers label the LOS as the "20", so 10/20/30 read exactly like the
// reference page. Changing these is a DATA MIGRATION, not a tweak — every
// saved play's normalized coordinates encode this window (see
// scripts/migrate-field-depth-2026-07.mjs for the 25→30-yard remap).
export const FIELD_YARDS_ABOVE_LOS = 17;
export const FIELD_YARDS_BELOW_LOS = 13;
export const TOTAL_FIELD_YARDS = FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS;

// Interior hash columns sit at one-third of the field width (the NFHS/youth
// standard inset), drawn for every game format — the universal field.
const HASH_LEFT_X_RATIO = 1 / 3;
const HASH_RIGHT_X_RATIO = 1 - HASH_LEFT_X_RATIO;

const GUIDE_COLOR = '#f59e0b';

// ---------------------------------------------
// Types
// ---------------------------------------------
// 'block' stays in the union so old saved plays (mode: 'block') still
// type-check and load — new code no longer writes it, using 'straight'/
// 'waypoint' for shape plus the independent `capStyle` field below instead.
export type DrawMode = 'straight' | 'waypoint' | 'block';

export type CapStyle = 'arrow' | 'block';

/** Stroke style for a route, or for one segment of one. 'dashed' is labeled
 *  "Dotted" in the toolbar (the label predates this type); 'motion' is the
 *  football-diagram squiggle coaches use for pre-snap motion. */
export type LineStyle = 'solid' | 'dashed' | 'motion';

const LINE_STYLE_VALUES: readonly LineStyle[] = ['solid', 'dashed', 'motion'];

/** Guard every style value read off a saved play, so a hand-edited or
 *  corrupted field degrades to 'solid' instead of reaching the renderer as
 *  an unknown string. */
export const isLineStyle = (v: unknown): v is LineStyle =>
  typeof v === 'string' && (LINE_STYLE_VALUES as readonly string[]).includes(v);

export type Pt = { x: number; y: number }; // normalized 0–1

export type PathItem = {
  points: Pt[];
  color: string;
  startIconIndex?: number;
  mode: DrawMode;
  /** Terminal decoration. Omitted/undefined means 'arrow' — the default
   *  for both new paths and pre-existing saved plays that predate this
   *  field. A legacy `mode === 'block'` path is still treated as a block
   *  ending even without this field (see renderScene's useBlockCap). */
  capStyle?: CapStyle;
  /** @deprecated Superseded by `lineStyle`, but still WRITTEN as a legacy
   *  mirror (see finishRoute in Canvas.tsx) so an already-deployed older
   *  bundle in a stale tab renders a route sensibly, and still READ as the
   *  fallback for every play saved before `lineStyle` existed. Never delete.
   *  Omitted/undefined means solid. */
  dashed?: boolean;
  /** @deprecated Superseded by `segmentStyles`. Read-only legacy: still
   *  honored for plays saved before that field existed, never written now.
   *  Index i is the style of the segment from points[i] to points[i+1], so
   *  length equals points.length-1 when present. Only ever set for 'straight'
   *  mode, back when splitting a curved route wasn't supported. */
  segmentDashed?: boolean[];
  /** Whole-path stroke style. Supersedes `dashed`; omitted means derive from
   *  `dashed` (and solid when that's absent too), which covers every play
   *  saved before this field existed — no migration and no canvas_data
   *  version bump, the same optional-field pattern as capStyle/dashed/
   *  independentColor. See resolveLineStyle(). */
  lineStyle?: LineStyle;
  /** Per-segment style override — index i is the style of the segment from
   *  points[i] to points[i+1], so length must equal points.length-1 when
   *  present. Omitted means every segment uses `lineStyle` above, which keeps
   *  a route that was never toggled mid-draw exactly as small as before.
   *  Unlike the `segmentDashed` it supersedes, this IS set for 'waypoint'
   *  mode: flattenRoute() splits the quadratic-smoothed stroke at the t=0.5
   *  point of each corner without changing the silhouette. */
  segmentStyles?: LineStyle[];
  /** True once this path's color was explicitly set — via a non-Auto sticky
   *  route-color default at draw time, or the Recolor Route popover — and
   *  must survive the origin icon being recolored later. Omitted/false =
   *  today's only behavior: the path's color always follows its icon (see
   *  applyIconStyle in Canvas.tsx). No migration needed — every existing
   *  saved play has this omitted and keeps auto-syncing exactly as before. */
  independentColor?: boolean;
};

/** A path's whole-path style, honoring the pre-`lineStyle` `dashed` flag. */
export function resolveLineStyle(path: Pick<PathItem, 'lineStyle' | 'dashed'>): LineStyle {
  if (isLineStyle(path.lineStyle)) return path.lineStyle;
  return path.dashed ? 'dashed' : 'solid';
}

/** The per-segment styles to actually render/edit. Precedence:
 *    segmentStyles > segmentDashed > lineStyle > dashed > 'solid'
 *  A per-segment array of the wrong length (a hand-edited or corrupted save)
 *  is ignored in favor of the whole-path fallback, rather than allowed to
 *  silently attach the wrong style to the wrong segment. */
export function resolveSegmentStyles(
  path: Pick<PathItem, 'points' | 'dashed' | 'segmentDashed' | 'lineStyle' | 'segmentStyles'>,
): LineStyle[] {
  const segmentCount = Math.max(0, path.points.length - 1);
  if (path.segmentStyles && path.segmentStyles.length === segmentCount) {
    return path.segmentStyles.map((s) => (isLineStyle(s) ? s : 'solid'));
  }
  if (path.segmentDashed && path.segmentDashed.length === segmentCount) {
    return path.segmentDashed.map((d) => (d ? 'dashed' : 'solid'));
  }
  return new Array<LineStyle>(segmentCount).fill(resolveLineStyle(path));
}

export type IconShape = 'circle' | 'square' | 'triangle' | 'star';

export type PlayerIcon = {
  x: number; // normalized 0–1
  y: number; // normalized 0–1
  letter: string;
  color: string;
  /** Legacy flag from before `shape` existed — kept so old saved plays load.
   *  `shape` wins when both are present (see iconShape()). */
  isSquare?: boolean;
  shape?: IconShape;
};

/** Resolve an icon's shape, honoring the pre-`shape` isSquare flag. */
export const iconShape = (icon: { shape?: IconShape; isSquare?: boolean }): IconShape =>
  icon.shape ?? (icon.isSquare ? 'square' : 'circle');

/** A defender's zone of responsibility — an ellipse anchored to (but
 *  independently movable/resizable from) a player icon. */
export type Zone = {
  iconIndex: number; // index into playerIcons
  cx: number; cy: number; // normalized 0–1, ellipse center
  rx: number; ry: number; // normalized 0–1, horizontal/vertical radii
  color: string; // snapshot of the icon's color at creation time
};

export type ZoneHandleAxis = 'x' | 'y' | 'both';
type ZoneHandle = { x: number; y: number; axis: ZoneHandleAxis };

/** A free-floating text annotation (e.g. "SNAP ON 2", a formation name).
 *  Anchored by its center, like a player icon, so drag-to-move feels the
 *  same for both. Independent of player icons/paths — never referenced by
 *  index — so re-stamping a formation or editing routes never disturbs it. */
export type TextBox = {
  x: number; // normalized 0–1, center anchor
  y: number; // normalized 0–1, center anchor
  text: string; // may contain \n for multiple lines
  color: string;
  fontSize: number; // px at the REF_SIZE=600 baseline, scaled like PLAYER_FONT
};

export const TEXT_BOX_SIZES = { small: 14, medium: 20, large: 28 } as const;
export const DEFAULT_TEXT_BOX_SIZE: number = TEXT_BOX_SIZES.medium;
// The field background is white (a printed-playbook look — see FIELD_BG), so
// black is the only default that's legible without the user picking a color.
export const DEFAULT_TEXT_BOX_COLOR = '#000000';
const TEXT_BOX_FONT = (px: number) => `700 ${px}px Inter, Arial, sans-serif`;
const TEXT_BOX_LINE_HEIGHT_RATIO = 1.2;

// ---------------------------------------------
// Rendering (pure functions over normalized data)
// ---------------------------------------------
const yFromYards = (yards: number, H: number) =>
  ((yards + FIELD_YARDS_ABOVE_LOS) / (FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS)) * H;

export function strokeRoute(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function strokeStraight(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw: number) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 10;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

// Motion-line geometry, in multiples of the current line width so it scales
// with `scale` exactly like the dash pattern [lw*2.5, lw*2] does — on screen
// (lw = ROUTE_LINE_WIDTH * scale) and in the 1650x1275 export alike.
const MOTION_WAVELENGTH = 3.2; // × lw — one full period (two half-waves)
const MOTION_AMPLITUDE = 1.6; // × lw — peak offset from the centerline

/**
 * Convert a polyline into the zigzag "motion" squiggle drawn along it.
 *
 * Walks the input by arc length emitting alternating perpendicular offsets.
 * Two properties are load-bearing:
 *  - An integer number of half-waves is fitted to the run's exact length, and
 *    the first and last peaks are pinned to zero offset, so the squiggle
 *    starts and ends ON the true path. That's what keeps the start anchored
 *    at the player icon, lets the tip tuck behind the arrowhead through the
 *    usual trimEnd(), and makes adjacent runs of different styles join.
 *  - Every interior vertex of the input is forced into the sample set, so a
 *    sharp cut mid-run stays sharp instead of being rounded off by sampling.
 */
export function motionZigzag(pts: Pt[], wavelength: number, amplitude: number): Pt[] {
  if (pts.length < 2 || wavelength <= 0) return pts;
  // Cumulative arc length of the input.
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  // Too short to fit a full period — a lone half-wave reads as a mistake,
  // where a short solid stub just reads as a short line.
  if (total < wavelength) return pts;

  const halfWaves = Math.max(2, Math.round((2 * total) / wavelength));
  const hw = total / halfWaves;
  // Zeroed first/last peaks make the end half-waves ramps onto the centerline.
  const peak = (k: number) => (k === 0 || k === halfWaves ? 0 : k % 2 === 1 ? 1 : -1);

  // Sample at every half-wave stop AND every interior vertex, deduped.
  const stops: number[] = [];
  for (let k = 0; k <= halfWaves; k++) stops.push(k * hw);
  for (let i = 1; i < pts.length - 1; i++) stops.push(cum[i]);
  stops.sort((a, b) => a - b);
  const eps = Math.max(1e-6, total * 1e-9);

  const out: Pt[] = [];
  let seg = 0;
  let prevStop = Number.NEGATIVE_INFINITY;
  for (const s of stops) {
    if (s - prevStop < eps) continue; // dedupe a vertex landing on a half-wave stop
    prevStop = s;
    // Advance to the segment containing s.
    while (seg < pts.length - 2 && cum[seg + 1] < s - eps) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > eps ? (s - cum[seg]) / segLen : 0;
    const px = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t;
    const py = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t;

    // Tangent: the containing segment's direction, except exactly at an
    // interior vertex, where the average of the incoming and outgoing
    // directions bisects the corner so the offset point doesn't pinch.
    let tx = pts[seg + 1].x - pts[seg].x;
    let ty = pts[seg + 1].y - pts[seg].y;
    const atVertex = Math.abs(s - cum[seg + 1]) < eps && seg + 2 < pts.length;
    if (atVertex) {
      const l1 = Math.hypot(tx, ty) || 1;
      let nx = pts[seg + 2].x - pts[seg + 1].x;
      let ny = pts[seg + 2].y - pts[seg + 1].y;
      const l2 = Math.hypot(nx, ny) || 1;
      nx /= l2; ny /= l2;
      tx = tx / l1 + nx;
      ty = ty / l1 + ny;
    }
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;

    // Triangular wave: lerp between the surrounding peaks.
    const u = s / hw;
    const k = Math.min(halfWaves - 1, Math.floor(u + eps));
    const off = amplitude * (peak(k) + (peak(k + 1) - peak(k)) * (u - k));

    out.push({ x: px - ty * off, y: py + tx * off });
  }
  return out.length >= 2 ? out : pts;
}

/**
 * A dense polyline tracing exactly the path strokeRoute() draws, plus the
 * index into that polyline where each interior point's segment boundary falls.
 *
 * strokeRoute draws, for pts.length = n >= 3: moveTo(P0), then for each
 * interior i in 1..n-2 a quadratic with control P_i ending at the midpoint
 * M_i = mid(P_i, P_{i+1}), then a straight lineTo(P_{n-1}). So there are
 * exactly n-2 quadratics for n-2 interior points — a 1:1 mapping.
 *
 * The boundary between segment i-1 and segment i is the t=0.5 point of the
 * quadratic controlled by P_i: the curve's closest approach to that interior
 * point, and the only split that is both well-defined and symmetric. Each
 * quadratic is therefore subdivided into an EVEN number of steps so t=0.5 is
 * an exact sample — that makes the boundary an exact index with no
 * nearest-sample search. An odd count would drift every boundary by half a
 * step, subtly and without ever throwing.
 *
 * `boundaries.length === pts.length - 2`.
 */
export function flattenRoute(pts: Pt[]): { points: Pt[]; boundaries: number[] } {
  if (pts.length < 3) return { points: pts, boundaries: [] };
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const out: Pt[] = [pts[0]];
  const boundaries: number[] = [];
  let start = pts[0];
  for (let i = 1; i <= pts.length - 2; i++) {
    const control = pts[i];
    const end = mid(control, pts[i + 1]);
    // Even step count, scaled by the curve's rough size so the 1650x1275
    // export automatically samples about twice as finely as the screen.
    const rough = Math.hypot(control.x - start.x, control.y - start.y)
      + Math.hypot(end.x - control.x, end.y - control.y);
    const m = Math.min(16, Math.max(4, Math.round(rough / 8)));
    const steps = m * 2;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const it = 1 - t;
      out.push({
        x: it * it * start.x + 2 * it * t * control.x + t * t * end.x,
        y: it * it * start.y + 2 * it * t * control.y + t * t * end.y,
      });
      if (s === m) boundaries.push(out.length - 1); // exactly t = 0.5
    }
    start = end;
  }
  out.push(pts[pts.length - 1]); // the closing lineTo
  return { points: out, boundaries };
}

/**
 * Stroke a route, honoring a per-segment style array so one route can mix
 * solid, dotted and motion segments. `styles[i]` is the style of the segment
 * from `pts[i]` to `pts[i+1]`, so `styles.length === pts.length - 1`.
 *
 * ⚠ The uniform fast path below is the ENTIRE backward-compatibility story:
 * every play saved before `segmentStyles` existed resolves to a single
 * repeated style and must keep going through the exact same strokeRoute /
 * strokeStraight + setLineDash calls it always did. Do not "simplify" this by
 * routing everything through the run loop — that would silently change every
 * existing curved route's silhouette (re-smoothing an already-flattened
 * sample set shrinks it) and restart every dashed route's dash phase.
 */
export function strokeStyledRuns(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  styles: LineStyle[],
  color: string,
  lw: number,
  curved: boolean,
) {
  if (pts.length < 2) return;
  const dash: [number, number] = [lw * 2.5, lw * 2];
  const zig = (run: Pt[]) => motionZigzag(run, MOTION_WAVELENGTH * lw, MOTION_AMPLITUDE * lw);
  // Each run sets its own dash inside save/restore — a dash leaked from a
  // neighbouring run would turn a squiggle into confetti.
  const strokeOne = (run: Pt[], style: LineStyle) => {
    ctx.save();
    ctx.setLineDash(style === 'dashed' ? dash : []);
    strokeStraight(ctx, style === 'motion' ? zig(run) : run, color, lw);
    ctx.restore();
  };

  const uniform = styles.length !== pts.length - 1 || new Set(styles).size <= 1;
  if (uniform) {
    const style = styles[0] ?? 'solid';
    if (!curved) {
      strokeOne(pts, style);
      return;
    }
    ctx.save();
    if (style === 'motion') {
      // A curve has to be flattened before it can be walked by arc length.
      ctx.setLineDash([]);
      strokeStraight(ctx, zig(flattenRoute(pts).points), color, lw);
    } else {
      ctx.setLineDash(style === 'dashed' ? dash : []);
      strokeRoute(ctx, pts, color, lw);
    }
    ctx.restore();
    return;
  }

  // Mixed. Straight mode splits at its own vertices; curved mode splits the
  // flattened curve at the t=0.5 corner boundaries, so the silhouette is
  // unchanged and only the cut points are new. Mixed curved runs are stroked
  // with strokeStraight over the dense samples — never strokeRoute, which
  // would re-smooth them.
  const flat = curved
    ? flattenRoute(pts)
    : { points: pts, boundaries: pts.map((_, i) => i).slice(1, -1) };
  const cut = (segIdx: number) =>
    segIdx === 0 ? 0 : segIdx >= styles.length ? flat.points.length - 1 : flat.boundaries[segIdx - 1];
  let runStart = 0;
  for (let i = 0; i <= styles.length; i++) {
    if (i === styles.length || styles[i] !== styles[runStart]) {
      strokeOne(flat.points.slice(cut(runStart), cut(i) + 1), styles[runStart]);
      runStart = i;
    }
  }
}

/**
 * Shorten a polyline from its end by `dist` pixels so the stroked line
 * tucks behind the arrowhead instead of poking past its tip.
 */
export function trimEnd(pts: Pt[], dist: number): Pt[] {
  if (pts.length < 2 || dist <= 0) return pts;
  let remaining = dist;
  const out = [...pts];
  while (out.length >= 2) {
    const tip = out[out.length - 1];
    const prev = out[out.length - 2];
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen > remaining) {
      const t = (segLen - remaining) / segLen;
      out[out.length - 1] = { x: prev.x + dx * t, y: prev.y + dy * t };
      return out;
    }
    // Whole segment shorter than the trim distance — drop the point
    remaining -= segLen;
    out.pop();
  }
  return out;
}

export function drawArrowhead(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, size: number) {
  if (pts.length < 2) return;
  const tip = pts[pts.length - 1];
  let from = pts[pts.length - 2];
  for (let i = pts.length - 2; i >= Math.max(0, pts.length - 8); i--) {
    const dx = tip.x - pts[i].x;
    const dy = tip.y - pts[i].y;
    if (Math.sqrt(dx * dx + dy * dy) > size * 0.4) {
      from = pts[i];
      break;
    }
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * size - uy * (size * 0.45), tip.y - uy * size + ux * (size * 0.45));
  ctx.lineTo(tip.x - ux * size + uy * (size * 0.45), tip.y - uy * size - ux * (size * 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Block-notation terminal decoration (B-25): a short perpendicular bar
 * centered on the path's tip — the standard run-blocking "T-cap" symbol,
 * in place of an arrowhead. The line is drawn full-length right up to the
 * tip (see the `useBlockCap` trim skip in renderScene) since the bar sits
 * on the endpoint rather than tapering to it like an arrowhead does.
 */
export function drawBlockCap(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, size: number) {
  if (pts.length < 2) return;
  const tip = pts[pts.length - 1];
  let from = pts[pts.length - 2];
  for (let i = pts.length - 2; i >= Math.max(0, pts.length - 8); i--) {
    const dx = tip.x - pts[i].x;
    const dy = tip.y - pts[i].y;
    if (Math.sqrt(dx * dx + dy * dy) > size * 0.4) {
      from = pts[i];
      break;
    }
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular unit vector
  const px = -uy;
  const py = ux;
  const halfWidth = size * 0.6;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tip.x + px * halfWidth, tip.y + py * halfWidth);
  ctx.lineTo(tip.x - px * halfWidth, tip.y - py * halfWidth);
  ctx.stroke();
  ctx.restore();
}

/** Fill a player icon's shape centered at (cx, cy). Triangle and star are
 *  drawn on a slightly larger circumradius so their visual weight matches
 *  the circle/square. */
function fillIconShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, shape: IconShape) {
  const r = size / 2;
  ctx.beginPath();
  if (shape === 'square') {
    ctx.rect(cx - r, cy - r, size, size);
  } else if (shape === 'triangle') {
    const R = r * 1.25;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === 'star') {
    const outer = r * 1.3;
    const inner = outer * 0.5;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const R = i % 2 === 0 ? outer : inner;
      const x = cx + R * Math.cos(a);
      const y = cy + R * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** How much of the icon's width the label may occupy — narrower shapes
 *  (triangle, star) leave less room around their center. */
const TEXT_FIT: Record<IconShape, number> = {
  circle: 0.85,
  square: 0.9,
  triangle: 0.6,
  star: 0.55,
};

function drawField(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number) {
  const pad = SIDELINE_PADDING * scale;
  ctx.save();
  ctx.fillStyle = FIELD_BG;
  ctx.fillRect(0, 0, W, H);

  // Yard lines every 5, anchored to the LOS (not the field edges — with a
  // 17/13 window the edges aren't on the 5-yard grid).
  ctx.strokeStyle = YARD_LINE_COLOR;
  ctx.lineWidth = Math.max(1, scale);
  const firstLine = -Math.floor(FIELD_YARDS_ABOVE_LOS / 5) * 5;
  for (let y = firstLine; y <= FIELD_YARDS_BELOW_LOS; y += 5) {
    const py = yFromYards(y, H);
    ctx.beginPath();
    ctx.moveTo(pad, py);
    ctx.lineTo(W - pad, py);
    ctx.stroke();
  }

  // Per-yard ticks: two interior hash columns at one-third width (the
  // NFHS/youth inset) plus sideline ticks hugging both borders, like a
  // printed playbook page. Same field for every game format.
  ctx.strokeStyle = HASH_COLOR;
  ctx.lineWidth = Math.max(1, scale);
  const tick = HASH_TICK_LEN * scale;
  const lhx = pad + (W - pad * 2) * HASH_LEFT_X_RATIO;
  const rhx = pad + (W - pad * 2) * HASH_RIGHT_X_RATIO;
  for (let y = -FIELD_YARDS_ABOVE_LOS; y <= FIELD_YARDS_BELOW_LOS; y += 1) {
    const py = yFromYards(y, H);
    ctx.beginPath(); ctx.moveTo(lhx - tick / 2, py); ctx.lineTo(lhx + tick / 2, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rhx - tick / 2, py); ctx.lineTo(rhx + tick / 2, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad + 2 * scale, py); ctx.lineTo(pad + 2 * scale + tick, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - pad - 2 * scale - tick, py); ctx.lineTo(W - pad - 2 * scale, py); ctx.stroke();
  }

  // Sideline yard numbers, LOS labeled as the "20" (so 10/20/30 read like a
  // real field with the offense on its own 20). Rotated to lie along the
  // sidelines, mirrored left/right like painted field numbers.
  ctx.fillStyle = YARD_NUMBER_COLOR;
  ctx.font = `700 ${28 * scale}px 'Inter var', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const numberInset = pad + 40 * scale;
  for (const { label, yds } of [{ label: '30', yds: -10 }, { label: '20', yds: 0 }, { label: '10', yds: 10 }]) {
    const py = yFromYards(yds, H);
    ctx.save();
    ctx.translate(numberInset, py);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(W - numberInset, py);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // Line of scrimmage (the "20")
  const losY = yFromYards(0, H);
  ctx.strokeStyle = LOS_COLOR;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(pad, losY);
  ctx.lineTo(W - pad, losY);
  ctx.stroke();

  // Bold border, drawn last so it sits crisply over the line ends.
  ctx.strokeStyle = FIELD_BORDER_COLOR;
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  ctx.restore();
}

export const ZONE_FILL_ALPHA = 0.3;
export const ZONE_STROKE_ALPHA = 0.85;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pixel-space positions of the 8 resize handles around a zone's bounding
 *  box (4 edge midpoints, single-axis; 4 corners, both axes). Shared by
 *  rendering and hit-testing so the two never drift apart. */
export function zoneHandlePositions(cx: number, cy: number, rx: number, ry: number): ZoneHandle[] {
  return [
    { x: cx + rx, y: cy, axis: 'x' },
    { x: cx - rx, y: cy, axis: 'x' },
    { x: cx, y: cy + ry, axis: 'y' },
    { x: cx, y: cy - ry, axis: 'y' },
    { x: cx + rx, y: cy + ry, axis: 'both' },
    { x: cx - rx, y: cy + ry, axis: 'both' },
    { x: cx + rx, y: cy - ry, axis: 'both' },
    { x: cx - rx, y: cy - ry, axis: 'both' },
  ];
}

function drawZoneHandles(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, scale: number) {
  const hs = 5 * scale;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1, scale);
  zoneHandlePositions(cx, cy, rx, ry).forEach((h) => {
    ctx.beginPath();
    ctx.rect(h.x - hs, h.y - hs, hs * 2, hs * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Whether a zone's dashed connector line to its icon should be drawn — true
 * once the icon sits meaningfully outside the zone's ellipse.
 *
 * Deliberately ellipse-relative (each axis normalized by its own radius)
 * rather than a raw distance compared against a threshold scaled by
 * max(rx, ry): the latter meant *resizing* the zone changed the very
 * threshold used to decide whether to show the connector, so stretching a
 * zone wide (growing rx) could make the line disappear even though the icon
 * was still visibly outside the ellipse in the y direction. Normalizing per
 * axis makes the check correct for non-circular zones and stable under
 * resize — only actually moving the icon relative to the zone changes the
 * result. Coordinates just need to share a unit (normalized 0–1 or pixel);
 * only their ratios matter.
 */
export function zoneConnectorVisible(
  zone: Pick<Zone, 'cx' | 'cy' | 'rx' | 'ry'>,
  icon: Pick<Pt, 'x' | 'y'> | undefined,
): boolean {
  if (!icon) return false;
  if (zone.rx <= 0 || zone.ry <= 0) return true;
  const normDist = Math.sqrt(
    ((icon.x - zone.cx) / zone.rx) ** 2 + ((icon.y - zone.cy) / zone.ry) ** 2,
  );
  return normDist > 0.6;
}

/** Draws committed zones — translucent fill (field grid shows through),
 *  a connector line back to the icon once the zone has been moved away
 *  from it, and resize handles on the selected zone. */
function drawZones(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  zones: Zone[],
  playerIcons: PlayerIcon[],
  scale: number,
  selectedZoneIndex: number | null,
) {
  zones.forEach((zone, i) => {
    const cx = zone.cx * W;
    const cy = zone.cy * H;
    const rx = Math.max(zone.rx * W, 2);
    const ry = Math.max(zone.ry * H, 2);

    const icon = playerIcons[zone.iconIndex];
    if (icon) {
      const ix = icon.x * W;
      const iy = icon.y * H;
      if (zoneConnectorVisible(zone, icon)) {
        ctx.save();
        ctx.strokeStyle = zone.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.5 * scale;
        ctx.setLineDash([5 * scale, 4 * scale]);
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(zone.color, ZONE_FILL_ALPHA);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(zone.color, ZONE_STROKE_ALPHA);
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.restore();

    if (selectedZoneIndex === i) drawZoneHandles(ctx, cx, cy, rx, ry, scale);
  });
}

/** Pixel-space bounding box for hit-testing / selection outline — computed
 *  from the same font metrics drawTextBoxes renders with, so a click always
 *  matches what's visually there. A little padding keeps very short/empty
 *  boxes (mid-edit) comfortably tappable. */
export function textBoxBounds(ctx: CanvasRenderingContext2D, W: number, H: number, tb: TextBox, scale: number) {
  const cx = tb.x * W;
  const cy = tb.y * H;
  const fontSize = tb.fontSize * scale;
  const lines = tb.text.length > 0 ? tb.text.split('\n') : [''];
  ctx.save();
  ctx.font = TEXT_BOX_FONT(fontSize);
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), 24 * scale);
  ctx.restore();
  const lineHeight = fontSize * TEXT_BOX_LINE_HEIGHT_RATIO;
  const height = Math.max(lineHeight * lines.length, lineHeight);
  const padX = 8 * scale;
  const padY = 6 * scale;
  return { left: cx - width / 2 - padX, right: cx + width / 2 + padX, top: cy - height / 2 - padY, bottom: cy + height / 2 + padY };
}

function drawTextBoxes(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  textBoxes: TextBox[],
  scale: number,
  selectedTextIndex: number | null,
) {
  textBoxes.forEach((tb, i) => {
    const cx = tb.x * W;
    const cy = tb.y * H;
    const fontSize = tb.fontSize * scale;
    const lines = tb.text.split('\n');
    const lineHeight = fontSize * TEXT_BOX_LINE_HEIGHT_RATIO;
    const startY = cy - (lineHeight * (lines.length - 1)) / 2;

    ctx.save();
    ctx.fillStyle = tb.color;
    ctx.font = TEXT_BOX_FONT(fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, li) => ctx.fillText(line, cx, startY + li * lineHeight));
    ctx.restore();

    if (selectedTextIndex === i) {
      const b = textBoxBounds(ctx, W, H, tb, scale);
      ctx.save();
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.setLineDash([5 * scale, 4 * scale]);
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      ctx.restore();
    }
  });
}

/** Optional per-call tweaks, used when stacking two scenes on one canvas. */
export type RenderSceneOptions = {
  /** Skip the clearRect + drawField pair so this scene layers over what's
   *  already on the context instead of wiping it. */
  skipFieldReset?: boolean;
  /** Size icons as if this many were on the field, rather than
   *  playerIcons.length — see renderOverlayScene for why. */
  iconCountOverride?: number;
};

/**
 * Render a complete play scene (field, zones, routes, icons) onto a context
 * at any pixel size. All input data is in normalized 0–1 coordinates; visual
 * sizes scale relative to REF_SIZE so proportions stay constant everywhere —
 * on-screen editing, thumbnails, and print export all look identical.
 *
 * `paths` may be passed with each route's `points` truncated to a prefix of
 * its full array — callers (e.g. a draw-in animation) can use this to render
 * a route mid-stroke without any other change to the rendering logic.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  paths: PathItem[],
  playerIcons: PlayerIcon[],
  zones: Zone[] = [],
  selectedZoneIndex: number | null = null,
  textBoxes: TextBox[] = [],
  selectedTextIndex: number | null = null,
  opts: RenderSceneOptions = {},
) {
  const scale = Math.min(W, H) / REF_SIZE;
  const toPx = (p: Pt): Pt => ({ x: p.x * W, y: p.y * H });
  const lineWidth = ROUTE_LINE_WIDTH * scale;
  const arrowSize = ARROWHEAD_SIZE * scale;
  const iconSize =
    PLAYER_SIZE * scale * iconScaleForCount(opts.iconCountOverride ?? playerIcons.length);

  if (!opts.skipFieldReset) {
    ctx.clearRect(0, 0, W, H);
    drawField(ctx, W, H, scale);
  }
  // Zones sit on top of the grid (translucent, so it shows through) but
  // underneath routes/icons, which should stay crisp.
  drawZones(ctx, W, H, zones, playerIcons, scale, selectedZoneIndex);

  // Routes — every path is a complete, independent route (a player may have
  // up to 2, e.g. a short option and a deep option), so every one gets its
  // own arrowhead at its own end.
  paths.forEach((p) => {
    const pts = p.points.map(toPx);
    // p.mode === 'block' is the back-compat fallback for plays saved before
    // capStyle existed, when 'block' was a whole mode rather than an ending.
    const useBlockCap = p.capStyle === 'block' || p.mode === 'block';
    // Stop the stroked line short of the tip so it tucks behind the
    // arrowhead. Skipped for the block cap, which sits on the endpoint
    // rather than tapering to it.
    const stroked = !useBlockCap ? trimEnd(pts, arrowSize * 0.8) : pts;
    // trimEnd only ever removes/rewrites points from the tail, so the
    // first `stroked.length - 1` entries of the original per-segment
    // array still line up with the segments still visually present —
    // resolve against the untrimmed points, then slice to match.
    const styles = resolveSegmentStyles(p).slice(0, stroked.length - 1);
    strokeStyledRuns(ctx, stroked, styles, p.color, lineWidth, p.mode === 'waypoint');
    if (useBlockCap) drawBlockCap(ctx, pts, p.color, arrowSize);
    else drawArrowhead(ctx, pts, p.color, arrowSize);
  });

  // Player icons
  playerIcons.forEach((icon) => {
    const c = toPx(icon);
    const shape = iconShape(icon);
    ctx.save();
    ctx.fillStyle = icon.color;
    fillIconShape(ctx, c.x, c.y, iconSize, shape);
    ctx.fillStyle = '#fff';
    // Base sizes match the original fixed rosters (1 char full, 2 char 0.72);
    // longer custom labels shrink further until they fit inside the icon.
    let fontSize = (icon.letter.length > 1 ? PLAYER_FONT * 0.72 : PLAYER_FONT) * scale;
    ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
    const maxTextWidth = iconSize * TEXT_FIT[shape];
    const textWidth = ctx.measureText(icon.letter).width;
    if (textWidth > maxTextWidth) {
      fontSize *= maxTextWidth / textWidth;
      ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon.letter, c.x, c.y);
    ctx.restore();
  });

  // Text annotations sit on top of everything — they're meant to stay
  // legible over routes/zones/icons, like handwriting on a printed diagram.
  drawTextBoxes(ctx, W, H, textBoxes, scale, selectedTextIndex);
}

/** One play's drawable contents — the parsed shape of plays.canvas_data. */
export type SceneLayer = {
  paths: PathItem[];
  playerIcons: PlayerIcon[];
  zones: Zone[];
  textBoxes: TextBox[];
};

/**
 * Draw an offensive play with a defensive play stacked on the same field, for
 * the read-only "vs. defense" view where a coach cycles defensive looks against
 * one offense.
 *
 * No coordinate transform is involved: the field window is universal
 * (FIELD_YARDS_ABOVE_LOS / BELOW_LOS) and offense is drawn below the LOS while
 * defense is drawn above it, so the two scenes already occupy opposite halves.
 *
 * The two plays are rendered as two separate calls rather than by concatenating
 * their arrays, because PathItem.startIconIndex and Zone.iconIndex are indexes
 * into the *same call's* playerIcons — merging would mean re-basing every
 * defensive index.
 */
export function renderOverlayScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  offense: SceneLayer,
  defense: SceneLayer | null,
) {
  // Each side keeps the icon size it has when viewed alone. Summing both
  // rosters would push a 5v5-on-5v5 matchup to 10 icons and shrink everything
  // to the 0.8 floor, even though neither play is crowded.
  const iconCountOverride = Math.max(
    offense.playerIcons.length,
    defense?.playerIcons.length ?? 0,
  );

  // Defense first, so its coverage zones sit underneath the offensive routes
  // the quarterback is being taught to read.
  if (defense) {
    renderScene(
      ctx, W, H,
      defense.paths, defense.playerIcons, defense.zones, null, defense.textBoxes, null,
      { iconCountOverride },
    );
  }
  renderScene(
    ctx, W, H,
    offense.paths, offense.playerIcons, offense.zones, null, offense.textBoxes, null,
    { skipFieldReset: !!defense, iconCountOverride },
  );
}
