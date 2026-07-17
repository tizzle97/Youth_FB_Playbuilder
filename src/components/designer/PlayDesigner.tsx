import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, BookOpen, Home } from 'lucide-react';
import { Logo } from '../Logo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import type { PlayType } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { Canvas } from './Canvas';
import type { DrawMode, IconShape } from './Canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { getSafeErrorMessage } from '../../lib/errors';
import { getUserPreferences, type UserPreferences } from '../../lib/userPreferences';
import { usePageMeta } from '../../lib/seo';

export function PlayDesigner() {
  usePageMeta({ title: 'Play Designer', description: 'Draw football plays on a real field — routes, formations, and zones — then save, print, or export.', path: '/designer' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });

  const [drawingMode, setDrawingMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('straight');
  const [deleteRouteMode, setDeleteRouteMode] = useState(false);
  const [zoneMode, setZoneMode] = useState(false);
  const [deleteZoneMode, setDeleteZoneMode] = useState(false);
  // Visio-style alignment snapping (icons/centerline/yard grid) — on by default
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null>(null);
  // Undo/redo availability, kept in sync by the Canvas via onHistoryChange —
  // the canvas's history stacks live below this component, so without this
  // callback the toolbar buttons go stale after canvas-only edits.
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });

  // Offense/Defense is decided once per play (toolbar swaps icon roster +
  // tools accordingly), defaulting to offense. Not reset by "New" — a coach
  // making several defensive plays in a row shouldn't have to re-pick it
  // every time.
  const [playType, setPlayType] = useState<PlayType>('offense');

  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [pendingLoad, setPendingLoad] = useState<{ paths: any[]; playerIcons: any[]; zones?: any[] } | null>(null);

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

  // Fetch an existing play when opened via /designer?play=<id>.
  // The parsed scene is stashed in pendingLoad and applied to the canvas by a
  // separate effect — applying here directly is unreliable because the canvas
  // may not be mounted yet at the moment the fetch resolves.
  useEffect(() => {
    const playId = searchParams.get('play');
    if (!playId) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('plays')
          .select('*')
          .eq('id', playId)
          .single();
        if (fetchError) throw fetchError;
        if (cancelled || !data) return;

        // canvas_data is JSON { version, paths, playerIcons, zones } (normalized coords)
        let paths: any[] = [];
        let playerIcons: any[] = [];
        let zones: any[] = [];
        try {
          const parsed = JSON.parse(data.canvas_data || '{}');
          paths = Array.isArray(parsed.paths) ? parsed.paths : [];
          playerIcons = Array.isArray(parsed.playerIcons) ? parsed.playerIcons : [];
          zones = Array.isArray(parsed.zones) ? parsed.zones : [];
        } catch {
          throw new Error('This play could not be opened (unrecognized format).');
        }

        const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
        setCurrentPlayMetadata((prev) => ({ ...prev, ...meta, playName: data.name || 'Untitled Play' }));
        setPlayType(data.type === 'defense' ? 'defense' : 'offense');
        setEditingPlayId(data.id);
        setIsEditingExistingPlay(true);
        setPendingLoad({ paths, playerIcons, zones });
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

  // Resize canvas to fill container
  useEffect(() => {
    const update = () => {
      const el = canvasContainerRef.current;
      if (!el) return;
      const w = Math.max(320, el.clientWidth);
      const h = Math.max(320, el.clientHeight);
      setCanvasSize({ width: w, height: h });
    };
    const frame = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
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
      }),
    };
    return () => { delete (window as any).__PBP_TEST__; };
  }, []);

  const handleNewPlay = useCallback(() => {
    canvasRef.current?.clear();
    setCurrentPlayMetadata((p) => ({ ...p, playName: 'New Play', formation: '', tags: [], description: '', situation: '', yardage: '' }));
    setIsEditingExistingPlay(false);
    setEditingPlayId(null);
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

      // Play data is stored in normalized 0-1 coordinates (see Canvas.tsx)
      const canvasData = JSON.stringify({
        version: 3,
        paths: canvasRef.current?.getPaths?.() || [],
        playerIcons: canvasRef.current?.getIcons?.() || [],
        zones: canvasRef.current?.getZones?.() || [],
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

      {/* ── TOOLBAR ────────────────────────────────────────────── */}
      {/* Desktop: top bar below header | Mobile: bottom bar */}
      <div className="
        shrink-0 bg-board-light border-chalk/10 px-3 py-2 z-20
        hidden sm:block border-b
      ">
        <DesignerToolbar
          playType={playType}
          onSetPlayType={setPlayType}
          playTypeLocked={playTypeLocked}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          deleteRouteMode={deleteRouteMode}
          setDeleteRouteMode={setDeleteRouteMode}
          zoneMode={zoneMode}
          setZoneMode={setZoneMode}
          deleteZoneMode={deleteZoneMode}
          setDeleteZoneMode={setDeleteZoneMode}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          selectedPlayer={selectedPlayer?.letter || null}
          onSelectPlayer={setSelectedPlayer}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()}
          onClearRoutes={() => canvasRef.current?.clearRoutes()}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />
      </div>

      {/* ── CANVAS ─────────────────────────────────────────────── */}
      <main
        ref={canvasContainerRef}
        className="flex-1 bg-white overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <Canvas
          ref={canvasRef}
          id="play-canvas"
          width={canvasSize.width}
          height={canvasSize.height}
          drawingMode={drawingMode}
          drawMode={drawMode}
          deleteRouteMode={deleteRouteMode}
          zoneMode={zoneMode}
          deleteZoneMode={deleteZoneMode}
          snapEnabled={snapEnabled}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onDrawingComplete={() => {}}
          onHistoryChange={setHistory}
        />
      </main>

      {/* ── MOBILE BOTTOM TOOLBAR ──────────────────────────────── */}
      <div className="
        sm:hidden shrink-0 bg-board-light border-t border-chalk/10 px-3 py-2 z-20
        pb-[env(safe-area-inset-bottom,8px)]
      ">
        <DesignerToolbar
          playType={playType}
          onSetPlayType={setPlayType}
          playTypeLocked={playTypeLocked}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          deleteRouteMode={deleteRouteMode}
          setDeleteRouteMode={setDeleteRouteMode}
          zoneMode={zoneMode}
          setZoneMode={setZoneMode}
          deleteZoneMode={deleteZoneMode}
          setDeleteZoneMode={setDeleteZoneMode}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          selectedPlayer={selectedPlayer?.letter || null}
          onSelectPlayer={setSelectedPlayer}
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
