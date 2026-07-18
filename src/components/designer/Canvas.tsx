import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { PlayerStyleEditor } from './PlayerStyleEditor';

// ---------------------------------------------
// Config
// ---------------------------------------------
// All play data (icons, route points) is stored in NORMALIZED coordinates
// (0–1 fractions of the field), so a play renders identically on any screen
// size and at any export resolution. Visual sizes below are defined at a
// reference canvas size and scaled proportionally when rendering.
const REF_SIZE = 600; // reference min(width, height) the base sizes were designed at

const ROUTE_LINE_WIDTH = 3;
const ARROWHEAD_SIZE = 14;
const PLAYER_SIZE = 36;
const PLAYER_FONT = 16;

const FIELD_BG = '#FFFFFF';
const SIDELINE_PADDING = 8;
const SIDELINE_BORDER_COLOR = '#E0E0E0';
const YARD_LINE_COLOR = '#D8D8D8';
const HASH_COLOR = '#B0B0B0';
const HASH_TICK_LEN = 10;
const LOS_COLOR = '#1a1a1a';
const FIELD_YARDS_ABOVE_LOS = 15;
const FIELD_YARDS_BELOW_LOS = 10;
const TOTAL_FIELD_YARDS = FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS;

// Visio-style snapping: icons magnetize to other icons' rows/columns and the
// field centerline within this screen-pixel radius; otherwise y quantizes to
// the 1-yard grid. Guides render in amber (the app's "attention" color).
const SNAP_PX = 8;
const GUIDE_COLOR = '#f59e0b';

// Minimum on-screen travel (in pixels) before a pointer-down-then-move on an
// icon counts as a drag rather than tap jitter. Below this, pointer-up opens
// the tap-to-customize popover instead.
const DRAG_THRESHOLD_PX = 4;
const HASH_LEFT_X_RATIO = 70.75 / 160;
const HASH_RIGHT_X_RATIO = 1 - HASH_LEFT_X_RATIO;

// Fixed export resolution (letter-page proportions) — every play prints
// the same regardless of the screen it was designed on. The on-screen
// canvas is locked to this aspect ratio too (PlayDesigner's resize
// handler), so shapes — zone ellipses especially — look the same on
// screen as in the printed PDF.
export const EXPORT_WIDTH = 1650;
export const EXPORT_HEIGHT = 1275;

// ---------------------------------------------
// Types
// ---------------------------------------------
export type DrawMode = 'straight' | 'waypoint';

type Pt = { x: number; y: number }; // normalized 0–1

export type PathItem = {
  points: Pt[];
  color: string;
  startIconIndex?: number;
  mode: DrawMode;
};

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

// Formation templates (B-24) are authored relative to the line of scrimmage
// rather than raw 0–1 coordinates, so exporting these lets formations.ts stay
// in sync with the canvas's own LOS math instead of duplicating constants.
export { FIELD_YARDS_ABOVE_LOS, FIELD_YARDS_BELOW_LOS, TOTAL_FIELD_YARDS };

/** Resolve an icon's shape, honoring the pre-`shape` isSquare flag. */
const iconShape = (icon: { shape?: IconShape; isSquare?: boolean }): IconShape =>
  icon.shape ?? (icon.isSquare ? 'square' : 'circle');

/** A defender's zone of responsibility — an ellipse anchored to (but
 *  independently movable/resizable from) a player icon. */
export type Zone = {
  iconIndex: number; // index into playerIcons
  cx: number; cy: number; // normalized 0–1, ellipse center
  rx: number; ry: number; // normalized 0–1, horizontal/vertical radii
  color: string; // snapshot of the icon's color at creation time
};

type ZoneHandleAxis = 'x' | 'y' | 'both';
type ZoneHandle = { x: number; y: number; axis: ZoneHandleAxis };

type CanvasProps = {
  width: number;
  height: number;
  drawingMode: boolean;
  drawMode: DrawMode;
  deleteRouteMode: boolean;
  zoneMode: boolean;
  deleteZoneMode: boolean;
  snapEnabled: boolean;
  selectedPlayer: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null;
  setSelectedPlayer: (p: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => void;
  onDrawingComplete?: (points: Pt[]) => void;
  /** Notifies the parent whenever undo/redo availability changes, so toolbar
   *  buttons reflect this canvas's internal history (which the parent can't
   *  otherwise observe — it never re-renders on a canvas-only edit). */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Select-mode drag on empty field reports pointer deltas (screen px) so
   *  the parent can pan its scroll container when the canvas is zoomed. */
  onPan?: (dxPx: number, dyPx: number) => void;
  id?: string;
};

export type CanvasHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  clearRoutes: () => void;
  removeRouteForIcon: (iconIndex: number) => void;
  loadState: (data: { paths: PathItem[]; playerIcons: PlayerIcon[]; zones?: Zone[] }) => void;
  /** Replaces the whole scene with a formation template's icons (paths and
   *  zones are cleared too, since they'd otherwise reference stale icon
   *  indices) as a single undo entry — used to stamp a formation template. */
  stampFormation: (icons: PlayerIcon[]) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getPaths: () => PathItem[];
  getIcons: () => PlayerIcon[];
  getZones: () => Zone[];
  getCanvas: () => HTMLCanvasElement | null;
  /** Render the play at a fixed standard resolution; returns a PNG data URL. */
  exportImage: (width?: number, height?: number) => string;
};

// ---------------------------------------------
// Rendering (pure functions over normalized data)
// ---------------------------------------------
const yFromYards = (yards: number, H: number) =>
  ((yards + FIELD_YARDS_ABOVE_LOS) / (FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS)) * H;

