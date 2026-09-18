import { useEffect, useState } from 'react';
import { getDrawStats } from './Canvas';

/**
 * TEMPORARY diagnostic overlay for the iOS Safari "mobile bar dead until an
 * unrelated relayout" bug (playbuilderpro PR #152). Renders nothing unless
 * `?debug=touch` is in the URL, so it ships with zero risk or visibility to
 * real users — no setup (cable, Web Inspector) needed to read it, just the
 * query param on the phone itself.
 *
 * Prior fixes each looked well-reasoned from the diff and each missed,
 * because none were checked against what's actually happening on the device
 * at the moment a tap fails. This shows that instead: viewport/element
 * geometry (live on every resize/orientation change), exactly what a tap's
 * target and elementFromPoint resolve to, draw()'s own call count/timing
 * (Canvas.tsx's getDrawStats — ruled out a redraw burst as the cause: 3
 * calls, all under 1ms, over 28s with a confirmed-dead tap in between), and
 * the canvas's actual backing-store size vs. its CSS rect (the ground truth
 * for whether a `?dpr=` override — see backingScale() — actually took
 * effect). A confirmed-empty lastTap (zero pointerdown reaching even a
 * capture-phase document listener, for a real tap) rules out the wrong
 * element being hit; the remaining untested variable is whether the backing
 * store's raw SIZE (not how/when it's set) is itself what triggers this.
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
  const [draws, setDraws] = useState(getDrawStats());
  // Backing store's actual device-pixel size vs. its CSS rect — the ground
  // truth for what DPR is really active, read off the live element rather
  // than recomputed, so it can't disagree with what backingScale() actually
  // did (or silently fail to apply a ?dpr= override).
  const [backing, setBacking] = useState<{ w: number; h: number; effectiveDpr: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      setVh(window.innerHeight);
      setVw(window.innerWidth);
      setMainRect(rectOf(document.querySelector('main')));
      setBarRect(rectOf(document.querySelector('[data-testid="mobile-toolbar"]')));
      const canvasEl = document.getElementById('play-canvas') as HTMLCanvasElement | null;
      setCanvasRect(rectOf(canvasEl));
      if (canvasEl) {
        const cssW = canvasEl.getBoundingClientRect().width || 1;
        setBacking({ w: canvasEl.width, h: canvasEl.height, effectiveDpr: Math.round((canvasEl.width / cssW) * 100) / 100 });
      }
      // Any roster chip — they're all the same row; the first one found is enough.
      setChipRect(rectOf(document.querySelector('[data-testid="mobile-toolbar"] button[title^="Player "]')));
      setDraws(getDrawStats());
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
backing: ${backing ? `${backing.w}x${backing.h} device-px  (effective dpr=${backing.effectiveDpr})` : '(not found)'}
${line('chip:   ', chipRect)}${chipCoveredByCanvas === null ? '' : chipCoveredByCanvas ? '  <<< CHIP ROW OVERLAPS CANVAS RECT' : '  (clear of canvas)'}
draws:  count=${draws.count} last=${draws.lastMs}ms max=${draws.maxMs}ms inLast1s=${draws.inLast1s}${draws.inLast1s >= 2 ? '  <<< BURST RIGHT NOW' : ''}
lastTap: ${lastTap ? `x=${lastTap.x} y=${lastTap.y}\n  target=${lastTap.target}\n  efp=   ${lastTap.efp}` : '(tap something — including a dead chip — and it will show here)'}`}
    </div>
  );
}
