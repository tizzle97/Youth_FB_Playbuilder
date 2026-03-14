import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { getStroke } from 'perfect-freehand';
import { getSvgPathFromStroke } from '../../utils/canvas';

// ---------------------------------------------
// Visual + Geometry Config
// ---------------------------------------------
const LINE_WIDTH = 4;
const DEFAULT_LINE_COLOR = '#000000';

// Field window relative to Line of Scrimmage (LOS)
// Top of canvas is -15y (upfield), bottom is +10y (downfield)
const FIELD_YARDS_ABOVE_LOS = 15; // toward top of canvas
const FIELD_YARDS_BELOW_LOS = 10; // toward bottom of canvas
const FIELD_TOTAL_YARDS = FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS; // 25

// Field styling
const FIELD_BG = '#FFFFFF';
const SIDELINE_PADDING = 8; // pixels border inside canvas
const SIDELINE_BORDER_COLOR = '#E0E0E0';
const SIDELINE_BORDER_WIDTH = 1;

const YARD_LINE_COLOR = '#D8D8D8';
const YARD_LINE_WIDTH = 2;

const HASH_COLOR = '#9AA0A6';
const HASH_WIDTH = 2;
const HASH_TICK_LEN = 12; // pixel length of each hash tick

const LOS_COLOR = '#000000';
const LOS_WIDTH = 4; // bold LOS

// NFL hash positions: field is 160 ft wide; hashes are 70'9" (~70.75ft) from each sideline
// Normalized positions from left sideline: ~0.442 and ~0.558
const HASH_LEFT_X_RATIO = 70.75 / 160; // ≈0.442
const HASH_RIGHT_X_RATIO = 1 - HASH_LEFT_X_RATIO; // ≈0.558

// Player icon appearance
const PLAYER_SIZE = 36; // diameter for circles / side length for squares

// ---------------------------------------------
// Types
// ---------------------------------------------
type Point = { x: number; y: number; pressure: number };

type PlayerIcon = {
  x: number;
  y: number;
  letter: string;
  color: string;
  isSquare?: boolean;
};

type PathItem = {
  path: string;
  color: string;
  startIconIndex?: number; // index of icon route started from (if any)
  endIconIndex?: number; // reserved for future use
  arrowFrom?: Point; // used to render terminal arrowhead
  arrowTo?: Point;   // used to render terminal arrowhead
};

type CanvasProps = {
  width: number;
  height: number;
  drawingMode: boolean;
  selectedPlayer: { letter: string; color: string; isSquare?: boolean } | null;
  setSelectedPlayer: (p: { letter: string; color: string; isSquare?: boolean } | null) => void;
  onDrawingComplete?: (path: string) => void;
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
/** Convert a yard offset relative to LOS (negative = upfield, positive = downfield)
 * to canvas Y pixels. Top of canvas is -15y, bottom is +10y.
 */
const yFromYards = (yardOffset: number, height: number) => {
  const top = -FIELD_YARDS_ABOVE_LOS; // -15
  const bottom = FIELD_YARDS_BELOW_LOS; // +10
  const frac = (yardOffset - top) / (bottom - top); // 0..1
  return frac * height;
};

const makeArrow = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  size = 36
) => {
  // returns two strokes (left and right) as strokes arrays for getStroke
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const perpX = -uy;
  const perpY = ux;
  const arrowLength = Math.min(size * 0.6, len * 0.6);
  const arrowWidth = size * 0.2;

  const tip = [to.x, to.y, 0.5];
  const baseCenter = [to.x - ux * arrowLength, to.y - uy * arrowLength, 0.5];
  const left = [baseCenter[0] + perpX * arrowWidth, baseCenter[1] + perpY * arrowWidth, 0.5];
  const right = [baseCenter[0] - perpX * arrowWidth, baseCenter[1] - perpY * arrowWidth, 0.5];

  return {
    leftStroke: [tip, left],
    rightStroke: [tip, right],
  } as const;
};

