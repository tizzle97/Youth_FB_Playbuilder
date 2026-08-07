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
  /** Dashed vs solid stroke. Omitted/undefined means solid. */
  dashed?: boolean;
  /** Per-segment dash override for a 'straight' mode path — index i is the
   *  style of the segment from points[i] to points[i+1], so length must equal
   *  points.length-1 when present. Omitted means every segment uses `dashed`
   *  above, which covers every pre-existing saved play and any route that was
   *  never toggled mid-draw — no migration, no version bump, same pattern as
   *  `dashed`/`capStyle` themselves. Never set for 'waypoint' mode: splitting
   *  a curved route's quadratic-smoothed stroke at an interior point changes
   *  the curve's shape, not just its dash pattern (the curve is drawn through
   *  the midpoints between points, never touching an interior point itself —
   *  forcing a split to land exactly on one distorts the silhouette). See
   *  resolveSegmentDash(). */
  segmentDashed?: boolean[];
};

/** The per-segment dash style to actually render/edit, honoring the
 *  whole-path `dashed` fallback. Falls back even if `segmentDashed` is
 *  present but the wrong length (e.g. a hand-edited or corrupted save),
 *  rather than let a misaligned array silently attach the wrong style to the
 *  wrong segment. */
export function resolveSegmentDash(path: Pick<PathItem, 'points' | 'dashed' | 'segmentDashed'>): boolean[] {
  const segmentCount = Math.max(0, path.points.length - 1);
  if (path.segmentDashed && path.segmentDashed.length === segmentCount) return path.segmentDashed;
  return new Array(segmentCount).fill(!!path.dashed);
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

/**
 * Strokes contiguous same-style runs of a polyline separately, so a route can
 * mix solid and dashed segments. `segDash[i]` is the style of the segment
 * from `pts[i]` to `pts[i+1]`, so `segDash.length === pts.length - 1`.
 *
 * Only used for 'straight' mode (plain `lineTo` between points), where
 * splitting is exact — each run is a literal sub-polyline of the original,
 * so this is pixel-identical to a single stroke() call when every entry in
 * `segDash` is the same (the common case: nobody toggled mid-route). Do NOT
 * use this for the quadratic-smoothed 'waypoint' mode — see the PathItem
 * comment on `segmentDashed`.
 */
export function strokeRuns(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  segDash: boolean[],
  color: string,
  lw: number,
) {
  if (pts.length < 2 || segDash.length !== pts.length - 1) {
    strokeStraight(ctx, pts, color, lw);
    return;
  }
  let runStart = 0;
  for (let i = 0; i <= segDash.length; i++) {
    if (i === segDash.length || segDash[i] !== segDash[runStart]) {
      ctx.save();
      ctx.setLineDash(segDash[runStart] ? [lw * 2.5, lw * 2] : []);
      strokeStraight(ctx, pts.slice(runStart, i + 1), color, lw);
      ctx.restore();
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
      const dist = Math.sqrt((ix - cx) ** 2 + (iy - cy) ** 2);
      if (dist > Math.max(rx, ry) * 0.6) {
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
) {
  const scale = Math.min(W, H) / REF_SIZE;
  const toPx = (p: Pt): Pt => ({ x: p.x * W, y: p.y * H });
  const lineWidth = ROUTE_LINE_WIDTH * scale;
  const arrowSize = ARROWHEAD_SIZE * scale;
  const iconSize = PLAYER_SIZE * scale * iconScaleForCount(playerIcons.length);

  ctx.clearRect(0, 0, W, H);
  drawField(ctx, W, H, scale);
  // Zones sit on top of the grid (translucent, so it shows through) but
  // underneath routes/icons, which should stay crisp.
  drawZones(ctx, W, H, zones, playerIcons, scale, selectedZoneIndex);

  // Routes — arrowhead only on the last path of each icon's chain
  const lastByIcon = new Map<number, number>();
  paths.forEach((p, i) => { if (p.startIconIndex !== undefined) lastByIcon.set(p.startIconIndex, i); });

  paths.forEach((p, i) => {
    const pts = p.points.map(toPx);
    const isLast = p.startIconIndex !== undefined ? lastByIcon.get(p.startIconIndex) === i : true;
    // p.mode === 'block' is the back-compat fallback for plays saved before
    // capStyle existed, when 'block' was a whole mode rather than an ending.
    const useBlockCap = p.capStyle === 'block' || p.mode === 'block';
    // Stop the stroked line short of the tip so it tucks behind the
    // arrowhead. Skipped for the block cap, which sits on the endpoint
    // rather than tapering to it.
    const stroked = isLast && !useBlockCap ? trimEnd(pts, arrowSize * 0.8) : pts;
    if (p.mode === 'waypoint') {
      ctx.save();
      ctx.setLineDash(p.dashed ? [lineWidth * 2.5, lineWidth * 2] : []);
      strokeRoute(ctx, stroked, p.color, lineWidth);
      ctx.restore();
    } else if (p.segmentDashed) {
      // trimEnd only ever removes/rewrites points from the tail, so the
      // first `stroked.length - 1` entries of the original per-segment
      // array still line up with the segments still visually present —
      // resolve against the untrimmed points, then slice to match.
      const segDash = resolveSegmentDash(p).slice(0, stroked.length - 1);
      strokeRuns(ctx, stroked, segDash, p.color, lineWidth);
    } else {
      ctx.save();
      ctx.setLineDash(p.dashed ? [lineWidth * 2.5, lineWidth * 2] : []);
      strokeStraight(ctx, stroked, p.color, lineWidth);
      ctx.restore();
    }
    if (isLast) {
      if (useBlockCap) drawBlockCap(ctx, pts, p.color, arrowSize);
      else drawArrowhead(ctx, pts, p.color, arrowSize);
    }
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
