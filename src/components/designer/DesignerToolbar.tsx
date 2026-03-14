import React from 'react';
import { MousePointer, Pencil, Undo, Redo, Eraser, Route } from 'lucide-react';
import { PlayerToolbar } from './PlayerToolbar';

interface DesignerToolbarProps {
  drawingMode: boolean;
  setDrawingMode: (mode: boolean) => void;
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
  selectedPlayer,
  onSelectPlayer,
  onUndo,
  onRedo,
  onClear,
  onClearRoutes,
  canUndo,
  canRedo
}: DesignerToolbarProps) {
  const handleSelectMode = () => {
    setDrawingMode(false);
    onSelectPlayer(null);
  };

  const handleDrawingMode = () => {
    setDrawingMode(true);
    onSelectPlayer(null);
  };

  const handlePlayerSelect = (player: { letter: string; color: string; isSquare?: boolean } | null) => {
    try {
      if (player) {
        setDrawingMode(false);
        // Only pass the necessary data to avoid potential circular references
        onSelectPlayer({
          letter: player.letter,
          color: player.color,
          isSquare: Boolean(player.isSquare)
        });
      } else {
        onSelectPlayer(null);
      }
    } catch (error) {
      console.error('Error in handlePlayerSelect:', error);
      // Ensure we always have a valid state
      onSelectPlayer(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-board rounded-lg border border-chalk/10 p-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSelectMode}
          className={`p-2 ${!drawingMode && !selectedPlayer ? 'bg-primary/20 text-primary' : 'text-chalk/70 hover:text-chalk hover:bg-board-light'} rounded-md transition-colors`}
          title="Select Mode"
        >
          <MousePointer className="h-5 w-5" />
        </button>
        
        <button
          onClick={handleDrawingMode}
          className={`px-3 py-2 flex items-center gap-2 ${
            drawingMode 
              ? 'bg-primary/20 text-primary' 
              : 'text-chalk/70 hover:text-chalk hover:bg-board-light'
          } rounded-md transition-colors`}
          title="Drawing Mode"
        >
          <Pencil className="h-5 w-5" style={{ transform: 'rotate(-15deg)' }} />
          <span className="text-sm">Draw Route</span>
        </button>
      </div>

      <div className="h-6 w-px bg-chalk/10 mx-1"></div>

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 text-chalk/70 hover:text-chalk hover:bg-board-light rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-5 w-5" />
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 text-chalk/70 hover:text-chalk hover:bg-board-light rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-5 w-5" />
      </button>

      <PlayerToolbar
        selectedPlayer={selectedPlayer}
        onSelectPlayer={handlePlayerSelect}
      />

      <div className="h-6 w-px bg-chalk/10 mx-1"></div>

      <button
        onClick={onClearRoutes}
        className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-colors"
        title="Clear Routes"
      >
        <Route className="h-5 w-5" />
      </button>

      <button
        onClick={onClear}
        className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
        title="Clear All"
      >
        <Eraser className="h-5 w-5" />
      </button>
    </div>
  );
}