// ---------------------------------------------
// Component
// ---------------------------------------------
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ width, height, drawingMode, selectedPlayer, setSelectedPlayer, onDrawingComplete, id }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [currentLineColor, setCurrentLineColor] = useState<string>(DEFAULT_LINE_COLOR);

    // Paths and icons
    const [paths, setPaths] = useState<PathItem[]>([]);
    const [playerIcons, setPlayerIcons] = useState<PlayerIcon[]>([]);

    // Undo/redo: store snapshots { paths, playerIcons }
    const [undoStack, setUndoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[] }>>([]);
    const [redoStack, setRedoStack] = useState<Array<{ paths: PathItem[]; playerIcons: PlayerIcon[] }>>([]);

    // Dragging
    const [isDragging, setIsDragging] = useState(false);
    const draggingIndexRef = useRef<number | null>(null);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Active route start
    const [activeIconIndex, setActiveIconIndex] = useState<number | null>(null);

    // Utility: push snapshot
    const pushSnapshot = useCallback(() => {
      setUndoStack((prev) => [
        ...prev,
        { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) },
      ]);
      setRedoStack([]);
    }, [paths, playerIcons]);

    // ---------------------------------------------
    // Field Drawing (Vertical, White, LOS-centered)
    // ---------------------------------------------
    const drawField = useCallback((ctx: CanvasRenderingContext2D) => {
      const { width: W, height: H } = ctx.canvas;

      // Background
      ctx.save();
      ctx.fillStyle = FIELD_BG;
      ctx.fillRect(0, 0, W, H);

      // Sideline border
      ctx.strokeStyle = SIDELINE_BORDER_COLOR;
      ctx.lineWidth = SIDELINE_BORDER_WIDTH;
      ctx.strokeRect(
        SIDELINE_PADDING,
        SIDELINE_PADDING,
        W - SIDELINE_PADDING * 2,
        H - SIDELINE_PADDING * 2
      );

      // Yard lines every 5 yards within [-15, +10]
      ctx.strokeStyle = YARD_LINE_COLOR;
      ctx.lineWidth = YARD_LINE_WIDTH;
      for (let yds = -FIELD_YARDS_ABOVE_LOS; yds <= FIELD_YARDS_BELOW_LOS; yds += 5) {
        const y = yFromYards(yds, H);
        ctx.beginPath();
        ctx.moveTo(SIDELINE_PADDING, y);
        ctx.lineTo(W - SIDELINE_PADDING, y);
        ctx.stroke();
      }

      // LOS (0 yards) — bold line
      const losY = yFromYards(0, H);
      ctx.strokeStyle = LOS_COLOR;
      ctx.lineWidth = LOS_WIDTH;
      ctx.beginPath();
      ctx.moveTo(SIDELINE_PADDING, losY);
      ctx.lineTo(W - SIDELINE_PADDING, losY);
      ctx.stroke();

      // Hash marks every 1 yard (ticks across both hash locations)
      ctx.strokeStyle = HASH_COLOR;
      ctx.lineWidth = HASH_WIDTH;

      const leftHashX = SIDELINE_PADDING + (W - SIDELINE_PADDING * 2) * HASH_LEFT_X_RATIO;
      const rightHashX = SIDELINE_PADDING + (W - SIDELINE_PADDING * 2) * HASH_RIGHT_X_RATIO;

      for (let yds = -FIELD_YARDS_ABOVE_LOS; yds <= FIELD_YARDS_BELOW_LOS; yds += 1) {
        const y = yFromYards(yds, H);

        // Left hash tick
        ctx.beginPath();
        ctx.moveTo(leftHashX - HASH_TICK_LEN / 2, y);
        ctx.lineTo(leftHashX + HASH_TICK_LEN / 2, y);
        ctx.stroke();

        // Right hash tick
        ctx.beginPath();
        ctx.moveTo(rightHashX - HASH_TICK_LEN / 2, y);
        ctx.lineTo(rightHashX + HASH_TICK_LEN / 2, y);
        ctx.stroke();
      }

      ctx.restore();
    }, []);

    const drawArrow = useCallback(
      (ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string) => {
        const arrow = makeArrow(from, to, 36);
        if (!arrow) return;
        const left = getStroke(arrow.leftStroke as any, { size: LINE_WIDTH, thinning: 0.7 });
        const right = getStroke(arrow.rightStroke as any, { size: LINE_WIDTH, thinning: 0.7 });
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke(new Path2D(getSvgPathFromStroke(left, false)));
        ctx.stroke(new Path2D(getSvgPathFromStroke(right, false)));
        ctx.restore();
      },
      []
    );

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawField(ctx);

      // draw paths (routes)
      paths.forEach((p) => {
        ctx.save();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke(new Path2D(p.path));
        ctx.restore();
      });

      // Draw arrowheads only for the MOST RECENT path per startIconIndex
      const lastIndexByIcon = new Map<number, number>();
      paths.forEach((p, i) => {
        if (p.startIconIndex !== undefined) lastIndexByIcon.set(p.startIconIndex, i);
      });
      paths.forEach((p, i) => {
        if (
          p.startIconIndex !== undefined &&
          lastIndexByIcon.get(p.startIconIndex) === i &&
          p.arrowFrom &&
          p.arrowTo
        ) {
          drawArrow(ctx, p.arrowFrom, p.arrowTo, p.color);
        }
      });

      // draw icons (players)
      playerIcons.forEach((icon, idx) => {
        ctx.save();
        const size = PLAYER_SIZE;
        ctx.fillStyle = icon.color;
        if (icon.isSquare) {
          ctx.fillRect(icon.x - size / 2, icon.y - size / 2, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(icon.x, icon.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon.letter, icon.x, icon.y);

        ctx.restore();
      });
    }, [paths, playerIcons, drawField, drawArrow]);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getCanvas: () => canvasRef.current,
        undo: () => {
          setUndoStack((prev) => {
            if (prev.length === 0) return prev;
            const prevState = prev[prev.length - 1];
            setRedoStack((rs) => [
              ...rs,
              { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) },
            ]);
            setPaths(prevState.paths);
            setPlayerIcons(prevState.playerIcons);
            return prev.slice(0, -1);
          });
        },
        redo: () => {
          setRedoStack((prev) => {
            if (prev.length === 0) return prev;
            const nextState = prev[prev.length - 1];
            setUndoStack((us) => [
              ...us,
              { paths: [...paths], playerIcons: playerIcons.map((i) => ({ ...i })) },
            ]);
            setPaths(nextState.paths);
            setPlayerIcons(nextState.playerIcons);
            return prev.slice(0, -1);
          });
        },
        clear: () => {
          pushSnapshot();
          setPaths([]);
          setPlayerIcons([]);
          setCurrentPoints([]);
          setIsDrawing(false);
          setActiveIconIndex(null);
        },
        clearRoutes: () => {
          pushSnapshot();
          setPaths((prev) => prev.filter((p) => p.startIconIndex === undefined));
        },
        loadState: (data) => {
          pushSnapshot();
          setPaths(data.paths || []);
          setPlayerIcons(data.playerIcons || []);
        },
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        getPaths: () => paths,
        getIcons: () => playerIcons,
      }),
      [paths, playerIcons, pushSnapshot, undoStack, redoStack]
    );

    // draw whenever relevant state changes
    useEffect(() => {
      draw();
    }, [draw]);

    // pointer helpers
    const getPointerPos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
      const rect = canvas.getBoundingClientRect();
      // Use offset within canvas CSS box; supports retina scaling via actual width/height attributes
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure || 0.5,
      };
    };

    const findIconIndexAt = (x: number, y: number) => {
      const radius = PLAYER_SIZE / 2 + 8; // hit padding
      return playerIcons.findIndex((icon) => {
        const dx = icon.x - x;
        const dy = icon.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= radius;
      });
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // capture to improve drag on some browsers
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);

      const p = getPointerPos(e);
      const clicked = findIconIndexAt(p.x, p.y);

      // If a player is selected (toolbar), place or update icon
      if (selectedPlayer && !drawingMode) {
        pushSnapshot();
        if (clicked >= 0) {
          // update existing icon
          setPlayerIcons((prev) => {
            const copy = [...prev];
            copy[clicked] = {
              ...copy[clicked],
              letter: selectedPlayer.letter,
              color: selectedPlayer.color,
              isSquare: selectedPlayer.isSquare,
            };
            return copy;
          });
        } else {
          // create new icon
          setPlayerIcons((prev) => [
            ...prev,
            {
              x: p.x,
              y: p.y,
              letter: selectedPlayer.letter,
              color: selectedPlayer.color,
              isSquare: selectedPlayer.isSquare,
            },
          ]);
        }
        setSelectedPlayer(null);
        return;
      }

      // If in drawing mode and clicking an icon, start route from that icon
      if (drawingMode) {
        if (clicked >= 0) {
          const icon = playerIcons[clicked];
          setCurrentLineColor(icon.color);
          setActiveIconIndex(clicked);
          setIsDrawing(true);
          setCurrentPoints([{ x: icon.x, y: icon.y, pressure: 0.5 }]);
          return;
        } else {
          setIsDrawing(true);
          setCurrentPoints([{ x: p.x, y: p.y, pressure: p.pressure }]);
          return;
        }
      }

      // Otherwise, if clicked an icon, start dragging
      if (clicked >= 0) {
        const icon = playerIcons[clicked];
        draggingIndexRef.current = clicked;
        dragOffsetRef.current = { x: p.x - icon.x, y: p.y - icon.y };
        setIsDragging(true);
        pushSnapshot();
        return;
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = getPointerPos(e);

      // dragging icons
      if (isDragging && draggingIndexRef.current !== null) {
        setPlayerIcons((prev) => {
          const copy = [...prev];
          const i = draggingIndexRef.current!;
          copy[i] = { ...copy[i], x: p.x - dragOffsetRef.current.x, y: p.y - dragOffsetRef.current.y };
          return copy;
        });
        return;
      }

      // drawing
      if (isDrawing) {
        setCurrentPoints((prev) => [...prev, { x: p.x, y: p.y, pressure: p.pressure }]);
        // preview current stroke
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        draw(); // redraw base
        if (currentPoints.length >= 1) {
          const strokeIn = [...currentPoints, { x: p.x, y: p.y, pressure: p.pressure }].map((pt) => [
            pt.x,
            pt.y,
            pt.pressure,
          ]);
          const stroke = getStroke(strokeIn as any, {
            size: LINE_WIDTH,
            thinning: 0.7,
            smoothing: 1,
            streamline: 1,
            last: false,
          });
          ctx.save();
          ctx.strokeStyle = currentLineColor;
          ctx.lineWidth = LINE_WIDTH;
          ctx.stroke(new Path2D(getSvgPathFromStroke(stroke, false)));
          ctx.restore();
        }
      }
    };

    const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
      // release capture (defensive)
      if (e) (e.currentTarget as any).releasePointerCapture?.(e.pointerId);

      // finish dragging
      if (isDragging && draggingIndexRef.current !== null) {
        setIsDragging(false);
        draggingIndexRef.current = null;
        return;
      }

      // finish drawing
      if (isDrawing) {
        setIsDrawing(false);
        if (currentPoints.length < 2) {
          setCurrentPoints([]);
          return;
        }
        pushSnapshot();
        const input = currentPoints.map((pt) => [pt.x, pt.y, pt.pressure]);
        const stroke = getStroke(input as any, {
          size: LINE_WIDTH,
          thinning: 0.7,
          smoothing: 1,
          streamline: 1,
          last: true,
        });
        const pathStr = getSvgPathFromStroke(stroke, false);

        const newPath: PathItem = {
          path: pathStr,
          color: currentLineColor,
          startIconIndex: activeIconIndex ?? undefined,
          // Only set arrow geometry if the route started from an icon
          arrowFrom: activeIconIndex !== null ? currentPoints[0] : undefined,
          arrowTo: activeIconIndex !== null ? currentPoints[currentPoints.length - 1] : undefined,
        };

        setPaths((prev) => [...prev, newPath]);
        setCurrentPoints([]);
        setActiveIconIndex(null);

        if (onDrawingComplete) onDrawingComplete(pathStr);
        return;
      }
    };

    // drag/drop handling for external drag (from PlayerToolbar)
    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data && data.letter && data.color) {
          pushSnapshot();
          setPlayerIcons((prev) => [
            ...prev,
            { x, y, letter: data.letter, color: data.color, isSquare: !!data.isSquare },
          ]);
        }
      } catch {
        // ignore invalid drop data
      }
    };

    // ensure canvas dimensions reflect props
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      draw();
    }, [width, height, draw]);

    return (
      <div className="relative">
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
          className="border border-gray-300 bg-white touch-none"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
export default Canvas;
