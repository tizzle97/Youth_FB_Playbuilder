import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, Layout, BookOpen, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { Canvas } from './Canvas';
import type { DrawMode } from './Canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';

export function PlayDesigner() {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });

  const [drawingMode, setDrawingMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('straight');
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);

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

  const handleNewPlay = useCallback(() => {
    canvasRef.current?.clear();
    setCurrentPlayMetadata((p) => ({ ...p, playName: 'New Play', formation: '', tags: [], description: '', situation: '', yardage: '' }));
    setIsEditingExistingPlay(false);
  }, []);

  const handleExportToPDF = useCallback(async (_format: 'single' | 'multiple' | 'wristband') => {
    try {
      const sourceCanvas = canvasRef.current?.getCanvas();
      if (!sourceCanvas) return;
      const pdf = new jsPDF({ orientation: sourceCanvas.width > sourceCanvas.height ? 'landscape' : 'portrait', unit: 'mm' });
      const imgData = sourceCanvas.toDataURL('image/png');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (sourceCanvas.height * pw) / sourceCanvas.width;
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
        {/* Back (mobile) */}
        <button
          onClick={() => navigate(-1)}
          className="sm:hidden p-2 text-chalk/60 hover:text-chalk rounded-lg hover:bg-white/10"
          title="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5 mr-auto min-w-0">
          <Layout className="h-5 w-5 text-primary shrink-0" />
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
          selectedPlayer={selectedPlayer?.letter || null}
          onSelectPlayer={setSelectedPlayer}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()}
          onClearRoutes={() => canvasRef.current?.clearRoutes()}
          canUndo={canvasRef.current?.canUndo?.() ?? false}
          canRedo={canvasRef.current?.canRedo?.() ?? false}
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
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          onDrawingComplete={() => {}}
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
          selectedPlayer={selectedPlayer?.letter || null}
          onSelectPlayer={setSelectedPlayer}
          onUndo={() => canvasRef.current?.undo()}
          onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()}
          onClearRoutes={() => canvasRef.current?.clearRoutes()}
          canUndo={canvasRef.current?.canUndo?.() ?? false}
          canRedo={canvasRef.current?.canRedo?.() ?? false}
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
        onSave={async (playData) => {
          console.log('Saving play:', playData);
          setShowSaveModal(false);
        }}
        user={user}
        previewThumbnail={canvasRef.current?.getCanvas()?.toDataURL() || ''}
      />

      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">dismiss</button>
        </div>
      )}
    </div>
  );
}
