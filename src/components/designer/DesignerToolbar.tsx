import React from 'react';
import { MousePointer, Undo, Redo, Eraser, Minus, GitBranch, RouteOff, Circle, CircleOff, Magnet } from 'lucide-react';
import { PlayerToolbar, players, defensivePlayers } from './PlayerToolbar';
import { FormationMenu } from './FormationMenu';
import type { DrawMode, IconShape, PlayerIcon } from './Canvas';
import type { PlayMetadata } from '../../types/play';

export type PlayType = 'offense' | 'defense';

interface DesignerToolbarProps {
  playType: PlayType;
  onSetPlayType: (type: PlayType) => void;
  playTypeLocked: boolean;
  gameType: PlayMetadata['gameType'];
  onStampFormation: (icons: PlayerIcon[]) => void;
  drawingMode: boolean;
  setDrawingMode: (mode: boolean) => void;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  deleteRouteMode: boolean;
  setDeleteRouteMode: (mode: boolean) => void;
  zoneMode: boolean;
  setZoneMode: (mode: boolean) => void;
  deleteZoneMode: boolean;
  setDeleteZoneMode: (mode: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  selectedPlayer: string | null;
  onSelectPlayer: (player: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClearRoutes: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function DesignerToolbar({
  playType,
  onSetPlayType,
  playTypeLocked,
  gameType,
  onStampFormation,
  drawingMode,
  setDrawingMode,
  drawMode,
  setDrawMode,
  deleteRouteMode,
  setDeleteRouteMode,
  zoneMode,
  setZoneMode,
  deleteZoneMode,
  setDeleteZoneMode,
  snapEnabled,
  setSnapEnabled,
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
  const isDefense = playType === 'defense';

  const selectMode = () => {
    setDrawingMode(false);
    setDeleteRouteMode(false);
    setZoneMode(false);
    setDeleteZoneMode(false);
    onSelectPlayer(null);
  };

  const pickDraw = (mode: DrawMode) => {
    setDrawingMode(true);
    setDeleteRouteMode(false);
    setZoneMode(false);
    setDeleteZoneMode(false);
    setDrawMode(mode);
    onSelectPlayer(null);
  };

  const toggleDeleteRouteMode = () => {
    const next = !deleteRouteMode;
    setDeleteRouteMode(next);
    if (next) { setDrawingMode(false); setZoneMode(false); setDeleteZoneMode(false); onSelectPlayer(null); }
  };

  const toggleZoneMode = () => {
    const next = !zoneMode;
    setZoneMode(next);
    if (next) { setDrawingMode(false); setDeleteRouteMode(false); setDeleteZoneMode(false); onSelectPlayer(null); }
  };

  const toggleDeleteZoneMode = () => {
    const next = !deleteZoneMode;
    setDeleteZoneMode(next);
    if (next) { setDrawingMode(false); setDeleteRouteMode(false); setZoneMode(false); onSelectPlayer(null); }
  };

  const handlePlayerSelect = (player: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => {
    if (player) {
      setDrawingMode(false);
      setDeleteRouteMode(false);
      setZoneMode(false);
      setDeleteZoneMode(false);
      onSelectPlayer({ letter: player.letter, color: player.color, isSquare: Boolean(player.isSquare), shape: player.shape });
    } else {
      onSelectPlayer(null);
    }
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
          className={`${btnBase} p-2 min-w-[36px] ${activeDraw === null && !selectedPlayer && !zoneMode && !deleteZoneMode ? active : inactive}`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        {/* Snap to alignment (Visio-style guides + yard grid) */}
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="Snap to alignment"
          className={`${btnBase} p-2 min-w-[36px] ${snapEnabled ? active : inactive}`}
        >
          <Magnet className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

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

        {/* Remove Route for a player */}
        <button
          onClick={toggleDeleteRouteMode}
          title="Remove a player's route (tap the player)"
          className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${
            deleteRouteMode ? 'bg-amber-500/20 text-amber-400' : inactive
          }`}
        >
          <RouteOff className="h-4 w-4" />
          <span className="hidden sm:inline whitespace-nowrap">Remove Route</span>
        </button>

        {!isDefense && (
          <>
            <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />
            <FormationMenu gameType={gameType} onStamp={onStampFormation} />
          </>
        )}

        {isDefense && (
          <>
            <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

            {/* Zone of responsibility */}
            <button
              onClick={toggleZoneMode}
              title="Draw a zone of responsibility (drag from a player)"
              className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${zoneMode ? active : inactive}`}
            >
              <Circle className="h-4 w-4" />
              <span className="hidden sm:inline whitespace-nowrap">Zone</span>
            </button>

            {/* Remove Zone */}
            <button
              onClick={toggleDeleteZoneMode}
              title="Remove a player's zone (tap the zone or the player)"
              className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${
                deleteZoneMode ? 'bg-amber-500/20 text-amber-400' : inactive
              }`}
            >
              <CircleOff className="h-4 w-4" />
              <span className="hidden sm:inline whitespace-nowrap">Remove Zone</span>
            </button>
          </>
        )}

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

      {/* Row 2: play type + player icons (horizontally scrollable) */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {/* Offense / Defense — decided once per play, locked once it has content */}
        <div
          className={`flex items-center rounded-md border border-chalk/15 overflow-hidden shrink-0 ${playTypeLocked ? 'opacity-50' : ''}`}
          title={playTypeLocked ? 'Play type is locked once a play has content' : 'Choose the play type'}
        >
          {(['offense', 'defense'] as const).map((t) => (
            <button
              key={t}
              disabled={playTypeLocked}
              onClick={() => onSetPlayType(t)}
              className={`px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                playType === t ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
              } ${playTypeLocked ? 'cursor-not-allowed' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
        <PlayerToolbar
          selectedPlayer={selectedPlayer}
          onSelectPlayer={handlePlayerSelect}
          roster={isDefense ? defensivePlayers : players}
        />
      </div>

      {/* Active mode label */}
      {(activeDraw || deleteRouteMode || zoneMode || deleteZoneMode) && (
        <p className="text-[10px] text-chalk/50 px-1 flex items-center gap-1">
          <span className={`font-semibold ${(deleteRouteMode || deleteZoneMode) ? 'text-amber-400' : 'text-primary'}`}>
            {deleteRouteMode && 'Remove route mode'}
            {deleteZoneMode && 'Remove zone mode'}
            {zoneMode && 'Zone mode'}
            {!deleteRouteMode && !deleteZoneMode && !zoneMode && activeDraw === 'straight' && 'Straight line mode'}
            {!deleteRouteMode && !deleteZoneMode && !zoneMode && activeDraw === 'waypoint' && 'Curved route mode'}
          </span>
          <span>· See field for instructions</span>
        </p>
      )}
    </div>
  );
}
