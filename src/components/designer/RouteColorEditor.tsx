import React, { useState } from 'react';
import { SWATCH_COLORS } from './PlayerStyleEditor';

type RouteColorEditorProps = {
  initialColor: string;
  initialAuto: boolean;
  applyLabel: string;
  onApply: (color: string, auto: boolean) => void;
  onCancel: () => void;
};

/**
 * Small color-only picker for route lines — a sibling to PlayerStyleEditor,
 * not a generalized version of it: routes have no label or shape, and adding
 * an "Auto" concept to the icon editor (which always writes a real color)
 * would only complicate a component that already does its one job well.
 *
 * Used in two places with two different positioning shells: the toolbar's
 * sticky "Route Color" button (portaled like FormationMenu's popover) and
 * the canvas-anchored Recolor Route popover (positioned like the icon-edit
 * popover). Both render this same card.
 */
export function RouteColorEditor({ initialColor, initialAuto, applyLabel, onApply, onCancel }: RouteColorEditorProps) {
  const [auto, setAuto] = useState(initialAuto);
  const [color, setColor] = useState(initialColor);

  const apply = () => onApply(color, auto);

  return (
    <div
      className="bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-3 w-[230px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setAuto(true)}
        title="Match each route to its player's color"
        aria-pressed={auto}
        className={`w-full flex items-center gap-2 px-2 py-1.5 mb-3 rounded-lg border-2 text-xs font-medium transition-colors ${
          auto ? 'border-primary bg-primary/10 text-chalk' : 'border-transparent text-chalk/70 hover:bg-white/10'
        }`}
      >
        <span
          className="w-5 h-5 rounded-full shrink-0"
          style={{ background: 'conic-gradient(#3B82F6, #10B981, #F59E0B, #EF4444, #8B5CF6, #3B82F6)' }}
        />
        Auto (match player)
      </button>

      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {SWATCH_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setAuto(false); }}
            title={c}
            aria-label={`Color ${c}`}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              !auto && color.toLowerCase() === c.toLowerCase() ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <label className="flex items-center gap-2 mb-3 text-xs text-chalk/70 cursor-pointer">
        <input
          type="color"
          value={color}
          onChange={(e) => { setColor(e.target.value); setAuto(false); }}
          aria-label="Custom route color"
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
          className="px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
