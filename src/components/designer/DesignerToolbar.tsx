import React from 'react';
import { MousePointer, Pencil, Undo, Redo, Eraser, Minus, GitBranch } from 'lucide-react';
import { PlayerToolbar } from './PlayerToolbar';
import type { DrawMode } from './Canvas';

interface DesignerToolbarProps {
  drawingMode: boolean;
  setDrawingMode: (mode: boolean) => void;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  selectedPlayer: string | null;
  onSelectPlayer: (player: { letter: string; color: string; isSquare?: boolean } | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClearRoutes: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function DesignerToolbar({
  drawingMode,
  setDrawingMode,
  drawMode,
  setDrawMode,
  selectedPlayer,
  onSelectPlayer,
  onUndo,
  onRedo,
  onClear,
  onClearRoutes,
  canUndo,
  canRedo,
}: DesignerToolbarProps) {
  const activeDraw = drawingMode ? drawMode : null;

  const selectMode = () => { setDrawingMode(false); onSelectPlayer(null); };

  const pickDraw = (mode: DrawMode) => {
    setDrawingMode(true);
    setDrawMode(mode);
    onSelectPlayer(null);
  };

  const handlePlayerSelect = (player: { letter: string; color: string; isSquare?: boolean } | null) => {
    if (player) { setDrawingMode(false); onSelectPlayer({ letter: player.letter, color: player.color, isSquare: Boolean(player.isSquare) }); }
    else onSelectPlayer(null);
  };

  const btnBase = 'flex items-center justify-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Row 1: tools */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">

        {/* Select */}
        <button
          onClick={selectMode}
          title="Select / Move"
          className={`${btnBase} p-2 min-w-[36px] ${activeDraw === null && !selectedPlayer ? active : inactive}`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

        {/* Freehand */}
        <button
          onClick={() => pickDraw('freehand')}
          title="Freehand Route"
          className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${activeDraw === 'freehand' ? active : inactive}`}
        >
          <Pencil className="h-4 w-4" style={{ transform: 'rotate(-15deg)' }} />
          <span className="hidden sm:inline whitespace-nowrap">Freehand</span>
        </button>

        {/* Straight */}
        <button
          onClick={() => pickDraw('straight')}
          title="Straight Line Route"
          className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${activeDraw === 'straight' ? active : inactive}`}
        >
          <Minus className="h-4 w-4" />
          <span className="hidden sm:inline whitespace-nowrap">Straight</span>
        </button>

        {/* Waypoint / multi-segment */}
        <button
          onClick={() => pickDraw('waypoint')}
          title="Multi-Segment Route (tap points, double-tap to finish)"
          className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${activeDraw === 'waypoint' ? active : inactive}`}
        >
          <GitBranch className="h-4 w-4" />
          <span className="hidden sm:inline whitespace-nowrap">Route</span>
        </button>

        <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

        {/* Undo */}
        <button onClick={onUndo} disabled={!canUndo} title="Undo" className={`${btnBase} p-2 min-w-[36px] ${canUndo ? inactive : 'opacity-30 cursor-not-allowed text-chalk/30'}`}>
          <Undo className="h-4 w-4" />
        </button>

        {/* Redo */}
        <button onClick={onRedo} disabled={!canRedo} title="Redo" className={`${btnBase} p-2 min-w-[36px] ${canRedo ? inactive : 'opacity-30 cursor-not-allowed text-chalk/30'}`}>
          <Redo className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

        {/* Clear routes */}
        <button onClick={onClearRoutes} title="Clear Routes" className={`${btnBase} p-2 min-w-[36px] text-yellow-400 hover:bg-yellow-400/10`}>
          <Eraser className="h-4 w-4" />
        </button>

        {/* Clear all */}
        <button onClick={onClear} title="Clear All" className={`${btnBase} px-2.5 py-2 gap-1 text-xs text-red-400 hover:bg-red-400/10`}>
          <Eraser className="h-4 w-4" />
          <span className="hidden sm:inline whitespace-nowrap">All</span>
        </button>
      </div>

      {/* Row 2: player icons (horizontally scrollable) */}
      <div className="overflow-x-auto scrollbar-hide">
        <PlayerToolbar selectedPlayer={selectedPlayer} onSelectPlayer={handlePlayerSelect} />
      </div>

      {/* Active mode hint */}
      {activeDraw === 'waypoint' && (
        <p className="text-[10px] text-primary/80 px-1">
          Hover &amp; tap a player to start · Tap waypoints · Double-tap to finish
        </p>
      )}
      {activeDraw === 'straight' && (
        <p className="text-[10px] text-primary/80 px-1">
          Hover a player icon, then drag to draw a straight route
        </p>
      )}
      {activeDraw === 'freehand' && (
        <p className="text-[10px] text-primary/80 px-1">
          Hover a player icon, then drag to draw a freehand route
        </p>
      )}
    </div>
  );
}
