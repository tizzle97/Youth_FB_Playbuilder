import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------
// Config
// ---------------------------------------------
const ROUTE_LINE_WIDTH = 3;
const ARROWHEAD_SIZE = 14;

const FIELD_BG = '#FFFFFF';
const SIDELINE_PADDING = 8;
const SIDELINE_BORDER_COLOR = '#E0E0E0';
const SIDELINE_BORDER_WIDTH = 1;
const YARD_LINE_COLOR = '#D8D8D8';
const YARD_LINE_WIDTH = 1;
const HASH_COLOR = '#B0B0B0';
const HASH_WIDTH = 1;
const HASH_TICK_LEN = 10;
const LOS_COLOR = '#1a1a1a';
const LOS_WIDTH = 3;
const FIELD_YARDS_ABOVE_LOS = 15;
const FIELD_YARDS_BELOW_LOS = 10;
const HASH_LEFT_X_RATIO = 70.75 / 160;
const HASH_RIGHT_X_RATIO = 1 - HASH_LEFT_X_RATIO;
const PLAYER_SIZE = 36;

// ---------------------------------------------
// Types
// ---------------------------------------------
export type DrawMode = 'freehand' | 'straight' | 'waypoint';

type Pt = { x: number; y: number };

export type PathItem = {
  points: Pt[];
  color: string;
  startIconIndex?: number;
  mode: DrawMode;
};

type PlayerIcon = {
  x: number;
  y: number;
  letter: string;
  color: string;
  isSquare?: boolean;
};

type CanvasProps = {
  width: number;
  height: number;
  drawingMode: boolean;
  drawMode: DrawMode;
  selectedPlayer: { letter: string; color: string; isSquare?: boolean } | null;
  setSelectedPlayer: (p: { letter: string; color: string; isSquare?: boolean } | null) => void;
  onDrawingComplete?: (points: Pt[]) => void;
  id?: string;
};

export type CanvasHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  clearRoutes: () => void;
  loadState: (data: { paths: PathItem[]; playerIcons: PlayerIcon[] }) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getPaths: () => PathItem[];
  getIcons: () => PlayerIcon[];
  getCanvas: () => HTMLCanvasElement | null;
};

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const yFromYards = (yards: number, H: number) =>
  ((yards + FIELD_YARDS_ABOVE_LOS) / (FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS)) * H;