function strokeRoute(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw: number) {
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

function strokeStraight(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw: number) {
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
 * Shorten a polyline from its end by `dist` pixels so the stroked line
 * tucks behind the arrowhead instead of poking past its tip.
 */
function trimEnd(pts: Pt[], dist: number): Pt[] {
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

function drawArrowhead(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, size: number) {
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
  ctx.strokeStyle = SIDELINE_BORDER_COLOR;
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  // Yard lines
  ctx.strokeStyle = YARD_LINE_COLOR;
  ctx.lineWidth = Math.max(1, scale);
  for (let y = -FIELD_YARDS_ABOVE_LOS; y <= FIELD_YARDS_BELOW_LOS; y += 5) {
    const py = yFromYards(y, H);
    ctx.beginPath();
    ctx.moveTo(pad, py);
    ctx.lineTo(W - pad, py);
    ctx.stroke();
  }

  // Line of scrimmage
  const losY = yFromYards(0, H);
  ctx.strokeStyle = LOS_COLOR;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(pad, losY);
  ctx.lineTo(W - pad, losY);
  ctx.stroke();

  // Hash marks
  ctx.strokeStyle = HASH_COLOR;
  ctx.lineWidth = Math.max(1, scale);
  const tick = HASH_TICK_LEN * scale;
  const lhx = pad + (W - pad * 2) * HASH_LEFT_X_RATIO;
  const rhx = pad + (W - pad * 2) * HASH_RIGHT_X_RATIO;
  for (let y = -FIELD_YARDS_ABOVE_LOS; y <= FIELD_YARDS_BELOW_LOS; y += 1) {
    const py = yFromYards(y, H);
    ctx.beginPath(); ctx.moveTo(lhx - tick / 2, py); ctx.lineTo(lhx + tick / 2, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rhx - tick / 2, py); ctx.lineTo(rhx + tick / 2, py); ctx.stroke();
  }
  ctx.restore();
}

/** Smallest radius (normalized) a zone can have — keeps a plain tap-no-drag
 *  zone creation visible instead of invisibly tiny. */
const MIN_ZONE_RADIUS = 0.035;
const ZONE_FILL_ALPHA = 0.3;
const ZONE_STROKE_ALPHA = 0.85;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pixel-space positions of the 8 resize handles around a zone's bounding
 *  box (4 edge midpoints, single-axis; 4 corners, both axes). Shared by
 *  rendering and hit-testing so the two never drift apart. */
function zoneHandlePositions(cx: number, cy: number, rx: number, ry: number): ZoneHandle[] {
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

/**
 * Render a complete play scene (field, zones, routes, icons) onto a context
 * at any pixel size. All input data is in normalized 0–1 coordinates; visual
 * sizes scale relative to REF_SIZE so proportions stay constant everywhere —
 * on-screen editing, thumbnails, and print export all look identical.
 */
function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  paths: PathItem[],
  playerIcons: PlayerIcon[],
  zones: Zone[] = [],
  selectedZoneIndex: number | null = null,
) {
  const scale = Math.min(W, H) / REF_SIZE;
  const toPx = (p: Pt): Pt => ({ x: p.x * W, y: p.y * H });
  const lineWidth = ROUTE_LINE_WIDTH * scale;
  const arrowSize = ARROWHEAD_SIZE * scale;
  const iconSize = PLAYER_SIZE * scale;

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
    // Stop the stroked line short of the tip so it tucks behind the arrowhead
    const stroked = isLast ? trimEnd(pts, arrowSize * 0.8) : pts;
    if (p.mode === 'straight') {
      strokeStraight(ctx, stroked, p.color, lineWidth);
    } else {
      strokeRoute(ctx, stroked, p.color, lineWidth);
    }
    if (isLast) drawArrowhead(ctx, pts, p.color, arrowSize);
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
}

// ---------------------------------------------
// Component
// ---------------------------------------------
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, drawingMode, drawMode, deleteRouteMode, zoneMode, deleteZoneMode, snapEnabled, selectedPlayer, setSelectedPlayer, onDrawingComplete, onHistoryChange, onPan, id }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [paths, setPaths] = useState<PathItem[]>([]);
    const [playerIcons, setPlayerIcons] = useState<PlayerIcon[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [undoStack, setUndoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[]; zones: Zone[] }>>([]);
    const [redoStack, setRedoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[]; zones: Zone[] }>>([]);

    // Waypoint mode state (normalized coords)
    const [waypointPoints, setWaypointPoints] = useState<Pt[]>([]);
    const [waypointColor, setWaypointColor] = useState('#e05a1e');
    const [waypointIconIndex, setWaypointIconIndex] = useState<number | null>(null);
    const lastTapRef = useRef<number>(0);

    // Hover highlight (shows which icon will be used as route origin)
    const [hoveredIconIndex, setHoveredIconIndex] = useState<number | null>(null);

    // Route-saved flash
    const [savedFlash, setSavedFlash] = useState(false);
    const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Flash shown when user tries to draw a second route on an icon that already has one
    const [conflictFlash, setConflictFlash] = useState(false);
    const conflictFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Flash shown when user taps a different icon while a route is already in progress
    const [finishFirstFlash, setFinishFirstFlash] = useState(false);
    const finishFirstFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Flash shown when a route is successfully deleted in delete-route mode
    const [deletedFlash, setDeletedFlash] = useState(false);
    const deletedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Flash shown when a zone is successfully deleted in delete-zone mode
    const [deletedZoneFlash, setDeletedZoneFlash] = useState(false);
    const deletedZoneFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const draggingIndexRef = useRef<number | null>(null);
    const dragOffsetRef = useRef<Pt>({ x: 0, y: 0 });
    // Pointer-down position, used to tell a real drag from tap jitter (see
    // dragMovedRef below).
    const dragStartRef = useRef<Pt>({ x: 0, y: 0 });
    // Whether the current drag has actually moved the icon yet. The undo
    // snapshot is pushed on the first real move, not on pointer-down, so a
    // plain tap (no movement) doesn't create a no-op history entry that
    // would swallow the next undo press. Real pointer devices (mice,
    // trackpads, touchscreens) commonly fire at least one pointermove event
    // during what a user experiences as a stationary tap, so this only
    // flips once the pointer has actually traveled past DRAG_THRESHOLD_PX —
    // otherwise every real-world tap would register as a (near-zero) drag
    // and the tap-to-customize popover below would never open.
    const dragMovedRef = useRef(false);

    // Icon being edited via the tap-to-customize popover (Select mode only).
    const [editingIconIndex, setEditingIconIndex] = useState<number | null>(null);

    // Alignment guide lines shown while a drag is snapped to another icon's
    // row/column or the field centerline (normalized coords, null = none).
    // distX/distY carry B-17 equal-spacing bracket geometry when the snap
    // landed on the midpoint between two row/column neighbors.
    const [activeGuides, setActiveGuides] = useState<{
      x: number | null;
      y: number | null;
      distX?: { ax: number; bx: number; y: number } | null;
      distY?: { ay: number; by: number; x: number } | null;
    }>({ x: null, y: null, distX: null, distY: null });

    // Zone creation: a single continuous drag from an icon outward. Held in
    // state (not just a ref) so the live preview redraws as it changes.
    const [zoneDraft, setZoneDraft] = useState<{ iconIndex: number; cx: number; cy: number; rx: number; ry: number } | null>(null);
    // Currently selected zone (for showing resize handles / enabling move).
    const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
    // In-flight resize-or-move gesture on the selected zone. Like icon
    // dragging, the undo snapshot is deferred to the first actual move.
    const zoneGestureRef = useRef<{ type: 'move' | 'resize'; zoneIndex: number; axis?: ZoneHandleAxis; offset?: Pt; moved: boolean } | null>(null);
    // Select-mode pan gesture: last pointer position in client (screen) px.
    const panLastRef = useRef<{ x: number; y: number } | null>(null);

    const pushSnapshot = useCallback(() => {
      setUndoStack((prev) => [...prev, {
        paths: [...paths],
        playerIcons: playerIcons.map((i) => ({ ...i })),
        zones: zones.map((z) => ({ ...z })),
      }]);
      setRedoStack([]);
    }, [paths, playerIcons, zones]);

    /** Restyle an icon (label, color, shape) and keep its dependent artwork in
     *  sync: routes drawn from it and its zone always match the icon's color.
     *  isSquare stays mirrored so legacy readers of canvas_data still work. */
    const applyIconStyle = useCallback((idx: number, letter: string, color: string, shape: IconShape) => {
      pushSnapshot();
      setPlayerIcons((prev) => { const c = [...prev]; c[idx] = { ...c[idx], letter, color, shape, isSquare: shape === 'square' }; return c; });
      setPaths((prev) => prev.map((p) => (p.startIconIndex === idx ? { ...p, color } : p)));
      setZones((prev) => prev.map((z) => (z.iconIndex === idx ? { ...z, color } : z)));
    }, [pushSnapshot]);

    /** Visio-style snap for a prospective icon position. X magnetizes to other
     *  icons' columns or the field centerline; Y magnetizes to other icons'
     *  rows, falling back to the 1-yard grid (so depths stay consistent and
     *  the LOS, itself a yard line, is always hittable). Icon alignment wins
     *  over the grid; thresholds are in screen pixels, computed per axis since
     *  the canvas is non-square.
     *
     *  B-17: when the position sits between two icons sharing its row (or
     *  column), the equidistant midpoint competes in the same per-axis
     *  nearest-candidate contest — winning produces distX/distY so the
     *  overlay can render equal-spacing brackets instead of a plain line. */
    const computeSnap = useCallback((p: Pt, excludeIndex: number | null): {
      pos: Pt;
      guideX: number | null;
      guideY: number | null;
      distX: { ax: number; bx: number; y: number } | null;
      distY: { ay: number; by: number; x: number } | null;
    } => {
      if (!snapEnabled) return { pos: p, guideX: null, guideY: null, distX: null, distY: null };
      let x = p.x;
      let y = p.y;
      let guideX: number | null = null;
      let guideY: number | null = null;
      let distX: { ax: number; bx: number; y: number } | null = null;
      let distY: { ay: number; by: number; x: number } | null = null;

      let bestDx = SNAP_PX;
      const snapX = (cand: number) => {
        const d = Math.abs(cand - p.x) * width;
        if (d < bestDx) { bestDx = d; x = cand; guideX = cand; }
      };
      playerIcons.forEach((icon, i) => { if (i !== excludeIndex) snapX(icon.x); });
      snapX(0.5); // field centerline — puts the Center/QB dead-center

      let bestDy = SNAP_PX;
      playerIcons.forEach((icon, i) => {
        if (i === excludeIndex) return;
        const d = Math.abs(icon.y - p.y) * height;
        if (d < bestDy) { bestDy = d; y = icon.y; guideY = icon.y; }
      });

      // Distribution X: midpoints of icon pairs on this row (the y resolved
      // above), considered only while the position is between the pair. Ties
      // go to plain column alignment, which ran first.
      const others = playerIcons.filter((_, i) => i !== excludeIndex);
      const rowIcons = others.filter((icon) => Math.abs(icon.y - y) * height < 0.5);
      for (let i = 0; i < rowIcons.length; i++) {
        for (let j = i + 1; j < rowIcons.length; j++) {
          const ax = Math.min(rowIcons[i].x, rowIcons[j].x);
          const bx = Math.max(rowIcons[i].x, rowIcons[j].x);
          if (p.x <= ax || p.x >= bx) continue;
          const d = Math.abs((ax + bx) / 2 - p.x) * width;
          if (d < bestDx) { bestDx = d; x = (ax + bx) / 2; guideX = null; distX = { ax, bx, y }; }
        }
      }

      // Distribution Y: same idea down a column (the x resolved above).
      const colIcons = others.filter((icon) => Math.abs(icon.x - x) * width < 0.5);
      for (let i = 0; i < colIcons.length; i++) {
        for (let j = i + 1; j < colIcons.length; j++) {
          const ay = Math.min(colIcons[i].y, colIcons[j].y);
          const by = Math.max(colIcons[i].y, colIcons[j].y);
          if (p.y <= ay || p.y >= by) continue;
          const d = Math.abs((ay + by) / 2 - p.y) * height;
          if (d < bestDy) { bestDy = d; y = (ay + by) / 2; guideY = null; distY = { ay, by, x }; }
        }
      }

      if (guideY === null && distY === null) {
        y = Math.round(p.y * TOTAL_FIELD_YARDS) / TOTAL_FIELD_YARDS;
      }

      return { pos: { x, y }, guideX, guideY, distX, distY };
    }, [snapEnabled, playerIcons, width, height]);

    // Current on-screen scaling helpers
    const screenScale = Math.min(width, height) / REF_SIZE;
    const iconRadiusPx = (PLAYER_SIZE * screenScale) / 2;

    /** True if the given icon index already has at least one saved route. */
    const iconHasRoute = useCallback(
      (idx: number) => paths.some((p) => p.startIconIndex === idx),
      [paths],
    );

    /** True if the given icon index already has a zone. */
    const iconHasZone = useCallback(
      (idx: number) => zones.some((z) => z.iconIndex === idx),
      [zones],
    );

    const findZoneByIcon = useCallback(
      (iconIdx: number) => zones.findIndex((z) => z.iconIndex === iconIdx),
      [zones],
    );

    /** Point-in-ellipse hit test (normalized coords), topmost zone first. */
    const findZoneAt = useCallback((p: Pt): number => {
      for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i];
        const dx = (p.x - z.cx) / Math.max(z.rx, 0.001);
        const dy = (p.y - z.cy) / Math.max(z.ry, 0.001);
        if (dx * dx + dy * dy <= 1) return i;
      }
      return -1;
    }, [zones]);

    /** Which resize handle (if any) of `zone` the point is over, in pixel space. */
    const findZoneHandle = useCallback((p: Pt, zone: Zone): ZoneHandleAxis | null => {
      const cxPx = zone.cx * width, cyPx = zone.cy * height;
      const rxPx = zone.rx * width, ryPx = zone.ry * height;
      const pxPx = p.x * width, pyPx = p.y * height;
      const hitRadius = Math.max(14, iconRadiusPx * 0.5);
      for (const h of zoneHandlePositions(cxPx, cyPx, rxPx, ryPx)) {
        const dx = h.x - pxPx, dy = h.y - pyPx;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) return h.axis;
      }
      return null;
    }, [width, height, iconRadiusPx]);

    // ------------------------------------------
    // Full redraw (scene + interactive overlays)
    // ------------------------------------------
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const scale = Math.min(W, H) / REF_SIZE;
      const toPx = (p: Pt): Pt => ({ x: p.x * W, y: p.y * H });

      renderScene(ctx, W, H, paths, playerIcons, zones, selectedZoneIndex);

      // Alignment guides while a drag is snapped to a row/column/centerline
      if (activeGuides.x !== null || activeGuides.y !== null) {
        ctx.save();
        ctx.strokeStyle = GUIDE_COLOR;
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.setLineDash([6 * scale, 4 * scale]);
        ctx.globalAlpha = 0.9;
        if (activeGuides.x !== null) {
          ctx.beginPath();
          ctx.moveTo(activeGuides.x * W, 0);
          ctx.lineTo(activeGuides.x * W, H);
          ctx.stroke();
        }
        if (activeGuides.y !== null) {
          ctx.beginPath();
          ctx.moveTo(0, activeGuides.y * H);
          ctx.lineTo(W, activeGuides.y * H);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // B-17 equal-spacing brackets: two tick-ended segments (neighbor →
      // dragged icon → neighbor) floating just off the row/column, showing
      // the two gaps are equal.
      if (activeGuides.distX || activeGuides.distY) {
        ctx.save();
        ctx.strokeStyle = GUIDE_COLOR;
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.globalAlpha = 0.9;
        const tick = 5 * scale;
        const off = (PLAYER_SIZE * scale) / 2 + 10 * scale;
        if (activeGuides.distX) {
          const { ax, bx, y: ry } = activeGuides.distX;
          const gy = ry * H - off;
          const mx = ((ax + bx) / 2) * W;
          for (const [x1, x2] of [[ax * W, mx], [mx, bx * W]] as const) {
            ctx.beginPath();
            ctx.moveTo(x1, gy); ctx.lineTo(x2, gy);
            ctx.moveTo(x1, gy - tick); ctx.lineTo(x1, gy + tick);
            ctx.moveTo(x2, gy - tick); ctx.lineTo(x2, gy + tick);
            ctx.stroke();
          }
        }
        if (activeGuides.distY) {
          const { ay, by, x: cx } = activeGuides.distY;
          const gx = cx * W - off;
          const my = ((ay + by) / 2) * H;
          for (const [y1, y2] of [[ay * H, my], [my, by * H]] as const) {
            ctx.beginPath();
            ctx.moveTo(gx, y1); ctx.lineTo(gx, y2);
            ctx.moveTo(gx - tick, y1); ctx.lineTo(gx + tick, y1);
            ctx.moveTo(gx - tick, y2); ctx.lineTo(gx + tick, y2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // In-progress zone creation preview (not yet committed to `zones`)
      if (zoneDraft) {
        const cx = zoneDraft.cx * W;
        const cy = zoneDraft.cy * H;
        const rx = Math.max(zoneDraft.rx * W, 2);
        const ry = Math.max(zoneDraft.ry * H, 2);
        const draftColor = playerIcons[zoneDraft.iconIndex]?.color || '#888888';
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(draftColor, ZONE_FILL_ALPHA);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(draftColor, ZONE_STROKE_ALPHA);
        ctx.lineWidth = 2 * scale;
        ctx.setLineDash([4 * scale, 3 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // In-progress route preview
      if (waypointPoints.length >= 1) {
        const pts = waypointPoints.map(toPx);
        const stroked = pts.length >= 2 ? trimEnd(pts, ARROWHEAD_SIZE * scale * 0.8) : pts;
        if (drawMode === 'straight') {
          strokeStraight(ctx, stroked, waypointColor, ROUTE_LINE_WIDTH * scale);
          pts.slice(1).forEach((pt) => {
            ctx.save();
            ctx.fillStyle = waypointColor;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        } else {
          strokeRoute(ctx, stroked, waypointColor, ROUTE_LINE_WIDTH * scale);
        }
        if (pts.length >= 2) drawArrowhead(ctx, pts, waypointColor, ARROWHEAD_SIZE * scale);
      }

      const ringRadius = (PLAYER_SIZE * scale) / 2;

      // Origin-locked indicator (solid bright ring)
      if (waypointPoints.length >= 1 && waypointIconIndex !== null && playerIcons[waypointIconIndex]) {
        const oi = toPx(playerIcons[waypointIconIndex]);
        const color = playerIcons[waypointIconIndex].color;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 24 * scale;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.arc(oi.x, oi.y, ringRadius + 9 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5 * scale;
        ctx.beginPath();
        ctx.arc(oi.x, oi.y, ringRadius + 9 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Hover highlight ring — only when no origin is locked yet
      if (waypointPoints.length === 0 && hoveredIconIndex !== null && playerIcons[hoveredIconIndex]) {
        const hi = toPx(playerIcons[hoveredIconIndex]);
        const hasRoute = iconHasRoute(hoveredIconIndex);
        const hasZone = iconHasZone(hoveredIconIndex);
        // Color depends on context:
        //   delete mode (route or zone) → amber (will delete)
        //   drawing/zone mode + icon already has that thing → red (blocked)
        //   normal drawing mode → icon color
        const blocked = (drawingMode && hasRoute) || (zoneMode && hasZone);
        const ringColor = (deleteRouteMode || deleteZoneMode)
          ? '#f59e0b'
          : (blocked ? '#ef4444' : playerIcons[hoveredIconIndex].color);
        ctx.save();
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 18 * scale;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 3 * scale;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(hi.x, hi.y, ringRadius + 7 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.setLineDash([4 * scale, 3 * scale]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(hi.x, hi.y, ringRadius + 7 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }, [paths, playerIcons, zones, selectedZoneIndex, zoneDraft, activeGuides, waypointPoints, waypointColor, waypointIconIndex, hoveredIconIndex, drawMode, deleteRouteMode, drawingMode, zoneMode, deleteZoneMode, iconHasRoute, iconHasZone]);

    // Redraw on state change
    useEffect(() => { draw(); }, [draw]);

    // Keep the parent's undo/redo button state in sync with this canvas's
    // internal history stacks. An in-progress route counts toward canUndo
    // even before it's committed — see the undo() comment below.
    useEffect(() => {
      onHistoryChange?.({
        canUndo: undoStack.length > 0 || waypointPoints.length > 0,
        // Redo is a no-op while a route is mid-draw (see redo() below) — keep
        // the button's enabled state consistent with what clicking it does.
        canRedo: redoStack.length > 0 && waypointPoints.length === 0,
      });
    }, [undoStack.length, redoStack.length, waypointPoints.length, onHistoryChange]);

    // Sync canvas size
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      draw();
    }, [width, height, draw]);

    // Clear in-progress segments when switching draw modes
    useEffect(() => {
      setWaypointPoints([]);
      setWaypointIconIndex(null);
      setHoveredIconIndex(null);
    }, [drawMode]);

    // Clear in-progress segments when drawing mode is turned off
    // (e.g. user selects a player from the toolbar, which disables drawing mode)
    useEffect(() => {
      if (!drawingMode) {
        setWaypointPoints([]);
        setWaypointIconIndex(null);
        setHoveredIconIndex(null);
      }
    }, [drawingMode]);

    // Deselect any zone (hide its resize handles) and drop an in-progress
    // zone draft when switching tools, so stale handles don't linger.
    useEffect(() => {
      setSelectedZoneIndex(null);
      setZoneDraft(null);
    }, [zoneMode, deleteZoneMode, drawingMode]);

    // Close the icon-edit popover whenever any tool takes over the canvas —
    // it only makes sense in plain Select mode.
    useEffect(() => {
      if (drawingMode || zoneMode || deleteRouteMode || deleteZoneMode || selectedPlayer) {
        setEditingIconIndex(null);
      }
    }, [drawingMode, zoneMode, deleteRouteMode, deleteZoneMode, selectedPlayer]);

    // ------------------------------------------
    // Imperative handle
    // ------------------------------------------
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      exportImage: (w = EXPORT_WIDTH, h = EXPORT_HEIGHT) => {
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d')!;
        renderScene(ctx, w, h, paths, playerIcons, zones);
        return off.toDataURL('image/png');
      },
      undo: () => {
        // A route being drawn (waypointPoints) isn't pushed to undoStack
        // until it's finished — finishRoute() only snapshots at commit time.
        // So if undo fell through to the committed stack while a route is
        // mid-draw, it would undo an unrelated earlier action (e.g. the icon
        // placement) while the in-progress route preview stayed orphaned on
        // screen. Step back through the in-progress route first instead.
        // (Zone create/resize/move are each a single continuous pointer
        // gesture — there's no idle moment between clicks for a separate
        // Undo press to land on, so they don't need this same handling.)
        if (waypointPoints.length > 0) {
          if (waypointPoints.length === 1) {
            // Only the locked origin remains — cancel the route entirely.
            setWaypointPoints([]);
            setWaypointIconIndex(null);
            setHoveredIconIndex(null);
          } else {
            setWaypointPoints((prev) => prev.slice(0, -1));
          }
          return;
        }
        // Flat, top-level setState calls only — no setState nested inside
        // another updater function. An updater (the `prev => ...` form) is
        // invoked twice by StrictMode in dev to surface impurities; nesting
        // side effects in one meant a single undo press double-fired the
        // redo push and could leave phantom history entries.
        if (!undoStack.length) return;
        const prevState = undoStack[undoStack.length - 1];
        const current = { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })), zones: zones.map((z) => ({ ...z })) };
        setUndoStack((us) => us.slice(0, -1));
        setRedoStack((rs) => [...rs, current]);
        setPaths(prevState.paths);
        setPlayerIcons(prevState.playerIcons);
        setZones(prevState.zones);
        setSelectedZoneIndex(null);
        setEditingIconIndex(null);
      },
      redo: () => {
        // Mirrors the undo guard above: redoing a committed change could
        // move or remove the icon an in-progress route is anchored to and
        // orphan its preview. There's nothing to redo for an uncommitted
        // route's points, so just no-op until it's finished or cancelled.
        if (waypointPoints.length > 0) return;
        if (!redoStack.length) return;
        const nextState = redoStack[redoStack.length - 1];
        const current = { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })), zones: zones.map((z) => ({ ...z })) };
        setRedoStack((rs) => rs.slice(0, -1));
        setUndoStack((us) => [...us, current]);
        setPaths(nextState.paths);
        setPlayerIcons(nextState.playerIcons);
        setZones(nextState.zones);
        setSelectedZoneIndex(null);
        setEditingIconIndex(null);
      },
      clear: () => { pushSnapshot(); setPaths([]); setPlayerIcons([]); setZones([]); setSelectedZoneIndex(null); setZoneDraft(null); setEditingIconIndex(null); setWaypointPoints([]); setWaypointIconIndex(null); setHoveredIconIndex(null); },
      clearRoutes: () => { pushSnapshot(); setPaths((prev) => prev.filter((p) => p.startIconIndex === undefined && p.points.length === 0)); },
      removeRouteForIcon: (iconIndex: number) => { pushSnapshot(); setPaths((prev) => prev.filter((p) => p.startIconIndex !== iconIndex)); },
      loadState: (data) => { pushSnapshot(); setPaths(data.paths || []); setPlayerIcons(data.playerIcons || []); setZones(data.zones || []); setSelectedZoneIndex(null); setZoneDraft(null); setEditingIconIndex(null); },
      // Replaces the whole scene with the template (routes/zones would
      // otherwise reference icon indices that no longer line up once a
      // different formation is stamped over the old one) — same shape as
      // clear(), just landing on the new icons instead of an empty canvas.
      stampFormation: (icons) => {
        pushSnapshot();
        setPaths([]);
        setPlayerIcons(icons);
        setZones([]);
        setSelectedZoneIndex(null);
        setZoneDraft(null);
        setEditingIconIndex(null);
        setWaypointPoints([]);
        setWaypointIconIndex(null);
        setHoveredIconIndex(null);
      },
      canUndo: () => undoStack.length > 0 || waypointPoints.length > 0,
      canRedo: () => redoStack.length > 0 && waypointPoints.length === 0,
      getPaths: () => paths,
      getIcons: () => playerIcons,
      getZones: () => zones,
    }), [paths, playerIcons, zones, pushSnapshot, undoStack, redoStack, waypointPoints]);

    // ------------------------------------------
    // Pointer helpers
    // ------------------------------------------
    /** Pointer position in normalized 0–1 coordinates. */
    const getPos = (e: React.PointerEvent): Pt => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    /** Hit-test icons using on-screen pixel distance. */
    const findIcon = (p: Pt) =>
      playerIcons.findIndex((icon) => {
        const dx = (icon.x - p.x) * width;
        const dy = (icon.y - p.y) * height;
        return Math.sqrt(dx * dx + dy * dy) <= iconRadiusPx + 10;
      });

    // ------------------------------------------
    // Finish route helper
    // ------------------------------------------
    const finishRoute = useCallback((pts: Pt[], color: string, iconIdx: number | null, mode: DrawMode) => {
      if (pts.length < 2) return;
      pushSnapshot();
      const newPath: PathItem = { points: pts, color, startIconIndex: iconIdx ?? undefined, mode };
      setPaths((prev) => [...prev, newPath]);
      if (onDrawingComplete) onDrawingComplete(pts);
    }, [pushSnapshot, onDrawingComplete]);

    // ------------------------------------------
    // Waypoint: finish
    // ------------------------------------------
    const finishWaypoint = useCallback(() => {
      if (waypointPoints.length >= 2) {
        // Use the active drawMode so straight segments are stored as 'straight'
        finishRoute(waypointPoints, waypointColor, waypointIconIndex, drawMode);
        // Flash "Route saved!" confirmation — setSavedFlash is stable, safe to call here
        if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
        setSavedFlash(true);
        savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 1500);
      }
      setWaypointPoints([]);
      setWaypointIconIndex(null);
      setHoveredIconIndex(null);
    }, [waypointPoints, waypointColor, waypointIconIndex, drawMode, finishRoute]);

    // ------------------------------------------
    // Pointer events
    // ------------------------------------------
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
      const p = getPos(e);
      const clicked = findIcon(p);

      // Place player
      if (selectedPlayer && !drawingMode) {
        pushSnapshot();
        if (clicked >= 0) {
          setPlayerIcons((prev) => { const c = [...prev]; c[clicked] = { ...c[clicked], letter: selectedPlayer.letter, color: selectedPlayer.color, isSquare: selectedPlayer.isSquare, shape: selectedPlayer.shape }; return c; });
          // Keep the icon's existing artwork in sync with its new color
          setPaths((prev) => prev.map((p) => (p.startIconIndex === clicked ? { ...p, color: selectedPlayer.color } : p)));
          setZones((prev) => prev.map((z) => (z.iconIndex === clicked ? { ...z, color: selectedPlayer.color } : z)));
        } else {
          const { pos } = computeSnap(p, null);
          setPlayerIcons((prev) => [...prev, { x: pos.x, y: pos.y, letter: selectedPlayer.letter, color: selectedPlayer.color, isSquare: selectedPlayer.isSquare, shape: selectedPlayer.shape }]);
        }
        setSelectedPlayer(null);
        return;
      }

      // Delete-route mode — tap any icon to remove its route
      if (deleteRouteMode) {
        if (clicked >= 0) {
          if (iconHasRoute(clicked)) {
            pushSnapshot();
            setPaths((prev) => prev.filter((p) => p.startIconIndex !== clicked));
            if (deletedFlashTimerRef.current) clearTimeout(deletedFlashTimerRef.current);
            setDeletedFlash(true);
            deletedFlashTimerRef.current = setTimeout(() => setDeletedFlash(false), 1500);
          }
          setHoveredIconIndex(null);
        }
        return;
      }

      // Delete-zone mode — tap a zone (or its player) to remove it
      if (deleteZoneMode) {
        let zoneIdx = clicked >= 0 ? findZoneByIcon(clicked) : -1;
        if (zoneIdx < 0) zoneIdx = findZoneAt(p);
        if (zoneIdx >= 0) {
          pushSnapshot();
          setZones((prev) => prev.filter((_, i) => i !== zoneIdx));
          setSelectedZoneIndex(null);
          if (deletedZoneFlashTimerRef.current) clearTimeout(deletedZoneFlashTimerRef.current);
          setDeletedZoneFlash(true);
          deletedZoneFlashTimerRef.current = setTimeout(() => setDeletedZoneFlash(false), 1500);
        }
        setHoveredIconIndex(null);
        return;
      }

      // Zone tool — pointer-down directly on a defender without a zone yet
      // begins a single drag-to-size gesture (icon = fixed center).
      if (zoneMode) {
        if (clicked >= 0 && !iconHasZone(clicked)) {
          const icon = playerIcons[clicked];
          setZoneDraft({ iconIndex: clicked, cx: icon.x, cy: icon.y, rx: 0, ry: 0 });
        }
        return;
      }

      // Straight + Waypoint modes — click-to-add-segments flow
      if (drawingMode && (drawMode === 'waypoint' || drawMode === 'straight')) {
        const now = Date.now();
        const isDoubleTap = now - lastTapRef.current < 350;
        lastTapRef.current = now;

        if (isDoubleTap && waypointPoints.length >= 2) {
          finishWaypoint();
          return;
        }

        if (waypointPoints.length === 0) {
          if (clicked >= 0) {
            // Block starting a second route on an icon that already has one
            if (iconHasRoute(clicked)) {
              if (conflictFlashTimerRef.current) clearTimeout(conflictFlashTimerRef.current);
              setConflictFlash(true);
              conflictFlashTimerRef.current = setTimeout(() => setConflictFlash(false), 2500);
              return;
            }
            // User clicked a player icon — lock it as the route origin
            const icon = playerIcons[clicked];
            setWaypointColor(icon.color);
            setWaypointIconIndex(clicked);
            setWaypointPoints([{ x: icon.x, y: icon.y }]);
            setHoveredIconIndex(null);
          }
          // Clicked canvas without selecting a player — do nothing.
          // Hover highlight guides the user to tap a player first.
        } else {
          // Origin already locked — check what the user tapped
          if (clicked >= 0 && clicked === waypointIconIndex) {
            // Tapped the SAME origin icon → cancel the in-progress route and deselect
            setWaypointPoints([]);
            setWaypointIconIndex(null);
            setHoveredIconIndex(null);
          } else if (clicked >= 0) {
            // Tapped a DIFFERENT player icon while a route is in progress — block it
            if (finishFirstFlashTimerRef.current) clearTimeout(finishFirstFlashTimerRef.current);
            setFinishFirstFlash(true);
            finishFirstFlashTimerRef.current = setTimeout(() => setFinishFirstFlash(false), 2500);
          } else {
            // Tapped open canvas → add the next segment endpoint
            setWaypointPoints((prev) => [...prev, p]);
          }
        }
        return;
      }

      // Default Select/Move mode. Any tap here dismisses an open icon-edit
      // popover (tapping an icon below may immediately reopen it on pointer-up).
      if (editingIconIndex !== null) setEditingIconIndex(null);

      // Hit priority: a selected zone's resize handles first, then icons
      // (drawn on top of zones, so hits should match what's visible), then
      // zone bodies (to select/move them).
      if (selectedZoneIndex !== null && zones[selectedZoneIndex]) {
        const axis = findZoneHandle(p, zones[selectedZoneIndex]);
        if (axis) {
          zoneGestureRef.current = { type: 'resize', zoneIndex: selectedZoneIndex, axis, moved: false };
          return;
        }
      }

      // Drag icon — a tap without movement opens the customize popover instead
      // (see handlePointerUp).
      if (clicked >= 0) {
        if (selectedZoneIndex !== null) setSelectedZoneIndex(null);
        const icon = playerIcons[clicked];
        draggingIndexRef.current = clicked;
        dragOffsetRef.current = { x: p.x - icon.x, y: p.y - icon.y };
        dragStartRef.current = p;
        dragMovedRef.current = false;
        setIsDragging(true);
        // Snapshot is deferred to the first actual move (see handlePointerMove)
        // so a plain tap doesn't push a no-op undo entry.
        return;
      }

      const hitZone = findZoneAt(p);
      if (hitZone >= 0) {
        setSelectedZoneIndex(hitZone);
        const z = zones[hitZone];
        zoneGestureRef.current = { type: 'move', zoneIndex: hitZone, offset: { x: p.x - z.cx, y: p.y - z.cy }, moved: false };
        return;
      }
      if (selectedZoneIndex !== null) setSelectedZoneIndex(null);

      // Nothing hit — start a pan gesture (no-op unless the parent's scroll
      // container actually overflows, i.e. the canvas is zoomed).
      if (onPan) panLastRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getPos(e);

      // Select-mode pan: report screen-px deltas to the parent.
      if (panLastRef.current) {
        onPan?.(e.clientX - panLastRef.current.x, e.clientY - panLastRef.current.y);
        panLastRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Zone creation: live-resize the draft as the drag continues.
      if (zoneDraft) {
        setZoneDraft((prev) => prev ? { ...prev, rx: Math.abs(p.x - prev.cx), ry: Math.abs(p.y - prev.cy) } : prev);
        return;
      }

      // Zone resize/move: deferred snapshot on first actual move, same
      // pattern as icon dragging below.
      if (zoneGestureRef.current) {
        const g = zoneGestureRef.current;
        if (!g.moved) { g.moved = true; pushSnapshot(); }
        setZones((prev) => {
          const next = [...prev];
          const z = { ...next[g.zoneIndex] };
          if (g.type === 'move' && g.offset) {
            z.cx = p.x - g.offset.x;
            z.cy = p.y - g.offset.y;
          } else if (g.type === 'resize') {
            if (g.axis === 'x' || g.axis === 'both') z.rx = Math.max(Math.abs(p.x - z.cx), MIN_ZONE_RADIUS);
            if (g.axis === 'y' || g.axis === 'both') z.ry = Math.max(Math.abs(p.y - z.cy), MIN_ZONE_RADIUS);
          }
          next[g.zoneIndex] = z;
          return next;
        });
        return;
      }

      if (isDragging && draggingIndexRef.current !== null) {
        // Ignore sub-threshold jitter (common on real mice/trackpads/
        // touchscreens even during a stationary tap) so it doesn't get
        // mistaken for the start of a drag — see dragMovedRef above.
        if (!dragMovedRef.current) {
          const traveled = Math.hypot(
            (p.x - dragStartRef.current.x) * width,
            (p.y - dragStartRef.current.y) * height,
          );
          if (traveled < DRAG_THRESHOLD_PX) return;
          // Record the pre-drag state exactly once, the moment the icon first moves.
          dragMovedRef.current = true;
          pushSnapshot();
        }
        const raw = { x: p.x - dragOffsetRef.current.x, y: p.y - dragOffsetRef.current.y };
        const { pos, guideX, guideY, distX, distY } = computeSnap(raw, draggingIndexRef.current);
        setActiveGuides({ x: guideX, y: guideY, distX, distY });
        setPlayerIcons((prev) => {
          const c = [...prev];
          c[draggingIndexRef.current!] = { ...c[draggingIndexRef.current!], x: pos.x, y: pos.y };
          return c;
        });
        return;
      }

      // Hover highlight: show which icon will be the route origin (or deletion target)
      if ((drawingMode && waypointPoints.length === 0) || deleteRouteMode || zoneMode || deleteZoneMode) {
        const idx = findIcon(p);
        setHoveredIconIndex(idx >= 0 ? idx : null);
      } else if (hoveredIconIndex !== null) {
        setHoveredIconIndex(null);
      }
    };

    const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (e) (e.currentTarget as any).releasePointerCapture?.(e.pointerId);

      panLastRef.current = null;

      // Commit the zone creation gesture: pushSnapshot (pre-zone state) then
      // add the new zone, floored to a minimum visible radius so a tap
      // without much drag still produces a usable zone.
      if (zoneDraft) {
        pushSnapshot();
        const rx = Math.max(zoneDraft.rx, MIN_ZONE_RADIUS);
        const ry = Math.max(zoneDraft.ry, MIN_ZONE_RADIUS);
        const icon = playerIcons[zoneDraft.iconIndex];
        setZones((prev) => [...prev, { iconIndex: zoneDraft.iconIndex, cx: zoneDraft.cx, cy: zoneDraft.cy, rx, ry, color: icon?.color || '#888888' }]);
        setZoneDraft(null);
        return;
      }

      if (zoneGestureRef.current) {
        zoneGestureRef.current = null;
        return;
      }

      if (isDragging) {
        // A press-and-release with no movement is a tap: open the customize
        // popover for that icon (Select mode is the only mode that sets
        // draggingIndexRef, so no other tool can trigger this).
        if (!dragMovedRef.current && draggingIndexRef.current !== null) {
          setEditingIconIndex(draggingIndexRef.current);
        }
        setIsDragging(false);
        draggingIndexRef.current = null;
        setActiveGuides({ x: null, y: null, distX: null, distY: null });
      }
    };

    // Drag-and-drop from toolbar
    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => e.preventDefault();
    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data?.letter && data?.color) {
          pushSnapshot();
          const { pos } = computeSnap({ x, y }, null);
          setPlayerIcons((prev) => [...prev, { x: pos.x, y: pos.y, letter: data.letter, color: data.color, isSquare: !!data.isSquare, shape: data.shape }]);
        }
      } catch { /* ignore */ }
    };

    // ── Icon-edit popover placement ───────────────────────────────
    // Anchored under the icon, clamped inside the canvas; flips above the
    // icon when there isn't enough room below.
    const editingIcon = editingIconIndex !== null ? playerIcons[editingIconIndex] : null;
    let editorLeft = 0;
    let editorTop = 0;
    if (editingIcon) {
      const POPOVER_W = 230;
      const POPOVER_H = 260;
      editorLeft = Math.min(Math.max(editingIcon.x * width - POPOVER_W / 2, 8), Math.max(8, width - POPOVER_W - 8));
      editorTop = editingIcon.y * height + iconRadiusPx + 10;
      if (editorTop + POPOVER_H > height - 8) {
        editorTop = Math.max(8, editingIcon.y * height - iconRadiusPx - POPOVER_H - 10);
      }
    }

    // ── Instruction text for the canvas overlay ──────────────────
    const originIcon = waypointIconIndex !== null ? playerIcons[waypointIconIndex] : null;
    const hoveredHasRoute = hoveredIconIndex !== null && iconHasRoute(hoveredIconIndex);
    const hoveredHasZone = hoveredIconIndex !== null && iconHasZone(hoveredIconIndex);
    let instructionText: string | null = null;
    if (deleteRouteMode) {
      if (hoveredIconIndex !== null && playerIcons[hoveredIconIndex]) {
        const ltr = playerIcons[hoveredIconIndex].letter;
        instructionText = hoveredHasRoute
          ? `Tap to remove "${ltr}"'s route`
          : `"${ltr}" has no route to remove`;
      } else {
        instructionText = 'Tap a player to remove their route';
      }
    } else if (deleteZoneMode) {
      if (hoveredIconIndex !== null && playerIcons[hoveredIconIndex]) {
        const ltr = playerIcons[hoveredIconIndex].letter;
        instructionText = hoveredHasZone
          ? `Tap to remove "${ltr}"'s zone`
          : `"${ltr}" has no zone to remove`;
      } else {
        instructionText = 'Tap a zone (or its player) to remove it';
      }
    } else if (zoneMode) {
      if (hoveredIconIndex !== null && playerIcons[hoveredIconIndex]) {
        const ltr = playerIcons[hoveredIconIndex].letter;
        instructionText = hoveredHasZone
          ? `"${ltr}" already has a zone · Use Remove Zone to clear it first`
          : `Drag from "${ltr}" to size their zone`;
      } else {
        instructionText = 'Hover a defender, then drag to draw their zone';
      }
    } else if (drawingMode) {
      if (waypointPoints.length === 0) {
        if (hoveredHasRoute) {
          instructionText = 'This player already has a route · Use Remove Route to clear it first';
        } else {
          instructionText = 'Hover a player icon, then tap to select them';
        }
      } else if (waypointPoints.length === 1 && originIcon) {
        instructionText = `"${originIcon.letter}" selected · Tap the field to place route points · Tap "${originIcon.letter}" again to cancel`;
      } else if (waypointPoints.length >= 2) {
        instructionText = 'Tap to keep adding corners · Double-tap or press Finish to complete';
      }
    }

    return (
      // Sized to the width/height props (not the parent) so the parent can
      // letterbox the canvas to the export aspect ratio.
      <div className="relative" style={{ width, height }}>
        <canvas
          id={id || 'play-canvas'}
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="block bg-white touch-none"
          style={{ width: '100%', height: '100%' }}
        />

        {/* ── Contextual instruction bar (top of canvas) ── */}
        {(savedFlash || conflictFlash || finishFirstFlash || deletedFlash || deletedZoneFlash || instructionText) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 w-full max-w-sm">
            <div
              className={`text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg text-center leading-snug transition-colors duration-300 ${
                savedFlash ? 'bg-green-600'
                : (deletedFlash || deletedZoneFlash) ? 'bg-amber-600'
                : (conflictFlash || finishFirstFlash) ? 'bg-red-600'
                : 'bg-black/65 backdrop-blur-sm'
              }`}
            >
              {savedFlash ? '✓ Route saved!'
                : deletedFlash ? '✓ Route removed'
                : deletedZoneFlash ? '✓ Zone removed'
                : finishFirstFlash ? 'Finish or cancel the current route first'
                : conflictFlash ? 'This player already has a route · Use Remove Route to clear it'
                : instructionText}
            </div>
          </div>
        )}

        {/* ── Icon customize popover (tap an icon in Select mode) ── */}
        {editingIcon && editingIconIndex !== null && (
          <div className="absolute z-20" style={{ left: editorLeft, top: editorTop }}>
            <PlayerStyleEditor
              key={editingIconIndex}
              initialLetter={editingIcon.letter}
              initialColor={editingIcon.color}
              initialShape={iconShape(editingIcon)}
              applyLabel="Apply"
              onApply={(letter, color, shape) => {
                applyIconStyle(editingIconIndex, letter, color, shape);
                setEditingIconIndex(null);
              }}
              onCancel={() => setEditingIconIndex(null)}
            />
          </div>
        )}

        {/* ── Action bar (bottom of canvas): Finish + Cancel ── */}
        {drawingMode && (drawMode === 'waypoint' || drawMode === 'straight') && waypointPoints.length >= 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            {waypointPoints.length >= 2 && (
              <button
                onPointerDown={(e) => { e.stopPropagation(); finishWaypoint(); }}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg font-semibold text-sm flex items-center gap-1.5 transition-colors"
              >
                <span>⚑</span> Finish Route
              </button>
            )}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setWaypointPoints([]);
                setWaypointIconIndex(null);
                setHoveredIconIndex(null);
              }}
              className="px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-full shadow-lg font-semibold text-sm flex items-center gap-1.5 transition-colors"
            >
              <span>✕</span> Cancel
            </button>
          </div>
        )}
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
export default Canvas;
