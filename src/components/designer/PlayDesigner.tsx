import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Save, Download, BookOpen, Home, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import type { PlayType } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { SignupToSaveModal } from './SignupToSaveModal';
import { FieldBackdrop } from './FieldBackdrop';
import { FloatingPanel } from './FloatingPanel';
import { useViewportGestures } from './useViewportGestures';
import { Canvas, EXPORT_WIDTH, EXPORT_HEIGHT } from './Canvas';
import type { CanvasHandle, DrawMode, CapStyle, LineStyle, IconShape, PlayerIcon } from './Canvas';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { getSafeErrorMessage } from '../../lib/errors';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from '../../lib/userPreferences';
import type { CustomRoster } from './rosters';
import { usePageMeta } from '../../lib/seo';
import { stashPendingPlay, takePendingPlay } from '../../lib/pendingPlay';
import { trackEvent } from '../../lib/analytics';

// Zoom steps for the canvas. Levels whose bitmap would exceed the pixel cap
// are dropped on large screens — the scene fully re-renders on every drag
// frame, so an oversized bitmap makes dragging visibly laggy.
const ZOOM_LEVELS = [1, 1.5, 2, 3];
const MAX_CANVAS_PIXELS = 6_000_000;

// Upright phones dock the tools horizontally along the bottom; everything
// wider — including a phone held sideways, which has room beside the field —
// gets the vertical panel (it scrolls when the screen is short).
const DOCK_QUERY = '(max-width: 639px)';
// Where the action buttons drop their text labels.
const COMPACT_ACTIONS_QUERY = '(max-width: 899px), (max-height: 599px)';
const MOVE_HINT_KEY = 'pbp-designer-move-hint-seen';
// Two fingers pan until their spread changes by this factor; then they zoom.
const PINCH_ENGAGE = 1.1;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function PlayDesigner() {
  usePageMeta({ title: 'Play Designer', description: 'Draw football plays on a real field — routes, formations, and zones — then save, print, or export.', path: '/designer' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });
  // The scroll container's own size. Half of it is the margin of open
  // surround on every side of the field, so the view can be moved until any
  // edge of the play reaches the middle of the screen, at every zoom level.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // Bumped by "Fit" to recentre even when the zoom is already 1.
  const [fitTick, setFitTick] = useState(0);
  // Canvas zoom: multiplies the letterboxed base size; the container scrolls
  // (drag-to-pan in Select mode) when the zoomed canvas overflows it.
  const [zoom, setZoom] = useState(1);

  const [drawingMode, setDrawingMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('straight');
  // Ending decoration + line style for the next route finished — sticky
  // until changed, independent of drawMode (shape) so e.g. a curved route
  // can end in a block T-cap and be dotted at the same time.
  const [capStyle, setCapStyle] = useState<CapStyle>('arrow');
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  // Route color for the next route finished — 'auto' matches the origin
  // icon (today's only behavior); a hex value draws every new route in that
  // fixed color instead, independent of player color. Session-only, same as
  // capStyle/lineStyle above.
  const [routeColorMode, setRouteColorMode] = useState<'auto' | string>('auto');
  const [deleteRouteMode, setDeleteRouteMode] = useState(false);
  const [recolorRouteMode, setRecolorRouteMode] = useState(false);
  const [copyRouteMode, setCopyRouteMode] = useState(false);
  // Sticky like capStyle/lineStyle/routeColorMode above — a coach's mirror
  // preference should survive turning Copy Route off and back on.
  const [copyRouteMirror, setCopyRouteMirror] = useState(false);
  const [zoneMode, setZoneMode] = useState(false);
  const [deleteZoneMode, setDeleteZoneMode] = useState(false);
  const [textMode, setTextMode] = useState(false);
  // Visio-style alignment snapping (icons/centerline/yard grid) — on by default
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null>(null);
  // Undo/redo availability, kept in sync by the Canvas via onHistoryChange —
  // the canvas's history stacks live below this component, so without this
  // callback the toolbar buttons go stale after canvas-only edits.
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });

  // Offense/Defense/Special Teams is decided once per play (toolbar swaps
  // icon roster + tools accordingly), defaulting to offense. Not reset by
  // "New" — a coach making several plays of the same side in a row
  // shouldn't have to re-pick it every time.
  const [playType, setPlayType] = useState<PlayType>('offense');

  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // Save while signed out opens this instead of the Save modal.
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  // A draft parked before sign-up was just put back on the canvas — once the
  // coach is signed in, open the Save modal so finishing the save is one click.
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  // The loaded play's current is_public, so the Save modal can prefill the
  // checkbox with reality instead of the account's generic default.
  const [loadedIsPublic, setLoadedIsPublic] = useState(false);
  // Set whenever ANY play was loaded (via ?play= to edit, or ?template= to
  // start a new one from it) — distinct from editingPlayId, which stays
  // null for a template load. Used only to tell SavePlayModal "prefill from
  // currentPlayMetadata" vs. "this is a genuinely blank new play."
  const [loadedPlayKey, setLoadedPlayKey] = useState<string | null>(null);
  const [pendingLoad, setPendingLoad] = useState<{ paths: any[]; playerIcons: any[]; zones?: any[]; textBoxes?: any[] } | null>(null);

  // Locks once the play has content — reusing history.canUndo, which is
  // already true exactly when there's committed history or an in-progress
  // action, i.e. "the canvas has content."
  const playTypeLocked = isEditingExistingPlay || history.canUndo;

  const [currentPlayMetadata, setCurrentPlayMetadata] = useState<PlayMetadata>({
    playName: 'New Play',
    gameType: '11v11',
    playType: 'pass',
    formation: '',
    difficulty: 'intermediate',
    tags: [],
    description: '',
    situation: '',
    yardage: '',
    createdBy: '',
    createdDate: new Date().toISOString(),
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Team identity / save & export defaults (B-14/B-15), passed down to the
  // save and export modals. Fetched here with the already-resolved user —
  // see userPreferences.ts for why helpers don't call getUser() themselves.
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  useEffect(() => {
    if (!user) { setPreferences(null); return; }
    let cancelled = false;
    getUserPreferences(user.id).then((p) => { if (!cancelled) setPreferences(p); });
    return () => { cancelled = true; };
  }, [user]);

  /**
   * Persist an edited toolbar roster. Applied optimistically so the chips
   * update instantly, then rolled back if the write fails — the toolbar is a
   * leaf and deliberately has no `user` of its own, since resolving auth down
   * there is what deadlocked gotrue's session lock (see userPreferences.ts).
   */
  const handleRosterChange = useCallback((next: CustomRoster) => {
    if (!user) return;
    const previous = preferences;
    setPreferences((p) => (p ? { ...p, custom_roster: next } : p));
    saveUserPreferences(user.id, { custom_roster: next }).catch((err) => {
      console.error('Could not save your player roster:', err);
      setPreferences(previous);
    });
  }, [user, preferences]);

  // Fetch an existing play when opened via /designer?play=<id> (edit in
  // place) or /designer?template=<id> (start a new play from this one —
  // "Use as Template", see PlaysPage.tsx/PlayLibrary.tsx). Both fetch the
  // same row the same way; only what happens to editingPlayId differs
  // below. The parsed scene is stashed in pendingLoad and applied to the
  // canvas by a separate effect — applying here directly is unreliable
  // because the canvas may not be mounted yet at the moment the fetch
  // resolves.
  useEffect(() => {
    const playId = searchParams.get('play');
    const templateId = searchParams.get('template');
    const sourceId = playId || templateId;
    // Template loads never set editingPlayId, so handleSavePlay's existing
    // `if (editingPlayId) UPDATE else INSERT` naturally saves this as a
    // brand-new play — no changes needed there. RLS already permits reading
    // any *public* play regardless of owner, so this works for community
    // plays too, not just the signed-in user's own.
    const isTemplate = !playId && Boolean(templateId);
    if (!sourceId) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('plays')
          .select('id, name, type, canvas_data, metadata, is_public')
          .eq('id', sourceId)
          .single();
        if (fetchError) throw fetchError;
        if (cancelled || !data) return;

        // canvas_data is JSON { version, paths, playerIcons, zones, textBoxes } (normalized coords)
        let paths: any[] = [];
        let playerIcons: any[] = [];
        let zones: any[] = [];
        let textBoxes: any[] = [];
        try {
          const parsed = JSON.parse(data.canvas_data || '{}');
          paths = Array.isArray(parsed.paths) ? parsed.paths : [];
          playerIcons = Array.isArray(parsed.playerIcons) ? parsed.playerIcons : [];
          zones = Array.isArray(parsed.zones) ? parsed.zones : [];
          textBoxes = Array.isArray(parsed.textBoxes) ? parsed.textBoxes : [];
        } catch {
          throw new Error('This play could not be opened (unrecognized format).');
        }

        const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
        const baseName = data.name || 'Untitled Play';
        setCurrentPlayMetadata((prev) => ({ ...prev, ...meta, playName: isTemplate ? `Copy of ${baseName}` : baseName }));
        setPlayType(data.type === 'defense' || data.type === 'special_teams' ? data.type : 'offense');
        // A template-derived play always starts private, regardless of the
        // source's visibility — matches PlayLibrary's instant-copy convention.
        setLoadedIsPublic(isTemplate ? false : Boolean(data.is_public));
        if (!isTemplate) {
          setEditingPlayId(data.id);
          setIsEditingExistingPlay(true);
        }
        setLoadedPlayKey(data.id);
        setPendingLoad({ paths, playerIcons, zones, textBoxes });
      } catch (err) {
        if (!cancelled) {
          console.error('Load play error:', err);
          setError(getSafeErrorMessage(err, 'Failed to load play'));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams]);

  // Back from sign-up (or sign-in) with a play parked by goToAuth below: put
  // it back. Skipped when a specific play/template was asked for, and
  // takePendingPlay() removes the draft, so it's restored at most once.
  useEffect(() => {
    if (searchParams.get('play') || searchParams.get('template')) return;
    const draft = takePendingPlay();
    if (!draft) return;
    setPlayType(draft.playType);
    if (draft.metadata) setCurrentPlayMetadata((prev) => ({ ...prev, ...draft.metadata }));
    setPendingLoad({ paths: draft.paths, playerIcons: draft.playerIcons, zones: draft.zones, textBoxes: draft.textBoxes });
    setRestoredDraft(true);
    trackEvent('draft_restored');
    // Mount-only: a later ?play= navigation must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoredDraft || !user) return;
    setRestoredDraft(false);
    setShowSaveModal(true);
  }, [restoredDraft, user]);

  // Apply a fetched play onto the canvas once it is mounted
  useEffect(() => {
    if (!pendingLoad) return;
    if (!canvasRef.current?.loadState) return;
    canvasRef.current.loadState(pendingLoad);
    setPendingLoad(null);
  }, [pendingLoad, canvasSize]);

  // Resize canvas to the largest EXPORT_WIDTH:EXPORT_HEIGHT rectangle that
  // fits the container. Locking the on-screen aspect ratio to the export's
  // keeps shapes WYSIWYG — a circular zone used to print as a squished
  // ellipse because radii are stored normalized per-axis.
  //
  // useLayoutEffect + a synchronous initial call (not requestAnimationFrame)
  // so the fitted size is measured and committed before the browser paints —
  // the sidebar/main flex layout is already resolved by the time this runs,
  // so there's nothing to "wait a frame" for. Skipping that frame means
  // visitors never see the canvas at its hardcoded 600x480 fallback size
  // before it snaps to the real one (a real, guaranteed-every-load CLS hit,
  // confirmed via the Cloudflare Web Vitals report 2026-08-25 — the flagged
  // element traced exactly to this container). ResizeObserver still handles
  // later window/orientation changes, which aren't first-paint CLS.
  useLayoutEffect(() => {
    const update = () => {
      const el = canvasContainerRef.current;
      if (!el) return;
      const maxW = Math.max(320, el.clientWidth);
      const maxH = Math.max(320, el.clientHeight);
      const ratio = EXPORT_WIDTH / EXPORT_HEIGHT;
      const w = Math.min(maxW, maxH * ratio);
      setCanvasSize({ width: w, height: w / ratio });
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Zoom levels available at the current base size (see MAX_CANVAS_PIXELS) —
  // these back the button pill's fixed steps. Pinch (below) zooms
  // continuously between 1 and the top of this range instead.
  const zoomLevels = ZOOM_LEVELS.filter(
    (z) => z === 1 || canvasSize.width * z * canvasSize.height * z <= MAX_CANVAS_PIXELS,
  );
  const zoomMax = zoomLevels[zoomLevels.length - 1] ?? 1;
  // A pinch usually leaves `zoom` between two button steps, so the pill's
  // buttons pick the nearest step past the current (continuous) value in
  // either direction rather than indexing into zoomLevels by exact match.
  const ZOOM_EPS = 0.001;
  const zoomOutTarget = [...zoomLevels].reverse().find((z) => z < zoom - ZOOM_EPS) ?? null;
  const zoomInTarget = zoomLevels.find((z) => z > zoom + ZOOM_EPS) ?? null;

  // Where to anchor the next zoom-level change: the pinch midpoint (client
  // px) if the change came from a pinch, otherwise null so the layout effect
  // below falls back to keeping the viewport's center stable (button pill).
  const pinchAnchorRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Keep either the pinch anchor or the viewport's center point stable when
  // the zoom level changes (layout effect: runs after the canvas has its new
  // size, before paint).
  const prevZoomRef = useRef(1);
  useLayoutEffect(() => {
    const el = canvasContainerRef.current;
    const prev = prevZoomRef.current;
    prevZoomRef.current = zoom;
    const anchor = pinchAnchorRef.current;
    pinchAnchorRef.current = null;
    if (!el || prev === zoom) return;
    const k = zoom / prev;
    // Only the field scales; it starts `margin` into the scroll content, so
    // scale the distance from the field's edge, not from 0 — otherwise every
    // zoom step drifts the anchored point by margin·(k−1) px.
    const rescale = (scroll: number, at: number, margin: number) => (scroll + at - margin) * k + margin - at;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    if (anchor) {
      const rect = el.getBoundingClientRect();
      el.scrollLeft = rescale(el.scrollLeft, anchor.clientX - rect.left, mx);
      el.scrollTop = rescale(el.scrollTop, anchor.clientY - rect.top, my);
    } else {
      el.scrollLeft = rescale(el.scrollLeft, el.clientWidth / 2, mx);
      el.scrollTop = rescale(el.scrollTop, el.clientHeight / 2, my);
    }
  }, [zoom]);

  // Centre the play on load, after a resize/rotation re-fits it, and on Fit.
  // Runs after the zoom effect above so a Fit from a zoomed view wins.
  useLayoutEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [canvasSize, viewport, fitTick]);

  const handleFit = useCallback(() => {
    setZoom(1);
    setFitTick((t) => t + 1);
  }, []);

  // If a resize/rotation shrinks the allowed range below the current zoom
  // (e.g. rotating a phone to landscape), clamp back into range. Only clamps
  // down past the new max — doesn't force a continuous pinch value onto one
  // of the fixed button steps.
  useEffect(() => {
    if (zoom > zoomMax) setZoom(zoomMax);
  }, [zoomMax, zoom]);

  // Two-finger pinch (B-34): Canvas reports an incremental distance ratio
  // (>1 spreading, <1 pinching in) plus the current midpoint in client px.
  // Zooming continuously (not stepped) and anchoring on the midpoint is what
  // makes the content appear to stay pinned under the fingers.
  //
  //
  // A gesture's zoom is the zoom it started at times the product of every
  // ratio since — unclamped while it runs, so the clamp only applies to what's
  // shown. Each finger reports its moves separately, so the spread wobbles
  // event to event even when both move together to pan, and a gesture always
  // ends half a wobble off. Two fingers therefore only pan until the spread
  // has really changed (PINCH_ENGAGE); a trackpad pinch / ctrl+wheel is a
  // deliberate zoom and skips that (`immediate`).
  const pinchGestureRef = useRef<{ startZoom: number; product: number; engaged: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const handlePinch = useCallback((scaleRatio: number, midClientX: number, midClientY: number, immediate = false) => {
    const g = pinchGestureRef.current ?? { startZoom: zoomRef.current, product: 1, engaged: false };
    pinchGestureRef.current = g;
    g.product *= scaleRatio;
    if (!g.engaged && !immediate && Math.abs(Math.log(g.product)) < Math.log(PINCH_ENGAGE)) return;
    g.engaged = true;
    // Computed outside setZoom's updater: React runs updaters twice in
    // development, which would apply every ratio twice.
    const next = Math.min(zoomMax, Math.max(1, g.startZoom * g.product));
    if (next === zoomRef.current) return;
    pinchAnchorRef.current = { clientX: midClientX, clientY: midClientY };
    zoomRef.current = next;
    setZoom(next);
  }, [zoomMax]);
  const handlePinchEnd = useCallback(() => { pinchGestureRef.current = null; }, []);

  // Moving the view (content follows the pointer): Select-mode drag on empty
  // field, two fingers on the canvas, and every gesture in
  // useViewportGestures. Works at 1× too — the surround margin always leaves
  // room to scroll.
  const handlePan = useCallback((dxPx: number, dyPx: number) => {
    const el = canvasContainerRef.current;
    if (!el) return;
    el.scrollLeft -= dxPx;
    el.scrollTop -= dyPx;
  }, []);

  const viewportGestures = useViewportGestures(canvasContainerRef, {
    onPan: handlePan, onPinch: handlePinch, onPinchEnd: handlePinchEnd, onFit: handleFit,
  });

  const dock = useMediaQuery(DOCK_QUERY);
  const compact = useMediaQuery(COMPACT_ACTIONS_QUERY);

  // One-time tip on touch screens: in drawing tools one finger draws, so two
  // fingers is the way to move around.
  const [showMoveHint, setShowMoveHint] = useState(false);
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (localStorage.getItem(MOVE_HINT_KEY)) return;
    } catch {
      return;
    }
    setShowMoveHint(true);
  }, []);
  const dismissMoveHint = () => {
    setShowMoveHint(false);
    try { localStorage.setItem(MOVE_HINT_KEY, '1'); } catch { /* storage blocked */ }
  };

  // Bridge for the Playwright smoke suite (tests/smoke): exposes real canvas
  // state so tests assert on data instead of sampling pixels. import.meta.env.DEV
  // is statically false in production builds, so none of this ships.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__PBP_TEST__ = {
      getCanvasState: () => ({
        paths: canvasRef.current?.getPaths?.() ?? [],
        playerIcons: canvasRef.current?.getIcons?.() ?? [],
        zones: canvasRef.current?.getZones?.() ?? [],
        textBoxes: canvasRef.current?.getTextBoxes?.() ?? [],
      }),
      // Export output, for the byte-identity guard in designer-fullscreen.spec.ts.
      exportImage: (w?: number, h?: number) => canvasRef.current?.exportImage?.(w, h) ?? '',
      loadState: (data: Parameters<CanvasHandle['loadState']>[0]) => canvasRef.current?.loadState(data),
    };
    return () => { delete (window as any).__PBP_TEST__; };
  }, []);

  const handleStampFormation = useCallback((icons: PlayerIcon[]) => {
    canvasRef.current?.stampFormation(icons);
  }, []);

  const handleSetGameType = useCallback((gameType: PlayMetadata['gameType']) => {
    setCurrentPlayMetadata((prev) => ({ ...prev, gameType }));
  }, []);

  const handleNewPlay = useCallback(() => {
    canvasRef.current?.clear();
    setCurrentPlayMetadata((p) => ({ ...p, playName: 'New Play', formation: '', tags: [], description: '', situation: '', yardage: '' }));
    setIsEditingExistingPlay(false);
    setEditingPlayId(null);
    setLoadedIsPublic(false);
  }, []);

  const handleSavePlay = useCallback(async (playData: {
    name: string;
    metadata: PlayMetadata;
    isPublic: boolean;
    playbookId?: string;
  }) => {
    try {
      setError(null);
      if (!user) {
        setError('Please sign in to save plays.');
        return;
      }

      // Play data is stored in normalized 0-1 coordinates (see Canvas.tsx).
      // Version 4 = coordinates in the 17-up/13-down (30-yard) field window
      // (2026-07-23); version ≤3 rows were remapped from the older 25-yard
      // window by scripts/migrate-field-depth-2026-07.mjs, which keys on
      // this number — bump it again if the window ever changes again.
      const canvasData = JSON.stringify({
        version: 4,
        paths: canvasRef.current?.getPaths?.() || [],
        playerIcons: canvasRef.current?.getIcons?.() || [],
        zones: canvasRef.current?.getZones?.() || [],
        textBoxes: canvasRef.current?.getTextBoxes?.() || [],
      });
      const thumbnail = canvasRef.current?.exportImage?.(660, 510) || '';

      let savedPlayId = editingPlayId;
      if (editingPlayId) {
        // Update the existing play in place
        const { error: updateError } = await supabase
          .from('plays')
          .update({
            name: playData.name,
            canvas_data: canvasData,
            description: playData.metadata.description || '',
            thumbnail,
            is_public: playData.isPublic,
            metadata: playData.metadata,
          })
          .eq('id', editingPlayId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('plays')
          .insert({
            name: playData.name,
            type: playType,
            canvas_data: canvasData,
            description: playData.metadata.description || '',
            user_id: user.id,
            thumbnail,
            is_public: playData.isPublic,
            metadata: playData.metadata,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        savedPlayId = inserted.id;
        setEditingPlayId(inserted.id);
        setIsEditingExistingPlay(true);
      }

      if (playData.playbookId) {
        const { data: maxRow } = await supabase
          .from('playbook_plays')
          .select('order_position')
          .eq('playbook_id', playData.playbookId)
          .order('order_position', { ascending: false })
          .limit(1)
          .maybeSingle();
        // ignoreDuplicates so re-saving a play already in this playbook is a no-op
        const { error: linkError } = await supabase
          .from('playbook_plays')
          .upsert(
            {
              playbook_id: playData.playbookId,
              play_id: savedPlayId,
              order_position: (maxRow?.order_position ?? 0) + 1,
            },
            { onConflict: 'playbook_id,play_id', ignoreDuplicates: true },
          );
        if (linkError) throw linkError;
      }

      setCurrentPlayMetadata((prev) => ({ ...prev, ...playData.metadata, playName: playData.name }));

      // Editing a play opened from the Plays page (?from=plays) returns the
      // coach there once the update lands, instead of leaving them staring
      // at the designer wondering if it worked. Only for updates to an
      // existing play — a fresh save (new play or "use as template") keeps
      // them in the designer, since they're mid-flow building something new.
      // No transient toast in this case: it would never be seen before the
      // navigation away.
      if (editingPlayId && searchParams.get('from') === 'plays') {
        navigate('/plays');
        return;
      }

      setSuccessMessage(
        editingPlayId
          ? 'Play updated!'
          : playData.playbookId ? 'Play saved to playbook!' : 'Play saved!',
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Save play error:', err);
      setError(getSafeErrorMessage(err, 'Failed to save play'));
    }
  }, [user, editingPlayId, playType, searchParams, navigate]);

  const handleSaveClick = () => {
    if (user) {
      setShowSaveModal(true);
      return;
    }
    setShowSignupPrompt(true);
    trackEvent('save_blocked_signed_out');
  };

  /** Park the drawing, then send the coach to /auth with a way back here. */
  const goToAuth = (mode: 'signup' | 'signin') => {
    const scene = {
      paths: canvasRef.current?.getPaths?.() ?? [],
      playerIcons: canvasRef.current?.getIcons?.() ?? [],
      zones: canvasRef.current?.getZones?.() ?? [],
      textBoxes: canvasRef.current?.getTextBoxes?.() ?? [],
    };
    const hasContent = scene.paths.length + scene.playerIcons.length + scene.zones.length + scene.textBoxes.length > 0;
    if (hasContent) stashPendingPlay({ ...scene, playType, metadata: currentPlayMetadata });
    trackEvent('save_prompt_choice', { choice: mode });
    const next = encodeURIComponent('/designer');
    navigate(mode === 'signup' ? `/auth?mode=signup&next=${next}` : `/auth?next=${next}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-board flex items-center justify-center">
      <div className="text-chalk">Loading…</div>
    </div>
  );

  // One toolbar, rendered once in the floating panel (it used to be mounted
  // twice: desktop sidebar + phone bottom bar).
  const toolbarProps: React.ComponentProps<typeof DesignerToolbar> = {
    playType,
    onSetPlayType: setPlayType,
    playTypeLocked,
    gameType: currentPlayMetadata.gameType,
    onSetGameType: handleSetGameType,
    onStampFormation: handleStampFormation,
    getCurrentIcons: () => canvasRef.current?.getIcons() ?? [],
    drawingMode,
    setDrawingMode,
    drawMode,
    setDrawMode,
    capStyle,
    setCapStyle,
    lineStyle,
    setLineStyle,
    routeColorMode,
    setRouteColorMode,
    deleteRouteMode,
    setDeleteRouteMode,
    recolorRouteMode,
    setRecolorRouteMode,
    copyRouteMode,
    setCopyRouteMode,
    copyRouteMirror,
    setCopyRouteMirror,
    zoneMode,
    setZoneMode,
    deleteZoneMode,
    setDeleteZoneMode,
    textMode,
    setTextMode,
    snapEnabled,
    setSnapEnabled,
    selectedPlayer: selectedPlayer?.letter || null,
    onSelectPlayer: setSelectedPlayer,
    customRoster: preferences?.custom_roster ?? null,
    onRosterChange: user ? handleRosterChange : undefined,
    onUndo: () => canvasRef.current?.undo(),
    onRedo: () => canvasRef.current?.redo(),
    onClear: () => canvasRef.current?.clear(),
    onClearRoutes: () => canvasRef.current?.clearRoutes(),
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };

  const zoomPill = (
    <>
      <button
        title="Zoom out"
        disabled={zoomOutTarget === null}
        onClick={() => zoomOutTarget !== null && setZoom(zoomOutTarget)}
        className="tap-target flex items-center justify-center p-1.5 rounded-full text-chalk/70 hover:text-chalk hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        title="Fit play to screen"
        onClick={handleFit}
        className="tap-target flex items-center justify-center gap-1 min-w-[44px] px-1 text-center text-[11px] font-medium text-chalk/80 hover:text-chalk transition-colors"
      >
        <Maximize className="h-3.5 w-3.5" />
        {Math.round(zoom * 100)}%
      </button>
      <button
        title="Zoom in"
        disabled={zoomInTarget === null}
        onClick={() => zoomInTarget !== null && setZoom(zoomInTarget)}
        className="tap-target flex items-center justify-center p-1.5 rounded-full text-chalk/70 hover:text-chalk hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </>
  );

  const actionBtn = 'tap-target flex items-center justify-center gap-1 px-2.5 py-1.5 text-sm text-chalk rounded-lg hover:bg-white/10 transition-colors';

  return (
    // z-50: must outrank Navbar's sticky z-40 so this still fully covers it — see
    // the z-index note in Navbar.tsx.
    //
    // Full screen: the field fills the viewport and the tools float over it.
    // The play window (aspect-locked to the print sheet) sits in a scroll
    // "world" with half a viewport of surround on every side, so the view can
    // be moved around like a map at any zoom; FieldBackdrop draws the rest of
    // the field behind it, so nothing reads as a box.
    <div className="fixed inset-0 z-50 bg-board overflow-hidden">
      <FieldBackdrop scrollRef={canvasContainerRef} sizeKey={`${canvasSize.width}x${canvasSize.height}@${zoom}`} />

      <main
        ref={canvasContainerRef}
        {...viewportGestures.handlers}
        className="absolute inset-0 overflow-auto touch-none"
        style={{
          scrollbarWidth: 'none',
          cursor: viewportGestures.panning ? 'grabbing' : viewportGestures.spaceHeld ? 'grab' : undefined,
        }}
      >
        <div
          className="relative"
          style={{
            width: canvasSize.width * zoom + viewport.width,
            height: canvasSize.height * zoom + viewport.height,
          }}
        >
          <div className="absolute" style={{ left: viewport.width / 2, top: viewport.height / 2 }}>
              <Canvas
                ref={canvasRef}
                id="play-canvas"
                width={canvasSize.width * zoom}
                height={canvasSize.height * zoom}
                drawingMode={drawingMode}
                drawMode={drawMode}
                capStyle={capStyle}
                lineStyle={lineStyle}
                routeColorMode={routeColorMode}
                deleteRouteMode={deleteRouteMode}
                recolorRouteMode={recolorRouteMode}
                copyRouteMode={copyRouteMode}
                copyRouteMirror={copyRouteMirror}
                zoneMode={zoneMode}
                deleteZoneMode={deleteZoneMode}
                textMode={textMode}
                snapEnabled={snapEnabled}
                selectedPlayer={selectedPlayer}
                setSelectedPlayer={setSelectedPlayer}
                onDrawingComplete={() => {}}
                onHistoryChange={setHistory}
                onPan={handlePan}
                onPinch={handlePinch}
              onPinchEnd={handlePinchEnd}
              />
          </div>
        </div>
      </main>

      {/* ── FLOATING ACTIONS ───────────────────────────────────── */}
      <FloatingPanel storageKey="pbp-designer-actions" anchor="top-right" label="Play actions" layout="row">
        <button onClick={() => navigate('/')} className={actionBtn} title="Back to Home">
          <Home className="h-5 w-5 text-chalk/70" />
        </button>
        {!compact && (
          <>
            <button onClick={handleNewPlay} className={actionBtn} title="New play">New</button>
            <button onClick={() => navigate('/playbooks')} className={actionBtn} title="Playbooks">
              <BookOpen className="h-4 w-4" />
              Playbooks
            </button>
          </>
        )}
        {dock && <div className="flex items-center">{zoomPill}</div>}
        <button
          onClick={handleSaveClick}
          title="Save play"
          className="tap-target flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
        >
          <Save className="h-4 w-4" />
          {!compact && <span>{isEditingExistingPlay ? 'Update' : 'Save'}</span>}
        </button>
        <button onClick={() => setShowExportModal(true)} className={actionBtn} title="Export">
          <Download className="h-4 w-4" />
          {!compact && <span>Export</span>}
        </button>
      </FloatingPanel>

      {/* ── FLOATING TOOLS ─────────────────────────────────────── */}
      {/* A vertical panel where there's room; a horizontal dock on upright
          phones. Each layout remembers its own spot. */}
      <FloatingPanel
        storageKey={dock ? 'pbp-designer-tools-dock' : 'pbp-designer-tools-panel'}
        anchor={dock ? 'bottom-center' : 'top-left'}
        label="Tools"
        layout="column"
        collapsible
        className={dock ? 'w-[calc(100vw-20px)]' : 'w-52 max-h-[calc(100dvh-20px)]'}
      >
        <div className={dock ? 'px-3 pt-1.5 pb-2' : 'px-2.5 pt-2 pb-3 overflow-y-auto min-h-0'}>
          <DesignerToolbar {...toolbarProps} orientation={dock ? undefined : 'vertical'} />
        </div>
      </FloatingPanel>

      {/* ── ZOOM (bottom-right; when the tools dock along the bottom it lives
          in the actions instead) ── */}
      {!dock && (
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 rounded-full bg-board-light/95 border border-chalk/15 shadow-lg px-1 py-1">
          {zoomPill}
        </div>
      )}

      {showMoveHint && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 w-max max-w-[calc(100vw-24px)] flex items-center gap-3 rounded-full bg-board-light/95 border border-chalk/15 shadow-lg pl-4 pr-2 py-1.5 text-xs text-chalk/90">
          <span>Two fingers to move around · pinch to zoom</span>
          <button onClick={dismissMoveHint} className="tap-target px-2 text-chalk/60 hover:text-chalk" title="Dismiss tip">
            Got it
          </button>
        </div>
      )}

      {/* ── MODALS ─────────────────────────────────────────────── */}
      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          canvasRef={canvasRef}
          playMetadata={currentPlayMetadata}
          onUpdateMetadata={setCurrentPlayMetadata}
          userHasAccount={!!user}
          preferences={preferences}
        />
      )}
      {showSignupPrompt && (
        <SignupToSaveModal
          onSignUp={() => goToAuth('signup')}
          onSignIn={() => goToAuth('signin')}
          onCancel={() => setShowSignupPrompt(false)}
        />
      )}
      <SavePlayModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePlay}
        user={user}
        previewThumbnail={canvasRef.current?.exportImage?.(660, 510) || ''}
        preferences={preferences}
        isEditingExistingPlay={isEditingExistingPlay}
        prefillKey={loadedPlayKey}
        existingPlay={loadedPlayKey ? {
          name: currentPlayMetadata.playName,
          metadata: currentPlayMetadata,
          isPublic: loadedIsPublic,
        } : undefined}
      />

      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">dismiss</button>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg">
          ✓ {successMessage}
        </div>
      )}
    </div>
  );
}
