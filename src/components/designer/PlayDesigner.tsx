import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, Layout, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { SavePlayModal } from './SavePlayModal';
import { Canvas } from './Canvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { BookOpen } from 'lucide-react';

interface PlayData {
  metadata: PlayMetadata;
  canvasDataURL: string;
}

export function PlayDesigner() {
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight - 10 });
  const [drawingMode, setDrawingMode] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      const container = canvasContainerRef.current;
      const width = container?.clientWidth || window.innerWidth;
      const height = container?.clientHeight || Math.max(window.innerHeight - 10 - 160, Math.floor((container?.clientWidth || window.innerWidth) * 0.75));
      // Ensure sane minimums so the canvas can't become 0px tall or overly small
      const finalWidth = Math.max(600, Math.floor(width));
      const finalHeight = Math.max(360, Math.floor(height));
      setCanvasSize({ width: finalWidth, height: finalHeight });
    };
    // run on next frame so layout settles
    requestAnimationFrame(updateSize);
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [user, setUser] = useState(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);
  const navigate = useNavigate();

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

  // Handler functions
  const handleSave = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleNewPlay = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clear();
      setCurrentPlayMetadata(prev => ({
        ...prev,
        playName: 'New Play',
        playType: 'pass',
        formation: '',
        tags: [],
        description: '',
        situation: '',
        yardage: ''
      }));
      setIsEditingExistingPlay(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (canvasRef.current?.undo) {
      canvasRef.current.undo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (canvasRef.current?.redo) {
      canvasRef.current.redo();
    }
  }, []);

  const handleClearRoutes = useCallback(() => {
    if (canvasRef.current?.clearRoutes) {
      canvasRef.current.clearRoutes();
    }
  }, []);

  const handleExportToPDF = useCallback(async (format: 'single' | 'multiple' | 'wristband') => {
    try {
      if (!canvasRef.current) return;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      
      // Set canvas size
      canvas.width = canvasRef.current.width;
      canvas.height = canvasRef.current.height;
      
      // Draw white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the canvas content
      context.drawImage(canvasRef.current, 0, 0);
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('play-design.pdf');
      
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      setError('Failed to export play to PDF. Please try again.');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <div className="text-chalk">Loading play...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-board-light border-b border-chalk/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-chalk flex items-center gap-2">
            <Layout className="h-6 w-6 text-primary" />
            Play Designer
            {isEditingExistingPlay && (
              <span className="text-sm font-normal text-chalk/70 ml-2">
                (Editing existing play)
              </span>
            )}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleNewPlay}
              className="flex items-center gap-2 px-4 py-2 bg-board hover:bg-board-light text-chalk border border-chalk/20 rounded-lg transition-colors"
            >
              New Play
            </button>
            <button
              onClick={() => navigate('/playbooks')}
              className="flex items-center gap-2 px-4 py-2 bg-board hover:bg-board-light text-chalk border border-chalk/20 rounded-lg transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              My Playbooks
            </button>
            <button
              onClick={handleSave}
              disabled={!user}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isEditingExistingPlay ? 'Update Play' : 'Save Play'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-board hover:bg-board-light text-chalk border border-chalk/20 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Floating Toolbar */}
      <div className="fixed top-20 left-0 right-0 z-20 bg-white/90 backdrop-blur-sm p-4 shadow-md">
        <div className="max-w-7xl mx-auto">
          <DesignerToolbar
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
            selectedPlayer={selectedPlayer?.letter || null}
            onSelectPlayer={setSelectedPlayer}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onClearRoutes={handleClearRoutes}
            canUndo={canvasRef.current?.canUndo?.()}
            canRedo={canvasRef.current?.canRedo?.()}
          />
        </div>
      </div>

      {/* Main Canvas Area */}
      <main className="flex-1 pt-40 overflow-hidden">
        <div
          ref={canvasContainerRef}
          className="w-full bg-white"
          style={{ width: '100%', height: `calc(100vh - 160px)`, minHeight: 360 }}
        >
          <Canvas
            ref={canvasRef}
            id="play-canvas"
            width={canvasSize.width}
            height={canvasSize.height}
            drawingMode={drawingMode}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            onDrawingComplete={(path) => console.log("Path drawn:", path)}
          />
        </div>
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-board-light border-t border-chalk/10 p-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-sm text-chalk/70">
            {user ? 'Save your plays and share with the community.' : 'Sign in to save your plays.'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-board hover:bg-board-light text-chalk/70 hover:text-chalk rounded-md transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
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
          try {
            // Implementation for saving play
            console.log('Saving play:', playData);
            setShowSaveModal(false);
          } catch (err) {
            console.error('Error saving play:', err);
            setError('Failed to save play. Please try again.');
          }
        }}
        user={user}
        previewThumbnail={canvasRef.current?.getCanvas()?.toDataURL() || ''}
      />
    </div>
  );
}
