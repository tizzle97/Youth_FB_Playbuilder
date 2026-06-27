import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, BookOpen, Home } from 'lucide-react';
import { Logo } from '../Logo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { Canvas } from './Canvas';
import type { DrawMode } from './Canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { getSafeErrorMessage } from '../../lib/errors';

export function PlayDesigner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });

  const [drawingMode, setDrawingMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('straight');
  const [deleteRouteMode, setDeleteRouteMode] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean } | null>(null);
  // Undo/redo availability, kept in sync by the Canvas via onHistoryChange so
  // the toolbar buttons stay accurate after canvas-only edits (drawing routes,
  // deleting routes, dragging icons) that don't otherwise re-render this page.
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [pendingLoad, setPendingLoad] = useState<{ paths: any[]; playerIcons: any[] } | null>(null);

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

        // canvas_data is JSON { version, paths, playerIcons } (normalized coords)
        let paths: any[] = [];
        let playerIcons: any[] = [];
        try {
          const parsed = JSON.parse(data.canvas_data || '{}');
          paths = Array.isArray(parsed.paths) ? parsed.paths : [];
          playerIcons = Array.isArray(parsed.playerIcons) ? parsed.playerIcons : [];
        } catch {
          throw new Error('This play could not be opened (unrecognized format).');
        }

        const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
        setCurrentPlayMetadata((prev) => ({ ...prev, ...meta, playName: data.name || 'Untitled Play' }));
        setEditingPlayId(data.id);
        setIsEditingExistingPlay(true);
        setPendingLoad({ paths, playerIcons });
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

  // Keyboard undo/redo. Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo.
  // Ignored while typing in a field so it doesn't fight text editing in modals.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        canvasRef.current?.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        canvasRef.current?.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
        version: 2,
        paths: canvasRef.current?.getPaths?.() || [],
        playerIcons: canvasRef.current?.getIcons?.() || [],
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
            type: 'offense',
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
  }, [user, editingPlayId]);

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
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          deleteRouteMode={deleteRouteMode}
          setDeleteRouteMode={setDeleteRouteMode}
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
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          deleteRouteMode={deleteRouteMode}
          setDeleteRouteMode={setDeleteRouteMode}
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
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportToPDF}
        canvasRef={canvasRef}
        playMetadata={currentPlayMetadata}
        onUpdateMetadata={setCurrentPlayMetadata}
        userHasAccount={!!user}
      />
      <SavePlayModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePlay}
        user={user}
        previewThumbnail={canvasRef.current?.exportImage?.(660, 510) || ''}
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
