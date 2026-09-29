import React, { useEffect, useRef } from 'react';
import { renderScene } from '../lib/renderPlayScene';
import type { PathItem, PlayerIcon, Zone, Pt } from '../lib/renderPlayScene';

/**
 * A read-only, animated play diagram in a white card — the same shell
 * `HeroPlayCard` pioneered for the homepage hero, generalized to take
 * arbitrary scene data so it can also illustrate a concept mid-blog-post
 * (see blogPlayScenes.ts / blogDiagrams.ts). `HeroPlayCard` is now a thin
 * wrapper over this with its own fixed sample play — kept separate so a
 * blog redesign can't touch the homepage's own render path or its smoke
 * coverage.
 *
 * Rendered by the same renderScene the designer and every export use — this
 * is a real render of real play data, not a mockup or a screenshot.
 */

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

const CANVAS_W = 800;
const CANVAS_H = 620;
const DRAW_MS = 1100;
const CARD_FADE_MS = 500;

export type PlayDiagramCardProps = {
  icons: PlayerIcon[];
  paths: PathItem[];
  zones?: Zone[];
  label: string;
  /** Canvas aria-label — a real descriptive sentence, not the bare label. */
  alt: string;
  /** 'mount' = start drawing shortly after mount (Hero's load choreography).
   *  'inView' = wait for an IntersectionObserver — for a diagram mid-article
   *  the reader hasn't scrolled to yet, so it draws in at the moment it
   *  actually becomes the reader's "now" instead of firing off-screen.
   *  'none' = render the final state immediately, no animation. */
  animate?: 'mount' | 'inView' | 'none';
  revealDelayMs?: number;
  className?: string;
};

export function PlayDiagramCard({
  icons, paths, zones, label, alt, animate = 'none', revealDelayMs = 0, className,
}: PlayDiagramCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const drawFinal = () => renderScene(ctx, CANVAS_W, CANVAS_H, paths, icons, zones);

    if (animate === 'none' || reduceMotion) {
      drawFinal();
      return;
    }

    let frame = 0;
    let cancelled = false;
    const startDrawing = () => {
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = easeOut(Math.min(1, (now - start) / DRAW_MS));
        const animatedPaths = paths.map((p) => ({ ...p, points: sliceByProgress(p.points, t) }));
        renderScene(ctx, CANVAS_W, CANVAS_H, animatedPaths, icons, zones);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Field + standing icons immediately, routes sliced to progress 0, so
    // the card isn't blank while it waits out its start delay/visibility.
    renderScene(ctx, CANVAS_W, CANVAS_H, paths.map((p) => ({ ...p, points: sliceByProgress(p.points, 0) })), icons, zones);

    if (animate === 'mount') {
      const timeout = window.setTimeout(() => { if (!cancelled) startDrawing(); }, revealDelayMs + CARD_FADE_MS);
      return () => { cancelled = true; window.clearTimeout(timeout); cancelAnimationFrame(frame); };
    }

    // animate === 'inView'
    const card = cardRef.current;
    if (!card) { drawFinal(); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !cancelled) {
          startDrawing();
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.3 },
    );
    observer.observe(card);
    return () => { cancelled = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [icons, paths, zones, animate, revealDelayMs]);

  return (
    <div
      ref={cardRef}
      className={`card-lights-on rounded-xl border-2 border-board/15 bg-white shadow-xl p-3 ${className ?? ''}`}
      style={animate === 'mount' ? ({ '--reveal-delay': `${revealDelayMs}ms` } as React.CSSProperties) : undefined}
    >
      <p className="font-label text-xs tracking-widest uppercase text-board/50 mb-2 px-1">{label}</p>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full h-auto rounded-md"
        role="img"
        aria-label={alt}
      />
    </div>
  );
}
