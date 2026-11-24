import { useEffect, useRef, useState } from 'react';
import type React from 'react';

interface ViewportGestureHandlers {
  /** Scroll the view by a screen-px delta (content follows the pointer). */
  onPan: (dx: number, dy: number) => void;
  /** Zoom by an incremental ratio, anchored at a client-px point.
   *  `immediate` skips the two-finger pan/zoom threshold. */
  onPinch: (ratio: number, clientX: number, clientY: number, immediate?: boolean) => void;
  /** Fit the whole play on screen and recentre it. */
  onFit: () => void;
  /** A two-finger gesture ended (see handlePinch in PlayDesigner). */
  onPinchEnd: () => void;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Space pans only from the page, the field or the floating toolbars — not
 *  from a dialog, where Space must keep pressing the focused button. */
const spaceCanPan = (t: EventTarget | null) =>
  !(t instanceof HTMLElement) || t === document.body || Boolean(t.closest('main, [role="toolbar"]'));

/**
 * Moving around the full-screen field, on the scroll container (`<main>`).
 * The play canvas handles its own touches (draw, select, two-finger pan and
 * pinch); this covers everything else:
 *
 * - the surround (anywhere off the play window): one finger or the mouse drags
 *   the view, two fingers pan + pinch-zoom;
 * - Space + drag or middle-button drag anywhere, in any tool — intercepted in
 *   the capture phase so the canvas never sees it as a draw;
 * - Ctrl/⌘ + wheel, and trackpad pinch (which browsers send as ctrl+wheel),
 *   zooms at the cursor; a plain wheel / two-finger trackpad scroll is native;
 * - the 0 key fits the play.
 */
export function useViewportGestures(mainRef: React.RefObject<HTMLElement>, h: ViewportGestureHandlers) {
  const handlers = useRef(h);
  handlers.current = h;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ midX: number; midY: number; dist: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === 'Space') {
        if (!spaceCanPan(e.target)) return;
        e.preventDefault(); // otherwise the browser scrolls / clicks the focused button
        if (!spaceRef.current) { spaceRef.current = true; setSpaceHeld(true); }
      } else if (e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey && spaceCanPan(e.target)) {
        handlers.current.onFit();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceRef.current = false; setSpaceHeld(false); }
    };
    const blur = () => { spaceRef.current = false; setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Non-passive, so ctrl+wheel can be kept from zooming the whole page.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    // A wheel "gesture" has no end event; close it after a short pause so the
    // next one starts from the zoom actually on screen.
    let idle: ReturnType<typeof setTimeout> | undefined;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      handlers.current.onPinch(Math.exp(-e.deltaY / 100), e.clientX, e.clientY, true);
      clearTimeout(idle);
      idle = setTimeout(() => handlers.current.onPinchEnd(), 150);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', wheel);
      clearTimeout(idle);
    };
  }, [mainRef]);

  /** Midpoint and finger spread of the tracked pointers right now. */
  const snapshot = () => {
    const pts = Array.from(pointers.current.values()).slice(0, 2);
    if (pts.length === 0) return null;
    return {
      midX: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      midY: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
    };
  };

  const track = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Baseline from where the pointers are now, so the very first move
    // counts (a null baseline used to swallow it).
    last.current = snapshot();
    setPanning(true);
  };

  /** Capture phase: Space/middle-drag pans even over the play canvas. */
  const onPointerDownCapture = (e: React.PointerEvent) => {
    const forced = e.pointerType === 'mouse' && (e.button === 1 || (e.button === 0 && spaceRef.current));
    if (!forced) return;
    e.preventDefault();
    e.stopPropagation();
    track(e);
  };

  /** Bubble phase: a press on the surround (not the play canvas) pans. */
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).id === 'play-canvas') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    track(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = snapshot();
    const prev = last.current;
    last.current = now;
    if (!now || !prev) return;
    handlers.current.onPan(now.midX - prev.midX, now.midY - prev.midY);
    if (now.dist && prev.dist) handlers.current.onPinch(now.dist / prev.dist, now.midX, now.midY);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const wasPinch = pointers.current.size >= 2;
    if (!pointers.current.delete(e.pointerId)) return;
    // Re-baseline on the remaining finger, so lifting one doesn't jump the view.
    last.current = snapshot();
    if (wasPinch) handlers.current.onPinchEnd();
    if (pointers.current.size === 0) setPanning(false);
  };

  return {
    spaceHeld,
    panning,
    handlers: {
      onPointerDownCapture,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
