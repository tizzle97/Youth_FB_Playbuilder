import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { drawFieldSurround, type FieldRect } from '../../lib/renderPlayScene';

interface FieldBackdropProps {
  /** The scroll container the field moves in — redrawn on its scroll. */
  scrollRef: React.RefObject<HTMLElement>;
  /** Changes whenever the field's on-screen size changes (fit or zoom). */
  sizeKey: string;
}

/**
 * The rest of the football field around the 30-yard play window, filling the
 * screen behind it so the designer reads as one continuous field rather than
 * a box. Purely decorative: pointer-events none, never saved or exported.
 *
 * It stays fixed to the viewport and redraws from the play canvas's current
 * on-screen rect, rather than being one huge canvas the size of the scroll
 * world — at 3× zoom that would be tens of millions of pixels.
 */
export function FieldBackdrop({ scrollRef, sizeKey }: FieldBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    frameRef.current = null;
    const bd = canvasRef.current;
    const field = document.getElementById('play-canvas');
    if (!bd || !field) return;
    const b = bd.getBoundingClientRect();
    const w = Math.round(b.width);
    const h = Math.round(b.height);
    if (bd.width !== w) bd.width = w;
    if (bd.height !== h) bd.height = h;
    const ctx = bd.getContext('2d');
    if (!ctx) return;
    const f = field.getBoundingClientRect();
    const rect: FieldRect = { x: f.left - b.left, y: f.top - b.top, w: f.width, h: f.height };
    ctx.clearRect(0, 0, w, h);
    drawFieldSurround(ctx, w, h, rect);
    if (import.meta.env.DEV) {
      (window as unknown as { __PBP_BACKDROP__?: unknown }).__PBP_BACKDROP__ = { field: rect, width: w, height: h };
    }
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Size/zoom changes land in a layout effect so the surround never lags the
  // field by a frame when the fit changes.
  useLayoutEffect(() => { draw(); }, [draw, sizeKey]);

  useEffect(() => {
    const el = scrollRef.current;
    el?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => {
      el?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [scrollRef, schedule]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="field-backdrop"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
