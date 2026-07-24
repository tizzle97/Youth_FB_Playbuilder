import React, { useEffect, useRef, useState } from 'react';
import { TEXT_BOX_SIZES } from './Canvas';

/** The field background is white, so black leads the palette as the default,
 *  legible choice; the rest matches the player-icon swatches so a coach's
 *  callouts can match their team colors. */
const SWATCH_COLORS = [
  '#000000', '#FFFFFF', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
];

const SIZES: { key: keyof typeof TEXT_BOX_SIZES; label: string }[] = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
];

type TextBoxEditorProps = {
  initialText: string;
  initialColor: string;
  initialFontSize: number;
  onApply: (text: string, color: string, fontSize: number) => void;
  onDelete: () => void;
  onCancel: () => void;
};

/**
 * Popover form for a canvas text annotation: multi-line content, color, and
 * size. Positioning/backdrop is the parent's job — this renders only the card.
 * Mirrors PlayerStyleEditor's layout/behavior conventions (swatch grid,
 * Cancel/Apply footer, Escape to cancel).
 */
export function TextBoxEditor({ initialText, initialColor, initialFontSize, onApply, onDelete, onCancel }: TextBoxEditorProps) {
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.select(); }, []);

  const apply = () => onApply(text, color, fontSize);

  return (
    <div
      className="bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-3 w-[230px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) apply();
          if (e.key === 'Escape') onCancel();
        }}
        aria-label="Text box content"
        placeholder="Type here…"
        rows={3}
        className="w-full px-2 py-1.5 mb-3 text-sm border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
      />

      {/* Size picker */}
      <div className="flex items-center gap-1.5 mb-3">
        {SIZES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFontSize(TEXT_BOX_SIZES[key])}
            title={key}
            aria-label={`Size ${key}`}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-colors ${
              fontSize === TEXT_BOX_SIZES[key] ? 'border-primary bg-primary/10 text-chalk' : 'border-transparent text-chalk/70 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1.5 mb-3">
        {SWATCH_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            aria-label={`Color ${c}`}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
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

      <div className="flex justify-between items-center gap-2">
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Delete
        </button>
        <div className="flex gap-2">
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
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