/** Smooth a polyline using midpoint averaging (Chaikin-style). */
function smoothPoints(pts: Pt[], iterations = 2): Pt[] {
  if (pts.length <= 2) return pts;
  let result = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const next: Pt[] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      next.push({
        x: result[i].x * 0.75 + result[i + 1].x * 0.25,
        y: result[i].y * 0.75 + result[i + 1].y * 0.25,
      });
      next.push({
        x: result[i].x * 0.25 + result[i + 1].x * 0.75,
        y: result[i].y * 0.25 + result[i + 1].y * 0.75,
      });
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

/** Draw a smooth route through pts on ctx. */
function strokeRoute(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw = ROUTE_LINE_WIDTH) {
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

/** Draw connected straight-line segments through pts (sharp angles). */
function strokeStraight(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, lw = ROUTE_LINE_WIDTH) {
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

/** Draw a filled triangle arrowhead at the end of pts. */
function drawArrowhead(ctx: CanvasRenderingContext2D, pts: Pt[], color: string) {
  if (pts.length < 2) return;
  // Use last meaningful direction (look back up to 8 points)
  const tip = pts[pts.length - 1];
  let from = pts[pts.length - 2];
  for (let i = pts.length - 2; i >= Math.max(0, pts.length - 8); i--) {
    const dx = tip.x - pts[i].x;
    const dy = tip.y - pts[i].y;
    if (Math.sqrt(dx * dx + dy * dy) > 6) {
      from = pts[i];
      break;
    }
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const s = ARROWHEAD_SIZE;
  // Left and right barbs
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * s - uy * (s * 0.45), tip.y - uy * s + ux * (s * 0.45));
  ctx.lineTo(tip.x - ux * s + uy * (s * 0.45), tip.y - uy * s - ux * (s * 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------
// Component
// ---------------------------------------------
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, drawingMode, drawMode, selectedPlayer, setSelectedPlayer, onDrawingComplete, id }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [paths, setPaths] = useState<PathItem[]>([]);
    const [playerIcons, setPlayerIcons] = useState<PlayerIcon[]>([]);
    const [undoStack, setUndoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[] }>>([]);
    const [redoStack, setRedoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[] }>>([]);

    // Freehand / straight drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<Pt[]>([]);
    const [currentColor, setCurrentColor] = useState('#e05a1e'); // orange default
    const [activeIconIndex, setActiveIconIndex] = useState<number | null>(null);

    // Waypoint mode state
    const [waypointPoints, setWaypointPoints] = useState<Pt[]>([]);
    const [waypointColor, setWaypointColor] = useState('#e05a1e');
    const [waypointIconIndex, setWaypointIconIndex] = useState<number | null>(null);
    const lastTapRef = useRef<number>(0);

    // Hover highlight (shows which icon will be used as route origin)
    const [hoveredIconIndex, setHoveredIconIndex] = useState<number | null>(null);

    // Route-saved flash
    const [savedFlash, setSavedFlash] = useState(false);
    const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const draggingIndexRef = useRef<number | null>(null);
    const dragOffsetRef = useRef<Pt>({ x: 0, y: 0 });

    const pushSnapshot = useCallback(() => {
      setUndoStack((prev) => [...prev, { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) }]);
      setRedoStack([]);
    }, [paths, playerIcons]);

    // ------------------------------------------
    // Field drawing
    // ------------------------------------------
    const drawField = useCallback((ctx: CanvasRenderingContext2D) => {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      ctx.save();
      ctx.fillStyle = FIELD_BG;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = SIDELINE_BORDER_COLOR;
      ctx.lineWidth = SIDELINE_BORDER_WIDTH;
      ctx.strokeRect(SIDELINE_PADDING, SIDELINE_PADDING, W - SIDELINE_PADDING * 2, H - SIDELINE_PADDING * 2);

      // Yard lines
      ctx.strokeStyle = YARD_LINE_COLOR;
      ctx.lineWidth = YARD_LINE_WIDTH;
      for (let y = -FIELD_YARDS_ABOVE_LOS; y <= FIELD_YARDS_BELOW_LOS; y += 5) {
        const py = yFromYards(y, H);
        ctx.beginPath();
        ctx.moveTo(SIDELINE_PADDING, py);
        ctx.lineTo(W - SIDELINE_PADDING, py);
        ctx.stroke();
      }

      // LOS
      const losY = yFromYards(0, H);
      ctx.strokeStyle = LOS_COLOR;
      ctx.lineWidth = LOS_WIDTH;
      ctx.beginPath();
      ctx.moveTo(SIDELINE_PADDING, losY);
      ctx.lineTo(W - SIDELINE_PADDING, losY);
      ctx.stroke();

      // Hash marks
      ctx.strokeStyle = HASH_COLOR;
      ctx.lineWidth = HASH_WIDTH;
      const lhx = SIDELINE_PADDING + (W - SIDELINE_PADDING * 2) * HASH_LEFT_X_RATIO;
      const rhx = SIDELINE_PADDING + (W - SIDELINE_PADDING * 2) * HASH_RIGHT_X_RATIO;
      for (let y = -FIELD_YARDS_ABOVE_LOS; y <= FIELD_YARDS_BELOW_LOS; y += 1) {
        const py = yFromYards(y, H);
        ctx.beginPath(); ctx.moveTo(lhx - HASH_TICK_LEN / 2, py); ctx.lineTo(lhx + HASH_TICK_LEN / 2, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rhx - HASH_TICK_LEN / 2, py); ctx.lineTo(rhx + HASH_TICK_LEN / 2, py); ctx.stroke();
      }
      ctx.restore();
    }, []);

    // ------------------------------------------
    // Full redraw
    // ------------------------------------------
    const draw = useCallback((extraPoints?: Pt[], extraColor?: string, extraMode?: DrawMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawField(ctx);

      // Draw saved paths
      // Track last path per icon for arrowhead
      const lastByIcon = new Map<number, number>();
      paths.forEach((p, i) => { if (p.startIconIndex !== undefined) lastByIcon.set(p.startIconIndex, i); });

      paths.forEach((p, i) => {
        const rendered = p.mode === 'straight'
          ? p.points
          : p.mode === 'freehand'
            ? smoothPoints(p.points, 1)
            : p.points; // waypoint: already smooth enough
        if (p.mode === 'straight') {
          strokeStraight(ctx, rendered, p.color);
        } else {
          strokeRoute(ctx, rendered, p.color);
        }
        // Arrowhead on the last segment of each icon's route chain
        const isLast = p.startIconIndex !== undefined
          ? lastByIcon.get(p.startIconIndex) === i
          : true;
        if (isLast) drawArrowhead(ctx, rendered, p.color);
      });

      // Draw waypoint / straight-segment in-progress preview
      if (waypointPoints.length >= 1) {
        if (drawMode === 'straight') {
          strokeStraight(ctx, waypointPoints, waypointColor);
          // Small dot at each corner to show the angle joints
          waypointPoints.slice(1).forEach((pt) => {
            ctx.save();
            ctx.fillStyle = waypointColor;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        } else {
          strokeRoute(ctx, waypointPoints, waypointColor);
        }
        // Live arrowhead at current end
        if (waypointPoints.length >= 2) drawArrowhead(ctx, waypointPoints, waypointColor);
      }

      // Draw in-progress freehand stroke preview (freehand drag only)
      if (extraPoints && extraPoints.length >= 2 && extraColor) {
        const pts = smoothPoints(extraPoints, 1);
        strokeRoute(ctx, pts, extraColor, ROUTE_LINE_WIDTH * 0.8);
        drawArrowhead(ctx, pts, extraColor);
      }

      // Draw origin-locked indicator (solid bright ring on the icon whose route is being drawn)
      if (waypointPoints.length >= 1 && waypointIconIndex !== null && playerIcons[waypointIconIndex]) {
        const oi = playerIcons[waypointIconIndex];
        ctx.save();
        // Pulsing glow
        ctx.shadowColor = oi.color;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = oi.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(oi.x, oi.y, PLAYER_SIZE / 2 + 9, 0, Math.PI * 2);
        ctx.stroke();
        // Solid white inner ring so it's clearly "locked"
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(oi.x, oi.y, PLAYER_SIZE / 2 + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw hover highlight ring — only when NO origin is locked yet
      if (waypointPoints.length === 0 && hoveredIconIndex !== null && playerIcons[hoveredIconIndex]) {
        const hi = playerIcons[hoveredIconIndex];
        ctx.save();
        // Outer glow
        ctx.shadowColor = hi.color;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = hi.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(hi.x, hi.y, PLAYER_SIZE / 2 + 7, 0, Math.PI * 2);
        ctx.stroke();
        // Dashed inner ring
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hi.x, hi.y, PLAYER_SIZE / 2 + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Draw icons
      playerIcons.forEach((icon) => {
        ctx.save();
        const s = PLAYER_SIZE;
        ctx.fillStyle = icon.color;
        if (icon.isSquare) {
          ctx.fillRect(icon.x - s / 2, icon.y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(icon.x, icon.y, s / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon.letter, icon.x, icon.y);
        ctx.restore();
      });
    }, [paths, playerIcons, drawField, waypointPoints, waypointColor, waypointIconIndex, hoveredIconIndex, drawMode]);

    // Redraw on state change
    useEffect(() => { draw(); }, [draw]);

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
      setCurrentPoints([]);
      setIsDrawing(false);
      setHoveredIconIndex(null);
    }, [drawMode]);

    // Clear in-progress segments when drawing mode is turned off
    // (e.g. user selects a player from the toolbar, which disables drawing mode)
    useEffect(() => {
      if (!drawingMode) {
        setWaypointPoints([]);
        setWaypointIconIndex(null);
        setCurrentPoints([]);
        setIsDrawing(false);
        setHoveredIconIndex(null);
      }
    }, [drawingMode]);

    // ------------------------------------------
    // Imperative handle
    // ------------------------------------------
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      undo: () => {
        setUndoStack((prev) => {
          if (!prev.length) return prev;
          const state = prev[prev.length - 1];
          setRedoStack((rs) => [...rs, { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) }]);
          setPaths(state.paths);
          setPlayerIcons(state.playerIcons);
          return prev.slice(0, -1);
        });
      },
      redo: () => {
        setRedoStack((prev) => {
          if (!prev.length) return prev;
          const state = prev[prev.length - 1];
          setUndoStack((us) => [...us, { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) }]);
          setPaths(state.paths);
          setPlayerIcons(state.playerIcons);
          return prev.slice(0, -1);
        });
      },
      clear: () => { pushSnapshot(); setPaths([]); setPlayerIcons([]); setCurrentPoints([]); setWaypointPoints([]); setIsDrawing(false); setActiveIconIndex(null); setHoveredIconIndex(null); },
      clearRoutes: () => { pushSnapshot(); setPaths((prev) => prev.filter((p) => p.startIconIndex === undefined && p.points.length === 0)); },
      loadState: (data) => { pushSnapshot(); setPaths(data.paths || []); setPlayerIcons(data.playerIcons || []); },
      canUndo: () => undoStack.length > 0,
      canRedo: () => redoStack.length > 0,
      getPaths: () => paths,
      getIcons: () => playerIcons,
    }), [paths, playerIcons, pushSnapshot, undoStack, redoStack]);

    // ------------------------------------------
    // Pointer helpers
    // ------------------------------------------
    const getPos = (e: React.PointerEvent): Pt => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const findIcon = (x: number, y: number) =>
      playerIcons.findIndex((icon) => {
        const dx = icon.x - x; const dy = icon.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= PLAYER_SIZE / 2 + 10;
      });

    // ------------------------------------------
    // Finish route helper
    // ------------------------------------------
    const finishRoute = useCallback((pts: Pt[], color: string, iconIdx: number | null, mode: DrawMode) => {
      if (pts.length < 2) return;
      pushSnapshot();
      // All modes keep all points — straight mode renders as connected segments
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
      const clicked = findIcon(p.x, p.y);

      // Place player
      if (selectedPlayer && !drawingMode) {
        pushSnapshot();
        if (clicked >= 0) {
          setPlayerIcons((prev) => { const c = [...prev]; c[clicked] = { ...c[clicked], letter: selectedPlayer.letter, color: selectedPlayer.color, isSquare: selectedPlayer.isSquare }; return c; });
        } else {
          setPlayerIcons((prev) => [...prev, { x: p.x, y: p.y, letter: selectedPlayer.letter, color: selectedPlayer.color, isSquare: selectedPlayer.isSquare }]);
        }
        setSelectedPlayer(null);
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
            // Tapped a DIFFERENT player icon → save current route (if long enough), start fresh
            if (waypointPoints.length >= 2) {
              finishRoute(waypointPoints, waypointColor, waypointIconIndex, drawMode);
            }
            const icon = playerIcons[clicked];
            setWaypointPoints([{ x: icon.x, y: icon.y }]);
            setWaypointColor(icon.color);
            setWaypointIconIndex(clicked);
            setHoveredIconIndex(null);
          } else {
            // Tapped open canvas → add the next segment endpoint
            setWaypointPoints((prev) => [...prev, p]);
          }
        }
        return;
      }

      // Freehand mode — drag to draw
      if (drawingMode && drawMode === 'freehand') {
        if (clicked >= 0) {
          const icon = playerIcons[clicked];
          setCurrentColor(icon.color);
          setActiveIconIndex(clicked);
          setIsDrawing(true);
          setCurrentPoints([{ x: icon.x, y: icon.y }]);
          setHoveredIconIndex(null);
        } else {
          setCurrentColor('#e05a1e');
          setActiveIconIndex(null);
          setIsDrawing(true);
          setCurrentPoints([p]);
        }
        return;
      }

      // Drag icon
      if (clicked >= 0) {
        const icon = playerIcons[clicked];
        draggingIndexRef.current = clicked;
        dragOffsetRef.current = { x: p.x - icon.x, y: p.y - icon.y };
        setIsDragging(true);
        pushSnapshot();
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getPos(e);

      if (isDragging && draggingIndexRef.current !== null) {
        setPlayerIcons((prev) => {
          const c = [...prev];
          c[draggingIndexRef.current!] = { ...c[draggingIndexRef.current!], x: p.x - dragOffsetRef.current.x, y: p.y - dragOffsetRef.current.y };
          return c;
        });
        return;
      }

      // Hover highlight: show which icon will be the route origin
      // Only when in drawing mode and no route is currently in progress
      if (drawingMode && !isDrawing && waypointPoints.length === 0) {
        const idx = findIcon(p.x, p.y);
        setHoveredIconIndex(idx >= 0 ? idx : null);
      } else if (!drawingMode || isDrawing || waypointPoints.length > 0) {
        if (hoveredIconIndex !== null) setHoveredIconIndex(null);
      }

      if (isDrawing && (drawMode === 'freehand' || drawMode === 'straight')) {
        const pts = [...currentPoints, p];
        setCurrentPoints(pts);
        draw(pts, currentColor, drawMode);
      }
    };

    const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (e) (e.currentTarget as any).releasePointerCapture?.(e.pointerId);

      if (isDragging) { setIsDragging(false); draggingIndexRef.current = null; return; }

      if (isDrawing) {
        setIsDrawing(false);
        finishRoute(currentPoints, currentColor, activeIconIndex, drawMode);
        setCurrentPoints([]);
        setActiveIconIndex(null);
      }
    };

    // Drag-and-drop from toolbar
    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => e.preventDefault();
    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data?.letter && data?.color) {
          pushSnapshot();
          setPlayerIcons((prev) => [...prev, { x, y, letter: data.letter, color: data.color, isSquare: !!data.isSquare }]);
        }
      } catch { /* ignore */ }
    };

    // ── Instruction text for the canvas overlay ──────────────────
    const originIcon = waypointIconIndex !== null ? playerIcons[waypointIconIndex] : null;
    let instructionText: string | null = null;
    if (drawingMode) {
      if (drawMode === 'freehand') {
        if (!isDrawing) instructionText = 'Hover a player icon, then drag to draw their route';
      } else {
        // straight / waypoint
        if (waypointPoints.length === 0) {
          instructionText = 'Hover a player icon, then tap to select them';
        } else if (waypointPoints.length === 1 && originIcon) {
          instructionText = `"${originIcon.letter}" selected · Tap the field to place route points · Tap "${originIcon.letter}" again to cancel`;
        } else if (waypointPoints.length >= 2) {
          instructionText = 'Tap to keep adding corners · Double-tap or press Finish to complete';
        }
      }
    }

    return (
      <div className="relative w-full h-full">
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
        {(savedFlash || instructionText) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 w-full max-w-sm">
            <div
              className={`text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg text-center leading-snug transition-colors duration-300 ${
                savedFlash ? 'bg-green-600' : 'bg-black/65 backdrop-blur-sm'
              }`}
            >
              {savedFlash ? '✓ Route saved!' : instructionText}
            </div>
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
