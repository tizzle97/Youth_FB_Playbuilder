import React, { useEffect, useRef, useState } from 'react';
import type { IconShape } from './Canvas';

/** Longest label that still renders legibly inside a player icon (the canvas
 *  shrinks the font to fit, so anything longer becomes unreadable). */
export const MAX_PLAYER_LABEL_LENGTH = 5;

/** Every color used across the offense + defense preset rosters, offered as
 *  one-tap swatches. The native color input below covers everything else.
 *  Exported so RouteColorEditor's swatch grid matches this one exactly. */
export const SWATCH_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#6366F1', '#000000',
  '#F97316', '#14B8A6', '#84CC16', '#E11D48',
];

/** CSS clip-path per shape, shared by the shape buttons and the live
 *  preview so they always look the same. Circle/square use border-radius. */
const SHAPE_CLIP: Record<IconShape, string | undefined> = {
  circle: undefined,
  square: undefined,
  triangle: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
};

const SHAPES: IconShape[] = ['circle', 'square', 'triangle', 'star'];

/** Inline style that renders `shape` as a solid swatch. Exported so the
 *  toolbar chips draw the same four shapes this editor offers — otherwise a
 *  saved triangle or star would show up as a square chip. */
export function shapeStyle(shape: IconShape, color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    borderRadius: shape === 'circle' ? '50%' : 0,
    clipPath: SHAPE_CLIP[shape],
  };
}

type PlayerStyleEditorProps = {
  initialLetter: string;
  initialColor: string;
  initialShape?: IconShape;
  applyLabel: string;
  onApply: (letter: string, color: string, shape: IconShape) => void;
  onCancel: () => void;
};

/**
 * Shared label + color + shape form for customizing a player icon. Used in
 * two places: the canvas popover that edits an already-placed icon, and the
 * toolbar's "Custom" chip that defines a new player before placing it.
 * Positioning/backdrop is the parent's job — this renders only the card.
 */
export function PlayerStyleEditor({ initialLetter, initialColor, initialShape = 'circle', applyLabel, onApply, onCancel }: PlayerStyleEditorProps) {
  const [letter, setLetter] = useState(initialLetter);
  const [color, setColor] = useState(initialColor);
  const [shape, setShape] = useState<IconShape>(initialShape);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  const trimmed = letter.trim();
  const canApply = trimmed.length >= 1 && trimmed.length <= MAX_PLAYER_LABEL_LENGTH;
  const apply = () => { if (canApply) onApply(trimmed, color, shape); };

  return (
    <div
      className="bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-3 w-[230px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3">
        {/* Live preview */}
        <div
          className="w-9 h-9 flex items-center justify-center text-white font-bold shrink-0"
          style={{
            ...shapeStyle(shape, color),
            fontSize: trimmed.length > 2 ? 9 : trimmed.length > 1 ? 11 : 15,
            // Triangle/star leave little room at their center — nudge the
            // label down (triangle) to sit in the wide part of the shape.
            paddingTop: shape === 'triangle' ? 8 : 0,
          }}
        >
          {trimmed || '?'}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={letter}
          maxLength={MAX_PLAYER_LABEL_LENGTH}
          onChange={(e) => setLetter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') onCancel();
          }}
          aria-label="Player label"
          placeholder="Label"
          className="w-full px-2 py-1.5 text-sm border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Shape picker */}
      <div className="flex items-center gap-1.5 mb-3">
        {SHAPES.map((s) => (
          <button
            key={s}
            onClick={() => setShape(s)}
            title={s}
            aria-label={`Shape ${s}`}
            className={`p-1.5 rounded-lg border-2 transition-colors ${
              shape === s ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-white/10'
            }`}
          >
            <div className="w-6 h-6" style={shapeStyle(s, color)} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {SWATCH_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            aria-label={`Color ${c}`}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              color.toLowerCase() === c.toLowerCase() ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <label className="flex items-center gap-2 mb-3 text-xs text-chalk/70 cursor-pointer">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Custom color"
          className="w-7 h-7 rounded cursor-pointer bg-transparent border border-chalk/20 p-0.5"
        />
        More colors…
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-chalk/70 hover:text-chalk rounded-lg hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={!canApply}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
