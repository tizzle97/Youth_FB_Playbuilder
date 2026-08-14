import React, { useState } from 'react';
import { UserPlus, Pencil, RotateCcw, Check } from 'lucide-react';
import { PlayerStyleEditor, shapeStyle } from './PlayerStyleEditor';
import type { IconShape } from './Canvas';
import type { PlayType } from './DesignerToolbar';
import { rosterIsCustomized, type CustomRoster, type RosterChip } from './rosters';

interface PlayerIconProps {
  letter: string;
  color: string;
  shape: IconShape;
  isSelected?: boolean;
  /** Shows a pencil overlay and switches the click to "edit this chip". */
  editing?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

const PlayerIcon: React.FC<PlayerIconProps> = ({ letter, color, shape, isSelected, editing, onClick, onDragStart }) => {
  const buttonClasses = `relative p-2 rounded-md transition-colors ${
    isSelected ? 'bg-primary/20' : 'hover:bg-board-light'
  }`;

  const handleDragStart = (e: React.DragEvent) => {
    // `shape` must travel with the payload: Canvas's drop handler reads it, and
    // omitting it silently landed every dragged chip as a circle/square.
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ letter, color, shape, isSquare: shape === 'square' }),
    );
    e.dataTransfer.effectAllowed = 'copy';

    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'fixed top-0 left-0 -translate-x-full';
    dragImage.style.width = '36px';
    dragImage.style.height = '36px';
    Object.assign(dragImage.style, shapeStyle(shape, color) as Record<string, string>);
    dragImage.style.display = 'flex';
    dragImage.style.alignItems = 'center';
    dragImage.style.justifyContent = 'center';
    dragImage.style.color = '#FFFFFF';
    dragImage.style.fontWeight = 'bold';
    dragImage.style.fontSize = '24px';
    dragImage.style.fontFamily = 'Inter, sans-serif';
    dragImage.textContent = letter;

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 18, 18);

    // Clean up the drag image after it's no longer needed
    setTimeout(() => document.body.removeChild(dragImage), 0);

    onDragStart?.(e);
  };

  return (
    <button
      onClick={onClick}
      // Dragging a chip while in edit mode would place a player instead of
      // editing it, which is the opposite of what the pencil implies.
      draggable={!editing}
      onDragStart={handleDragStart}
      className={buttonClasses}
      title={editing ? `Edit player ${letter}` : `Player ${letter}`}
    >
      <div
        className={`w-8 h-8 flex items-center justify-center text-white font-bold ${
          editing ? 'cursor-pointer' : 'cursor-move'
        } ${letter.length > 1 ? 'text-[10px]' : ''}`}
        style={shapeStyle(shape, color)}
      >
        {letter}
      </div>
      {editing && (
        <span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary p-0.5 text-white shadow">
          <Pencil className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
};

interface PlayerToolbarProps {
  selectedPlayer: string | null;
  onSelectPlayer: (player: { letter: string; color: string; isSquare?: boolean; shape?: IconShape } | null) => void;
  roster: RosterChip[];
  /** Which roster is on screen — edits and resets are scoped to it. */
  playType: PlayType;
  /** The user's saved rosters, for computing the edited roster to persist. */
  customRoster?: CustomRoster | null;
  /** Persist a changed roster. Absent when signed out (edits stay local). */
  onRosterChange?: (next: CustomRoster) => void;
  /** Wrap icons into a grid (sidebar layout) instead of a single row. */
  wrap?: boolean;
}

export function PlayerToolbar({
  selectedPlayer,
  onSelectPlayer,
  roster,
  playType,
  customRoster = null,
  onRosterChange,
  wrap = false,
}: PlayerToolbarProps) {
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  // Remembered across placements within the session, so a coach placing
  // several similar custom players doesn't have to re-enter everything.
  const [customDraft, setCustomDraft] = useState<{ letter: string; color: string; shape: IconShape }>({ letter: '1', color: '#3B82F6', shape: 'circle' });
  // Edit mode is a toggle rather than hover or long-press: hover doesn't exist
  // on touch, and long-press collides with the chip's own drag gesture. One
  // toggle behaves identically in the desktop sidebar and the mobile bar.
  const [editMode, setEditMode] = useState(false);
  const [editingChipId, setEditingChipId] = useState<string | null>(null);

  const editingChip = roster.find((c) => c.id === editingChipId) ?? null;
  const isCustomized = rosterIsCustomized(playType, customRoster);

  const commitRoster = (next: RosterChip[]) => {
    onRosterChange?.({ ...(customRoster ?? {}), [playType]: next });
  };

  const handleChipApply = (letter: string, color: string, shape: IconShape) => {
    if (!editingChipId) return;
    commitRoster(roster.map((c) => (c.id === editingChipId ? { ...c, letter, color, shape } : c)));
    setEditingChipId(null);
  };

  const handleReset = () => {
    // Drop this play type's key entirely rather than writing the defaults back,
    // so the chips keep tracking the built-ins if those ever change.
    const next = { ...(customRoster ?? {}) };
    delete next[playType];
    onRosterChange?.(next);
    setEditingChipId(null);
  };

  return (
    <div className={`flex items-center gap-1 ${wrap ? 'flex-wrap' : ''}`}>
      {!wrap && <div className="h-6 w-px bg-chalk/10 mx-1"></div>}
      {roster.map((player) => (
        <PlayerIcon
          key={player.id}
          letter={player.letter}
          color={player.color}
          shape={player.shape}
          isSelected={!editMode && selectedPlayer === player.letter}
          editing={editMode}
          onClick={() => {
            try {
              if (editMode) {
                setEditingChipId(player.id);
                return;
              }
              if (selectedPlayer === player.letter) {
                onSelectPlayer(null);
              } else {
                onSelectPlayer({
                  letter: player.letter,
                  color: player.color,
                  shape: player.shape,
                  isSquare: player.shape === 'square',
                });
              }
            } catch (error) {
              console.error('Error in PlayerToolbar onClick:', error);
            }
          }}
        />
      ))}

      {/* Custom player: any label (letters or numbers) + any color */}
      <button
        onClick={() => setShowCustomEditor(true)}
        title="Custom player (choose label and color)"
        className="p-2 rounded-md transition-colors hover:bg-board-light"
      >
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-chalk/40 flex items-center justify-center text-chalk/60 hover:text-chalk hover:border-chalk/70 transition-colors">
          <UserPlus className="h-4 w-4" />
        </div>
      </button>

      {/* Roster editing is only offered when it can be persisted. */}
      {onRosterChange && (
        <>
          <button
            onClick={() => { setEditMode((v) => !v); setEditingChipId(null); }}
            title={editMode ? 'Done editing players' : 'Edit your players'}
            aria-pressed={editMode}
            className={`tap-target flex items-center justify-center p-2 rounded-md transition-colors ${
              editMode ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk hover:bg-board-light'
            }`}
          >
            {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
          {editMode && isCustomized && (
            <button
              onClick={handleReset}
              title="Reset these players to the defaults"
              className="p-2 rounded-md text-chalk/60 hover:text-chalk hover:bg-board-light transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </>
      )}

      {editingChip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingChipId(null)} />
          <div className="relative">
            <PlayerStyleEditor
              key={editingChip.id}
              initialLetter={editingChip.letter}
              initialColor={editingChip.color}
              initialShape={editingChip.shape}
              applyLabel="Save Player"
              onApply={handleChipApply}
              onCancel={() => setEditingChipId(null)}
            />
          </div>
        </div>
      )}

      {showCustomEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCustomEditor(false)} />
          <div className="relative">
            <PlayerStyleEditor
              initialLetter={customDraft.letter}
              initialColor={customDraft.color}
              initialShape={customDraft.shape}
              applyLabel="Place Player"
              onApply={(letter, color, shape) => {
                setCustomDraft({ letter, color, shape });
                setShowCustomEditor(false);
                onSelectPlayer({ letter, color, shape, isSquare: shape === 'square' });
              }}
              onCancel={() => setShowCustomEditor(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
