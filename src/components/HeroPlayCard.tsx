import React, { useEffect, useRef } from 'react';
import { renderScene } from '../lib/renderPlayScene';
import type { PathItem, PlayerIcon, Pt } from '../lib/renderPlayScene';

/**
 * Homepage hero demo — a real play, rendered by the same renderScene the
 * designer uses (not a screenshot or mockup), with its routes drawing
 * themselves in once on mount. Closes the "no product demo" gap flagged in
 * MARKETING.md: this is the first thing a visitor sees of what the tool
 * actually produces.
 *
 * Sample: a 5v5/7v7 trips-right look (no offensive line, matching how flag
 * formations are actually drawn) — a 3-level flood to the trips side (slant,
 * out, flat). Receivers line up on the LOS (the field's "20" line, at
 * FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS of the height); only the QB sits
 * behind it. The snapper (C) has no route, same as a real snap.
 */
const LOS_Y = 17 / 30; // FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS, kept in sync with renderPlayScene's field

const DEMO_ICONS: PlayerIcon[] = [
  { x: 0.5, y: LOS_Y, letter: 'C', color: '#16283D' },
  { x: 0.5, y: 0.72, letter: 'Q', color: '#16283D' },
  { x: 0.62, y: LOS_Y, letter: 'H', color: '#16283D' },
  { x: 0.74, y: LOS_Y, letter: 'Z', color: '#16283D' },
  { x: 0.86, y: LOS_Y, letter: 'X', color: '#16283D' },
];

const DEMO_PATHS: PathItem[] = [
  {
    // H: slant
    startIconIndex: 2,
    color: '#1FA75D',
    mode: 'waypoint',
    points: [
      { x: 0.62, y: LOS_Y },
      { x: 0.55, y: 0.42 },
      { x: 0.46, y: 0.32 },
    ],
  },
  {
    // Z: out
    startIconIndex: 3,
    color: '#1FA75D',
    mode: 'waypoint',
    points: [
      { x: 0.74, y: LOS_Y },
      { x: 0.74, y: 0.45 },
      { x: 0.82, y: 0.4 },
    ],
  },
  {
    // X: flat
    startIconIndex: 4,
    color: '#1FA75D',
    mode: 'straight',
    points: [
      { x: 0.86, y: LOS_Y },
      { x: 0.86, y: 0.5 },
      { x: 0.94, y: 0.47 },
    ],
  },
];

const CANVAS_W = 800;
const CANVAS_H = 620;
const DRAW_MS = 1100;

function pathLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Points from the start of the route up through progress `t` (0–1) of its
 *  total length, interpolating the final partial segment — used to render
 *  the route mid-stroke for the draw-in animation. */
function sliceByProgress(points: Pt[], t: number): Pt[] {
  if (t >= 1) return points;
  const target = pathLength(points) * t;
  let travelled = 0;
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (travelled + segLen >= target) {
      const remaining = target - travelled;
      const frac = segLen === 0 ? 0 : remaining / segLen;
      out.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * frac,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * frac,
      });
      return out;
    }
    travelled += segLen;
    out.push(points[i]);
  }
  return out;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const CARD_FADE_MS = 500;

type HeroPlayCardProps = {
  /** Delay before the card itself fades in ("lights on"). Routes start
   *  drawing CARD_FADE_MS after that, once the card has fully appeared —
   *  part of Hero's load choreography. */
  revealDelayMs?: number;
};

export function HeroPlayCard({ revealDelayMs = 0 }: HeroPlayCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      renderScene(ctx, CANVAS_W, CANVAS_H, DEMO_PATHS, DEMO_ICONS);
      return;
    }

    let frame = 0;
    let cancelled = false;
    const startDrawing = () => {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = easeOut(Math.min(1, (now - start) / DRAW_MS));
        const animatedPaths = DEMO_PATHS.map((p) => ({ ...p, points: sliceByProgress(p.points, t) }));
        renderScene(ctx, CANVAS_W, CANVAS_H, animatedPaths, DEMO_ICONS);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Render the field + standing icons immediately (no routes yet) so the
    // card isn't blank while it waits out its reveal + start delay.
    renderScene(ctx, CANVAS_W, CANVAS_H, DEMO_PATHS.map((p) => ({ ...p, points: sliceByProgress(p.points, 0) })), DEMO_ICONS);
    const timeout = window.setTimeout(() => { if (!cancelled) startDrawing(); }, revealDelayMs + CARD_FADE_MS);
    return () => { cancelled = true; window.clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [revealDelayMs]);

  return (
    <div
      className="card-lights-on rounded-xl border-2 border-board/15 bg-white shadow-xl p-3"
      style={{ '--reveal-delay': `${revealDelayMs}ms` } as React.CSSProperties}
    >
      <p className="font-label text-xs tracking-widest uppercase text-board/50 mb-2 px-1">
        Trips Rt &middot; Flood
      </p>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-auto rounded-md"
        role="img"
        aria-label="Sample play diagram: trips right formation with a slant, out, and flat route flood, drawn in Playbuilder Pro"
      />
    </div>
  );
}
