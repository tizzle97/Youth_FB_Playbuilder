import { useEffect, useState } from 'react';

/**
 * TEMPORARY diagnostic overlay for the iOS Safari "mobile bar dead until an
 * unrelated relayout" bug (playbuilderpro PR #152). Renders nothing unless
 * `?debug=touch` is in the URL, so it ships with zero risk or visibility to
 * real users — no setup (cable, Web Inspector) needed to read it, just the
 * query param on the phone itself.
 *
 * Three prior fixes (two CSS, one canvas-sizing) each looked well-reasoned
 * from the diff and each missed, because none were checked against what's
 * actually happening on the device at the moment a tap fails. This shows
 * that instead: viewport/element geometry, live on every resize/orientation
 * change, plus exactly what a tap's target and elementFromPoint resolve to.
 *
 * Delete this file and its one import + one JSX line in PlayDesigner.tsx,
 * and the `data-testid="mobile-toolbar"` attribute, once this is resolved.
 */

type Rect = { top: number; bottom: number; left: number; right: number; height: number; width: number };
type TapInfo = { x: number; y: number; target: string; efp: string };

function describe(el: Element | null): string {
  if (!el) return 'null';
  const id = el.id ? `#${el.id}` : '';
  const cls = (el as HTMLElement).className;
  const clsStr = typeof cls === 'string' && cls
    ? `.${cls.trim().split(/\s+/).slice(0, 3).join('.')}`
    : '';
  return `${el.tagName.toLowerCase()}${id}${clsStr}`;
}

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    left: Math.round(r.left), right: Math.round(r.right),
    height: Math.round(r.height), width: Math.round(r.width),
  };
}

export function DebugHud() {
  const [enabled] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'touch',
  );
  const [vh, setVh] = useState(0);
  const [vw, setVw] = useState(0);
  const [mainRect, setMainRect] = useState<Rect | null>(null);
  const [barRect, setBarRect] = useState<Rect | null>(null);
  const [canvasRect, setCanvasRect] = useState<Rect | null>(null);
  const [chipRect, setChipRect] = useState<Rect | null>(null);
  const [lastTap, setLastTap] = useState<TapInfo | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      setVh(window.innerHeight);
      setVw(window.innerWidth);
      setMainRect(rectOf(document.querySelector('main')));
      setBarRect(rectOf(document.querySelector('[data-testid="mobile-toolbar"]')));
      setCanvasRect(rectOf(document.getElementById('play-canvas')));
      // Any roster chip — they're all the same row; the first one found is enough.
      setChipRect(rectOf(document.querySelector('[data-testid="mobile-toolbar"] button[title^="Player "]')));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    // Capture phase so this sees the event regardless of what (if anything)
    // downstream calls stopPropagation.
    const onDown = (e: PointerEvent) => {
      const efp = document.elementFromPoint(e.clientX, e.clientY);
      setLastTap({ x: Math.round(e.clientX), y: Math.round(e.clientY), target: describe(e.target as Element), efp: describe(efp) });
      measure();
    };
    document.addEventListener('pointerdown', onDown, true);
    // Re-measure once a second too, in case something shifts without firing
    // a resize/orientationchange event (e.g. iOS settling its own chrome).
    const iv = window.setInterval(() => { setTick((n) => n + 1); measure(); }, 1000);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      document.removeEventListener('pointerdown', onDown, true);
      window.clearInterval(iv);
    };
  }, [enabled]);

  if (!enabled) return null;

  const barBelowViewport = barRect ? barRect.bottom > vh + 1 : null;
  const chipCoveredByCanvas = chipRect && canvasRect
    ? chipRect.top < canvasRect.bottom && chipRect.bottom > canvasRect.top
    : null;

  const line = (label: string, r: Rect | null) =>
    r ? `${label} top=${r.top} bot=${r.bottom} h=${r.height} w=${r.width}` : `${label} (not found)`;

  return (
    <div
      style={{
        position: 'fixed', top: 4, left: 4, right: 4, zIndex: 999999,
        background: 'rgba(0,0,0,0.88)', color: '#39ff6a', font: '10px/1.45 ui-monospace,monospace',
        padding: '6px 8px', borderRadius: 6, pointerEvents: 'none', whiteSpace: 'pre-wrap',
      }}
    >
      {`DEBUG HUD  (tick ${tick} — waiting = ok, it re-measures every 1s)
viewport: ${vw} x ${vh}
${line('main:   ', mainRect)}
${line('bar:    ', barRect)}${barBelowViewport === null ? '' : barBelowViewport ? '  <<< BAR EXTENDS BELOW VIEWPORT' : '  (fully in view)'}
${line('canvas: ', canvasRect)}
${line('chip:   ', chipRect)}${chipCoveredByCanvas === null ? '' : chipCoveredByCanvas ? '  <<< CHIP ROW OVERLAPS CANVAS RECT' : '  (clear of canvas)'}
lastTap: ${lastTap ? `x=${lastTap.x} y=${lastTap.y}\n  target=${lastTap.target}\n  efp=   ${lastTap.efp}` : '(tap something — including a dead chip — and it will show here)'}`}
    </div>
  );
}
