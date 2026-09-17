import { useEffect, useMemo, useRef, useState } from 'react';
import { generateWristbandHTML } from '../lib/exportStyles';
import { demoWristbandPlays, type PreviewPlay } from '../lib/wristbandDemo';
import type { UserPreferences } from '../lib/userPreferences';

/**
 * Shows what the Pro wristband export actually produces.
 *
 * "Wristband export" was one bullet on the Pricing page and a Pro lock in the
 * export modal — a coach who hasn't used a QB wristband had no way to picture
 * what they'd be buying. This renders the real thing instead of describing it.
 *
 * It calls the SAME generateWristbandHTML the export uses and drops the result
 * into a sandboxed iframe, so the preview cannot drift from the product: the
 * wristband layout changed five times in the month before this was written,
 * and a screenshot would have been stale within a week. The returned HTML is a
 * complete document with its own @page rules, which is exactly what an iframe
 * wants — and it means none of the export's print CSS can leak into the app.
 *
 * The iframe gets `allow-same-origin` (so we can measure the rendered height)
 * but NOT `allow-scripts`, so nothing in the generated document can execute.
 */

/**
 * The sheet's page width in CSS px (96 per inch).
 *
 * ⚠ The wristband sheet is LANDSCAPE — generateWristbandHTML's @page is
 * `11in 8.5in` (or `A4 landscape`), not portrait. Rendering the iframe at
 * portrait width silently clips the sheet: `.wb-grid` is two 4.5in inserts
 * with `justify-content: center`, so a too-narrow viewport overflows it on
 * BOTH sides and the left column becomes unreachable.
 */
const sheetWidthPx = (paperSize?: string | null) => (paperSize === 'a4' ? 11.69 : 11) * 96;
const FALLBACK_HEIGHT = 620;
const BOTTOM_PAD = 20;

type WristbandPreviewProps = {
  /** Plays to render. Falls back to the sample set when empty, so the
   *  component is always showing something real. */
  plays?: PreviewPlay[];
  preferences?: UserPreferences | null;
  /** Rendered width. The sheet is scaled down to fit this. */
  width?: number;
  className?: string;
};

export function WristbandPreview({
  plays,
  preferences = null,
  width = 560,
  className = '',
}: WristbandPreviewProps) {
  const [textOnly, setTextOnly] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(FALLBACK_HEIGHT);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // `width` is a maximum, not a fixed size: the sheet is a landscape page, so
  // at phone width an unclamped preview pushes the whole page sideways. Track
  // the space actually available and scale into it.
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measureHost = () => setAvailableWidth(host.clientWidth || null);
    measureHost();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measureHost);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Only fall back to samples when the caller has nothing — a coach seeing
  // their own play names on a wristband is the whole point of showing this
  // inside the app.
  const previewPlays = useMemo<PreviewPlay[]>(
    () => (plays && plays.length > 0 ? plays : demoWristbandPlays()),
    [plays],
  );
  const usingSamples = !plays || plays.length === 0;

  const html = useMemo(
    () =>
      generateWristbandHTML<PreviewPlay>({
        plays: previewPlays,
        getName: (p) => p.name,
        getImage: (p) => p.image,
        title: preferences?.team_name ? `${preferences.team_name} Playbook` : 'Football Playbook',
        textOnly,
        preferences,
      }),
    [previewPlays, textOnly, preferences],
  );

  // Measure the real content height so the frame hugs the sheet instead of
  // padding it out to a full letter page. Re-runs whenever the document
  // changes, since the two layouts are very different heights.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      if (cancelled) return;
      try {
        const body = frame.contentDocument?.body;
        // Body only — never documentElement, which fills the iframe viewport
        // and so can only ever grow: measuring it feeds the height we just set
        // straight back in and the frame never shrinks again.
        // BOTTOM_PAD covers the export footer's own top margin, which rounds
        // out of scrollHeight and clipped the "Generated on …" line.
        if (body) setSheetHeight(Math.max(body.scrollHeight + BOTTOM_PAD, 200));
      } catch {
        setSheetHeight(FALLBACK_HEIGHT);
      }
    };

    // A single measure-on-load lands short: the sheet's play images are data
    // URIs that decode after the load event, and the export footer then gets
    // clipped. Watch the body instead so the frame settles to its real height.
    const attach = () => {
      measure();
      try {
        const body = frame.contentDocument?.body;
        const view = frame.contentWindow;
        if (body && view && 'ResizeObserver' in view) {
          observer = new (view as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(measure);
          observer.observe(body);
        }
      } catch {
        // Measurement is best-effort; FALLBACK_HEIGHT already applied.
      }
    };

    frame.addEventListener('load', attach);
    // srcDoc may already have painted by the time this effect runs.
    attach();
    return () => {
      cancelled = true;
      observer?.disconnect();
      frame.removeEventListener('load', attach);
    };
  }, [html]);

  const sheetPx = sheetWidthPx(preferences?.paper_size);
  const renderWidth = Math.min(width, availableWidth ?? width);
  const scale = renderWidth / sheetPx;
  const toggle = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => setTextOnly(value)}
      aria-pressed={textOnly === value}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors tap-target ${
        textOnly === value
          ? 'bg-primary/20 text-primary'
          : 'text-chalk/60 hover:text-chalk hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div ref={hostRef} className={className}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1" role="group" aria-label="Wristband layout">
          {toggle(false, 'With diagrams')}
          {toggle(true, 'Text only')}
        </div>
        <p className="text-xs text-chalk/50">
          {usingSamples ? 'Sample plays' : 'Your plays'} · actual export output
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-chalk/15 bg-white"
        style={{ width: renderWidth, height: sheetHeight * scale, maxWidth: '100%' }}
      >
        <iframe
          ref={frameRef}
          title="Wristband export preview"
          srcDoc={html}
          // No allow-scripts: the generated sheet is static markup and must
          // stay unable to run anything.
          sandbox="allow-same-origin"
          scrolling="no"
          aria-label="Preview of the printed wristband insert sheet"
          style={{
            width: sheetPx,
            height: sheetHeight,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        />
      </div>

      <p className="mt-3 text-xs text-chalk/60">
        Prints as {textOnly ? 'a fill-in grid' : 'play diagrams'} sized for a 4.5&quot; &times; 2.2&quot;
        wristband window — cut out and slide straight in.
      </p>
    </div>
  );
}
