import React from 'react';
import { MousePointer, Undo, Redo, Eraser, Minus, GitBranch, RouteOff, Circle, CircleOff, Magnet, Shield, Type, ArrowUpRight } from 'lucide-react';
import { PlayerToolbar } from './PlayerToolbar';
import { resolveRoster, type CustomRoster } from './rosters';
import { FormationMenu } from './FormationMenu';
import type { DrawMode, CapStyle, IconShape, PlayerIcon } from './Canvas';
import type { PlayMetadata } from '../../types/play';

export type PlayType = 'offense' | 'defense' | 'special_teams';

interface DesignerToolbarProps {
  playType: PlayType;
  onSetPlayType: (type: PlayType) => void;
  playTypeLocked: boolean;
  gameType: PlayMetadata['gameType'];
  onSetGameType: (gameType: PlayMetadata['gameType']) => void;
  onStampFormation: (icons: PlayerIcon[]) => void;
  getCurrentIcons: () => PlayerIcon[];
  drawingMode: boolean;
  setDrawingMode: (mode: boolean) => void;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  /** Terminal decoration for the next route finished in Straight or Route
   *  mode — sticky until changed, independent of shape. */
  capStyle: CapStyle;
  setCapStyle: (style: CapStyle) => void;
  /** Solid vs dashed stroke for the next route finished — sticky until changed. */
  dashed: boolean;
  setDashed: (dashed: boolean) => void;
  deleteRouteMode: boolean;
  setDeleteRouteMode: (mode: boolean) => void;
  zoneMode: boolean;
  setZoneMode: (mode: boolean) => void;
  deleteZoneMode: boolean;
  setDeleteZoneMode: (mode: boolean) => void;
  textMode: boolean;
  setTextMode: (mode: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  selectedPlayer: string | null;
  onSelectPlayer: (player: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => void;
  /** The signed-in user's saved toolbar rosters; null = built-in defaults. */
  customRoster?: CustomRoster | null;
  /** Persist an edited roster. Omitted when signed out, which also hides the
   *  roster-editing controls rather than offering an edit that can't be kept. */
  onRosterChange?: (next: CustomRoster) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onClearRoutes: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** 'vertical' renders a sidebar layout (desktop); default is the
   *  horizontal bar used by the mobile bottom toolbar. */
  orientation?: 'horizontal' | 'vertical';
}

export function DesignerToolbar({
  playType,
  onSetPlayType,
  playTypeLocked,
  gameType,
  onSetGameType,
  onStampFormation,
  getCurrentIcons,
  drawingMode,
  setDrawingMode,
  drawMode,
  setDrawMode,
  capStyle,
  setCapStyle,
  dashed,
  setDashed,
  deleteRouteMode,
  setDeleteRouteMode,
  zoneMode,
  setZoneMode,
  deleteZoneMode,
  setDeleteZoneMode,
  textMode,
  setTextMode,
  snapEnabled,
  setSnapEnabled,
  selectedPlayer,
  onSelectPlayer,
  customRoster = null,
  onRosterChange,
  onUndo,
  onRedo,
  onClear,
  onClearRoutes,
  canUndo,
  canRedo,
  orientation = 'horizontal',
}: DesignerToolbarProps) {
  const activeDraw = drawingMode ? drawMode : null;
  const isDefense = playType === 'defense';
  const isSpecialTeams = playType === 'special_teams';
  // Zone of responsibility applies to defense and special teams (coverage
  // lanes, containment) — only offense gets the Formation menu.
  const showZoneTools = isDefense || isSpecialTeams;
  const roster = resolveRoster(playType, customRoster);
  const vertical = orientation === 'vertical';

  const selectMode = () => {
    setDrawingMode(false);
    setDeleteRouteMode(false);
    setZoneMode(false);
    setDeleteZoneMode(false);
    setTextMode(false);
    onSelectPlayer(null);
  };

  const pickDraw = (mode: DrawMode) => {
    setDrawingMode(true);
    setDeleteRouteMode(false);
    setZoneMode(false);
    setDeleteZoneMode(false);
    setTextMode(false);
    setDrawMode(mode);
    onSelectPlayer(null);
  };

  const toggleDeleteRouteMode = () => {
    const next = !deleteRouteMode;
    setDeleteRouteMode(next);
    if (next) { setDrawingMode(false); setZoneMode(false); setDeleteZoneMode(false); setTextMode(false); onSelectPlayer(null); }
  };

  const toggleZoneMode = () => {
    const next = !zoneMode;
    setZoneMode(next);
    if (next) { setDrawingMode(false); setDeleteRouteMode(false); setDeleteZoneMode(false); setTextMode(false); onSelectPlayer(null); }
  };

  const toggleDeleteZoneMode = () => {
    const next = !deleteZoneMode;
    setDeleteZoneMode(next);
    if (next) { setDrawingMode(false); setDeleteRouteMode(false); setZoneMode(false); setTextMode(false); onSelectPlayer(null); }
  };

  const toggleTextMode = () => {
    const next = !textMode;
    setTextMode(next);
    if (next) { setDrawingMode(false); setDeleteRouteMode(false); setZoneMode(false); setDeleteZoneMode(false); onSelectPlayer(null); }
  };

  const handlePlayerSelect = (player: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => {
    if (player) {
      setDrawingMode(false);
      setDeleteRouteMode(false);
      setZoneMode(false);
      setDeleteZoneMode(false);
      setTextMode(false);
      onSelectPlayer({ letter: player.letter, color: player.color, isSquare: Boolean(player.isSquare), shape: player.shape });
    } else {
      onSelectPlayer(null);
    }
  };

  const btnBase = 'flex items-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';
  // Tool buttons: full-width labeled rows in the sidebar, compact chips in the bar
  const tool = vertical
    ? `${btnBase} w-full justify-start gap-2 px-2.5 py-2 text-xs font-medium`
    : `${btnBase} justify-center px-2.5 py-2 gap-1.5 text-xs font-medium`;
  const iconOnly = `${btnBase} justify-center p-2 min-w-[36px]`;
  const divider = vertical ? 'h-px w-full bg-chalk/15 my-1 shrink-0' : 'w-px h-5 bg-chalk/15 shrink-0 mx-0.5';
  const label = vertical ? 'whitespace-nowrap' : 'hidden sm:inline whitespace-nowrap';

  return (
    <div className={`flex flex-col w-full ${vertical ? 'gap-2' : 'gap-1'}`}>
      {/* Tools: a column of labeled rows (sidebar) or one scrollable row (bar) */}
      <div className={vertical ? 'flex flex-col items-stretch gap-0.5' : 'flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5'}>

        {/* Select */}
        <button
          onClick={selectMode}
          title="Select / Move"
          className={`${vertical ? tool : iconOnly} ${activeDraw === null && !selectedPlayer && !zoneMode && !deleteZoneMode && !textMode ? active : inactive}`}
        >
          <MousePointer className="h-4 w-4" />
          {vertical && <span className="whitespace-nowrap">Select / Move</span>}
        </button>

        {/* Text box annotation — available for every play type */}
        <button
          onClick={toggleTextMode}
          title="Add a text box (tap the field to place it)"
          className={`${tool} ${textMode ? active : inactive}`}
        >
          <Type className="h-4 w-4" />
          <span className={label}>Text</span>
        </button>

        {/* Snap to alignment (Visio-style guides + yard grid) */}
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="Snap to alignment"
          className={`${vertical ? tool : iconOnly} ${snapEnabled ? active : inactive}`}
        >
          <Magnet className="h-4 w-4" />
          {vertical && <span className="whitespace-nowrap">Snap</span>}
        </button>

        <div className={divider} />

        {/* Straight */}
        <button
          onClick={() => pickDraw('straight')}
          title="Straight Line Route"
          className={`${tool} ${activeDraw === 'straight' ? active : inactive}`}
        >
          <Minus className="h-4 w-4" />
          <span className={label}>Straight</span>
        </button>

        {/* Waypoint / multi-segment */}
        <button
          onClick={() => pickDraw('waypoint')}
          title="Multi-Segment Route (drag or tap to place points, double-tap to finish)"
          className={`${tool} ${activeDraw === 'waypoint' ? active : inactive}`}
        >
          <GitBranch className="h-4 w-4" />
          <span className={label}>Route</span>
        </button>

        <div className={divider} />

        {/* Ending style: click to flip between arrowhead and a perpendicular
            block cap. Independent of shape (Straight/Route above) — a route
            can now be curved AND end in a block cap, which wasn't possible
            when Block was its own separate mode. Sticky until changed, like
            drawMode. A single toggle button (rather than a two-button pill)
            keeps the mobile toolbar's scrollable width from growing enough
            to push the Formation trigger out of view — see FormationMenu's
            close-on-scroll effect. */}
        <button
          onClick={() => setCapStyle(capStyle === 'arrow' ? 'block' : 'arrow')}
          title="Ending style: Route (arrow) / Block (perpendicular cap)"
          className={`${tool} ${capStyle === 'block' ? active : inactive}`}
        >
          {capStyle === 'block' ? <Shield className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          <span className={label}>{capStyle === 'block' ? 'Block' : 'Route'}</span>
        </button>

        {/* Line style: click to flip between solid and dotted stroke. */}
        <button
          onClick={() => setDashed(!dashed)}
          title="Line style: Solid / Dotted"
          className={`${tool} ${dashed ? active : inactive}`}
        >
          <span className={`block h-0 w-4 border-t-2 border-current ${dashed ? 'border-dotted' : ''}`} />
          <span className={label}>{dashed ? 'Dotted' : 'Solid'}</span>
        </button>

        {/* Remove Route for a player */}
        <button
          onClick={toggleDeleteRouteMode}
          title="Remove a player's route (tap the player)"
          className={`${tool} ${deleteRouteMode ? 'bg-amber-500/20 text-amber-400' : inactive}`}
        >
          <RouteOff className="h-4 w-4" />
          <span className={label}>Remove Route</span>
        </button>

        {playType === 'offense' && (
          <>
            <div className={divider} />
            <FormationMenu gameType={gameType} onSetGameType={onSetGameType} onStamp={onStampFormation} getCurrentIcons={getCurrentIcons} fullWidth={vertical} />
          </>
        )}

        {showZoneTools && (
          <>
            <div className={divider} />

            {/* Zone of responsibility */}
            <button
              onClick={toggleZoneMode}
              title="Draw a zone of responsibility (drag from a player)"
              className={`${tool} ${zoneMode ? active : inactive}`}
            >
              <Circle className="h-4 w-4" />
              <span className={label}>Zone</span>
            </button>

            {/* Remove Zone */}
            <button
              onClick={toggleDeleteZoneMode}
              title="Remove a player's zone (tap the zone or the player)"
              className={`${tool} ${deleteZoneMode ? 'bg-amber-500/20 text-amber-400' : inactive}`}
            >
              <CircleOff className="h-4 w-4" />
              <span className={label}>Remove Zone</span>
            </button>
          </>
        )}

        <div className={divider} />

        {/* Undo / redo / clears: always compact icons — one row in the sidebar
            (display:contents keeps the horizontal bar's flat flex layout) */}
        <div className={vertical ? 'flex items-center gap-1' : 'contents'}>
          <button onClick={onUndo} disabled={!canUndo} title="Undo" className={`${iconOnly} ${canUndo ? inactive : 'opacity-30 cursor-not-allowed text-chalk/30'}`}>
            <Undo className="h-4 w-4" />
          </button>

          <button onClick={onRedo} disabled={!canRedo} title="Redo" className={`${iconOnly} ${canRedo ? inactive : 'opacity-30 cursor-not-allowed text-chalk/30'}`}>
            <Redo className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-chalk/15 shrink-0 mx-0.5" />

          {/* Clear routes */}
          <button onClick={onClearRoutes} title="Clear Routes" className={`${iconOnly} text-yellow-400 hover:bg-yellow-400/10`}>
            <Eraser className="h-4 w-4" />
          </button>

          {/* Clear all */}
          <button onClick={onClear} title="Clear All" className={`${btnBase} justify-center px-2.5 py-2 gap-1 text-xs text-red-400 hover:bg-red-400/10`}>
            <Eraser className="h-4 w-4" />
            <span className="hidden sm:inline whitespace-nowrap">All</span>
          </button>
        </div>
      </div>

      {vertical && <div className={divider} />}

      {/* Play type + player icons: wrapped grid (sidebar) or scrollable row (bar) */}
      <div className={vertical ? 'flex flex-col gap-2' : 'flex items-center gap-1 overflow-x-auto scrollbar-hide'}>
        {/* Offense / Defense / Special Teams — decided once per play, locked once it has content */}
        <div
          className={`flex items-center rounded-md border border-chalk/15 overflow-hidden shrink-0 ${vertical ? 'w-full' : ''} ${playTypeLocked ? 'opacity-50' : ''}`}
          title={playTypeLocked ? 'Play type is locked once a play has content' : 'Choose the play type'}
        >
          {(['offense', 'defense', 'special_teams'] as const).map((t) => (
            <button
              key={t}
              disabled={playTypeLocked}
              onClick={() => onSetPlayType(t)}
              className={`px-1.5 py-1 text-[11px] font-medium capitalize transition-colors ${vertical ? 'flex-1' : ''} ${
                playType === t ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
              } ${playTypeLocked ? 'cursor-not-allowed' : ''}`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        <PlayerToolbar
          selectedPlayer={selectedPlayer}
          onSelectPlayer={handlePlayerSelect}
          roster={roster}
          playType={playType}
          customRoster={customRoster}
          onRosterChange={onRosterChange}
          wrap={vertical}
        />
      </div>

      {/* Active mode label */}
      {(activeDraw || deleteRouteMode || zoneMode || deleteZoneMode || textMode) && (
        <p className="text-[10px] text-chalk/50 px-1 flex items-center gap-1">
          <span className={`font-semibold ${(deleteRouteMode || deleteZoneMode) ? 'text-amber-400' : 'text-primary'}`}>
            {deleteRouteMode && 'Remove route mode'}
            {deleteZoneMode && 'Remove zone mode'}
            {zoneMode && 'Zone mode'}
            {textMode && 'Text mode'}
            {!deleteRouteMode && !deleteZoneMode && !zoneMode && !textMode && activeDraw === 'straight' && 'Straight line mode'}
            {!deleteRouteMode && !deleteZoneMode && !zoneMode && !textMode && activeDraw === 'waypoint' && 'Curved route mode'}
          </span>
          {activeDraw && (
            <span>
              — {capStyle === 'block' ? 'block ending' : 'route ending'}, {dashed ? 'dotted' : 'solid'}
            </span>
          )}
          <span>· See field for instructions</span>
        </p>
      )}
    </div>
  );
}
