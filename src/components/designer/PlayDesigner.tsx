import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Save, Download, BookOpen, Home, ZoomIn, ZoomOut } from 'lucide-react';
import { Logo } from '../Logo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import type { PlayType } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { Canvas, EXPORT_WIDTH, EXPORT_HEIGHT } from './Canvas';
import type { CanvasHandle, DrawMode, CapStyle, IconShape, PlayerIcon } from './Canvas';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { getSafeErrorMessage } from '../../lib/errors';
import { getUserPreferences, saveUserPreferences, type UserPreferences } from '../../lib/userPreferences';
import type { CustomRoster } from './rosters';
import { usePageMeta } from '../../lib/seo';

// Zoom steps for the canvas. Levels whose bitmap would exceed the pixel cap
// are dropped on large screens — the scene fully re-renders on every drag
// frame, so an oversized bitmap makes dragging visibly laggy.
const ZOOM_LEVELS = [1, 1.5, 2, 3];
const MAX_CANVAS_PIXELS = 6_000_000;

export function PlayDesigner() {
  usePageMeta({ title: 'Play Designer', description: 'Draw football plays on a real field — routes, formations, and zones — then save, print, or export.', path: '/designer' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });
  // Canvas zoom: multiplies the letterboxed base size; the container scrolls
  // (drag-to-pan in Select mode) when the zoomed canvas overflows it.
  const [zoom, setZoom] = useState(1);

  const [drawingMode, setDrawingMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('straight');
  // Ending decoration + line style for the next route finished — sticky
  // until changed, independent of drawMode (shape) so e.g. a curved route
  // can end in a block T-cap and be dashed at the same time.
  const [capStyle, setCapStyle] = useState<CapStyle>('arrow');
  const [dashed, setDashed] = useState(false);
  // Route color for the next route finished — 'auto' matches the origin
  // icon (today's only behavior); a hex value draws every new route in that
  // fixed color instead, independent of player color. Session-only, same as
  // capStyle/dashed above.
  const [routeColorMode, setRouteColorMode] = useState<'auto' | string>('auto');
  const [deleteRouteMode, setDeleteRouteMode] = useState(false);
  const [recolorRouteMode, setRecolorRouteMode] = useState(false);
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
          .select('*')
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
  useEffect(() => {
    const update = () => {
      const el = canvasContainerRef.current;
      if (!el) return;
      const maxW = Math.max(320, el.clientWidth);
      const maxH = Math.max(320, el.clientHeight);
      const ratio = EXPORT_WIDTH / EXPORT_HEIGHT;
      const w = Math.min(maxW, maxH * ratio);
      setCanvasSize({ width: w, height: w / ratio });
    };
    const frame = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
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
    if (anchor) {
      const rect = el.getBoundingClientRect();
      const viewportX = anchor.clientX - rect.left;
      const viewportY = anchor.clientY - rect.top;
      el.scrollLeft = (el.scrollLeft + viewportX) * k - viewportX;
      el.scrollTop = (el.scrollTop + viewportY) * k - viewportY;
    } else {
      el.scrollLeft = (el.scrollLeft + el.clientWidth / 2) * k - el.clientWidth / 2;
      el.scrollTop = (el.scrollTop + el.clientHeight / 2) * k - el.clientHeight / 2;
    }
  }, [zoom]);

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
  const handlePinch = useCallback((scaleRatio: number, midClientX: number, midClientY: number) => {
    setZoom((z) => {
      const next = Math.min(zoomMax, Math.max(1, z * scaleRatio));
      if (next !== z) pinchAnchorRef.current = { clientX: midClientX, clientY: midClientY };
      return next;
    });
  }, [zoomMax]);

  // Select-mode drag on empty field pans the scroll container (content
  // follows the pointer). No-op at 1x — nothing overflows.
  const handlePan = useCallback((dxPx: number, dyPx: number) => {
    const el = canvasContainerRef.current;
    if (!el) return;
    el.scrollLeft -= dxPx;
    el.scrollTop -= dyPx;
  }, []);

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
  }, [user, editingPlayId, playType]);

  const handleExportToPDF = useCallback(async (_format: 'single' | 'multiple' | 'wristband') => {
    try {
      // Fixed-resolution render (1650x1275) so every play prints identically
      // regardless of the screen it was designed on
      const imgData = canvasRef.current?.exportImage?.();
      if (!imgData) return;
      // Loaded on demand — jsPDF only matters at export time, not for every
      // visit to the designer.
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (1275 * pw) / 1650;
      pdf.addImage(imgData, 'PNG', 0, 0, pw, ph);
      pdf.save(`${currentPlayMetadata.playName || 'play'}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      setError('Failed to export PDF.');
    }
  }, [currentPlayMetadata.playName]);

  if (loading) return (
    <div className="min-h-screen bg-board flex items-center justify-center">
      <div className="text-chalk">Loading…</div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-board overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-board-light border-b border-chalk/10 px-3 py-2 flex items-center gap-2 z-30">
        {/* Home */}
        <button
          onClick={() => navigate('/')}
          className="p-2 text-chalk/60 hover:text-chalk rounded-lg hover:bg-white/10"
          title="Back to Home"
        >
          <Home className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5 mr-auto min-w-0">
          <Logo className="h-6 w-6 text-chalk shrink-0" />
          <span className="font-bold text-chalk text-sm sm:text-base truncate">
            Play Designer
            {isEditingExistingPlay && <span className="font-normal text-chalk/50 ml-1 text-xs hidden sm:inline">(editing)</span>}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={handleNewPlay}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm bg-board border border-chalk/20 text-chalk rounded-lg hover:bg-board-light transition-colors"
          >
            New
          </button>
          <button
            onClick={() => navigate('/playbooks')}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm bg-board border border-chalk/20 text-chalk rounded-lg hover:bg-board-light transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Playbooks
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!user}
            title={user ? 'Save play' : 'Sign in to save'}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isEditingExistingPlay ? 'Update' : 'Save'}</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-board border border-chalk/20 text-chalk rounded-lg hover:bg-board-light transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* ── SIDEBAR + CANVAS ───────────────────────────────────── */}
      {/* Desktop: toolbar in a left sidebar so the full viewport height goes
          to the aspect-locked canvas | Mobile: bottom bar (below) */}
      <div className="relative flex-1 flex min-h-0">
        <aside className="hidden sm:block w-52 shrink-0 bg-board-light border-r border-chalk/10 px-2.5 py-3 z-20 overflow-y-auto">
          <DesignerToolbar
            orientation="vertical"
            playType={playType}
            onSetPlayType={setPlayType}
            playTypeLocked={playTypeLocked}
            gameType={currentPlayMetadata.gameType}
            onSetGameType={handleSetGameType}
            onStampFormation={handleStampFormation}
            getCurrentIcons={() => canvasRef.current?.getIcons() ?? []}
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
            drawMode={drawMode}
            setDrawMode={setDrawMode}
            capStyle={capStyle}
            setCapStyle={setCapStyle}
            dashed={dashed}
            setDashed={setDashed}
            routeColorMode={routeColorMode}
            setRouteColorMode={setRouteColorMode}
            deleteRouteMode={deleteRouteMode}
            setDeleteRouteMode={setDeleteRouteMode}
            recolorRouteMode={recolorRouteMode}
            setRecolorRouteMode={setRecolorRouteMode}
            zoneMode={zoneMode}
            setZoneMode={setZoneMode}
            deleteZoneMode={deleteZoneMode}
            setDeleteZoneMode={setDeleteZoneMode}
            textMode={textMode}
            setTextMode={setTextMode}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
            selectedPlayer={selectedPlayer?.letter || null}
            onSelectPlayer={setSelectedPlayer}
            customRoster={preferences?.custom_roster ?? null}
            onRosterChange={user ? handleRosterChange : undefined}
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
            onClear={() => canvasRef.current?.clear()}
            onClearRoutes={() => canvasRef.current?.clearRoutes()}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </aside>

        {/* Scroll container: m-auto centers the canvas while it fits; once
            zoomed past the container it overflows and drag-to-pan scrolls. */}
        <main
          ref={canvasContainerRef}
          className="flex-1 bg-white overflow-auto flex"
          style={{ minHeight: 0 }}
        >
          <div className="m-auto">
            <Canvas
              ref={canvasRef}
              id="play-canvas"
              width={canvasSize.width * zoom}
              height={canvasSize.height * zoom}
              drawingMode={drawingMode}
              drawMode={drawMode}
              capStyle={capStyle}
              dashed={dashed}
              routeColorMode={routeColorMode}
              deleteRouteMode={deleteRouteMode}
              recolorRouteMode={recolorRouteMode}
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
            />
          </div>
        </main>

        {/* ── ZOOM CONTROLS ─────────────────────────────────────── */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 rounded-full bg-board-light/95 border border-chalk/15 shadow-lg px-1 py-1">
          <button
            title="Zoom out"
            disabled={zoomOutTarget === null}
            onClick={() => zoomOutTarget !== null && setZoom(zoomOutTarget)}
            className="p-1.5 rounded-full text-chalk/70 hover:text-chalk hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            title="Reset zoom"
            onClick={() => setZoom(1)}
            className="min-w-[44px] text-center text-[11px] font-medium text-chalk/80 hover:text-chalk transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            title="Zoom in"
            disabled={zoomInTarget === null}
            onClick={() => zoomInTarget !== null && setZoom(zoomInTarget)}
            className="p-1.5 rounded-full text-chalk/70 hover:text-chalk hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── MOBILE BOTTOM TOOLBAR ──────────────────────────────── */}
      <div className="
        sm:hidden shrink-0 bg-board-light border-t border-chalk/10 px-3 py-2 z-20
        pb-[env(safe-area-inset-bottom,8px)]
      ">
        <DesignerToolbar
          playType={playType}
          onSetPlayType={setPlayType}
          playTypeLocked={playTypeLocked}
          gameType={currentPlayMetadata.gameType}
          onSetGameType={handleSetGameType}
          onStampFormation={handleStampFormation}
          getCurrentIcons={() => canvasRef.current?.getIcons() ?? []}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          capStyle={capStyle}
          setCapStyle={setCapStyle}
          dashed={dashed}
          setDashed={setDashed}
          routeColorMode={routeColorMode}
          setRouteColorMode={setRouteColorMode}
          deleteRouteMode={deleteRouteMode}
          setDeleteRouteMode={setDeleteRouteMode}
          recolorRouteMode={recolorRouteMode}
          setRecolorRouteMode={setRecolorRouteMode}
          zoneMode={zoneMode}
          setZoneMode={setZoneMode}
          deleteZoneMode={deleteZoneMode}
          setDeleteZoneMode={setDeleteZoneMode}
          textMode={textMode}
          setTextMode={setTextMode}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          selectedPlayer={selectedPlayer?.letter || null}
          onSelectPlayer={setSelectedPlayer}
          customRoster={preferences?.custom_roster ?? null}
          onRosterChange={user ? handleRosterChange : undefined}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()}
          onClearRoutes={() => canvasRef.current?.clearRoutes()}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />
      </div>

      {/* ── MODALS ─────────────────────────────────────────────── */}
      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportToPDF}
          canvasRef={canvasRef}
          playMetadata={currentPlayMetadata}
          onUpdateMetadata={setCurrentPlayMetadata}
          userHasAccount={!!user}
          preferences={preferences}
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
