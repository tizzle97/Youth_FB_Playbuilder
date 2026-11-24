import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';

/** Where a panel starts when nothing is stored for it yet. */
export type PanelAnchor = 'top-left' | 'top-right' | 'bottom-center';

type Pos = { x: number; y: number };

// Distance kept between a panel and the viewport edge (plus the safe-area
// inset — the notch sits on the left/right of a phone held sideways).
const EDGE = 10;

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (Safari private mode) — the panel still works, it just
    // won't remember where it was.
  }
}

/** env(safe-area-inset-*) can't be read from JS directly; measure a probe. */
function safeAreaInsets() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

/**
 * A floating panel the coach can drag anywhere by its grip, which remembers
 * where it was left (per device, in localStorage) and is re-clamped into the
 * viewport on resize and rotation so it can never be lost off-screen.
 *
 * Only the grip takes drag input (`gripProps`): the panel's own buttons and
 * the toolbar's horizontally-scrolling chip rows keep their normal touch
 * behavior.
 */
export function useDraggablePanel(storageKey: string, anchor: PanelAnchor, layoutKey: unknown) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsedState] = useState<boolean>(() => readStored<boolean>(`${storageKey}:collapsed`) ?? false);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);

  const clamp = useCallback((p: Pos): Pos => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const inset = safeAreaInsets();
    const minX = EDGE + inset.left;
    const minY = EDGE + inset.top;
    const maxX = Math.max(minX, window.innerWidth - w - EDGE - inset.right);
    const maxY = Math.max(minY, window.innerHeight - h - EDGE - inset.bottom);
    return { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) };
  }, []);

  const defaultPos = useCallback((): Pos => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    if (anchor === 'top-right') return { x: window.innerWidth - w, y: 0 };
    if (anchor === 'bottom-center') return { x: (window.innerWidth - w) / 2, y: window.innerHeight - h };
    return { x: 0, y: 0 };
  }, [anchor]);

  // Place once measured (and again when the layout swaps, e.g. panel ↔ dock,
  // since each layout keeps its own stored spot under its own key).
  useLayoutEffect(() => {
    const stored = readStored<Pos>(storageKey);
    setPos(clamp(stored && Number.isFinite(stored.x) && Number.isFinite(stored.y) ? stored : defaultPos()));
  }, [storageKey, clamp, defaultPos, layoutKey]);

  // Keep it on screen through resizes, rotations and its own size changes
  // (collapsing, or the toolbar growing when a tool opens extra rows).
  useEffect(() => {
    const reclamp = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', reclamp);
    const ro = new ResizeObserver(reclamp);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', reclamp);
      ro.disconnect();
    };
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !pos) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setPos((p) => {
      if (p) writeStored(storageKey, p);
      return p;
    });
  };

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    writeStored(`${storageKey}:collapsed`, next);
  };

  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y }
    // Measured off-screen-invisible on the first frame, then placed.
    : { position: 'fixed', left: 0, top: 0, visibility: 'hidden' };

  return {
    panelRef,
    style,
    dragging,
    collapsed,
    setCollapsed,
    gripProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { touchAction: 'none' as const, cursor: dragging ? 'grabbing' : 'grab' },
    },
  };
}
