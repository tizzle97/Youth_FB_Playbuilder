import React from 'react';
import { GripHorizontal, GripVertical, Minus, Wrench } from 'lucide-react';
import { useDraggablePanel, type PanelAnchor } from './useDraggablePanel';

interface FloatingPanelProps {
  /** localStorage key for this panel's position (and collapsed flag). */
  storageKey: string;
  anchor: PanelAnchor;
  /** Accessible name — also what the grip and collapse controls describe. */
  label: string;
  /** 'column' puts the grip on top (tools panel); 'row' puts it at the left
   *  edge (the action buttons, a single row). */
  layout: 'column' | 'row';
  collapsible?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * A floating, draggable surface over the full-screen field. Drag it by its
 * grip; it remembers where it was left and stays inside the viewport.
 */
export function FloatingPanel({ storageKey, anchor, label, layout, collapsible, className = '', children }: FloatingPanelProps) {
  const { panelRef, style, collapsed, setCollapsed, gripProps } = useDraggablePanel(storageKey, anchor, layout);
  const shell = 'z-40 rounded-xl bg-board-light/95 border border-chalk/15 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm';

  if (collapsible && collapsed) {
    return (
      <div ref={panelRef} style={style} className={`${shell} flex items-center`} role="toolbar" aria-label={label}>
        <div {...gripProps} className="tap-target flex items-center justify-center px-1.5 text-chalk/40" title={`Move ${label.toLowerCase()}`}>
          <GripVertical className="h-4 w-4" />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={`Show ${label.toLowerCase()}`}
          className="tap-target flex items-center gap-1.5 pr-3 pl-1 py-2 text-sm font-medium text-chalk hover:text-white"
        >
          <Wrench className="h-4 w-4 text-primary" />
          {label}
        </button>
      </div>
    );
  }

  if (layout === 'row') {
    return (
      <div ref={panelRef} style={style} className={`${shell} flex items-center gap-1 p-1.5 ${className}`} role="toolbar" aria-label={label}>
        <div {...gripProps} className="tap-target flex items-center justify-center self-stretch px-0.5 text-chalk/40 hover:text-chalk/70" title={`Move ${label.toLowerCase()}`}>
          <GripVertical className="h-4 w-4" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div ref={panelRef} style={style} className={`${shell} flex flex-col ${className}`} role="toolbar" aria-label={label}>
      <div className="flex items-center shrink-0 border-b border-chalk/10">
        <div
          {...gripProps}
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-[10px] font-semibold uppercase tracking-[0.18em] text-chalk/45 select-none"
          title={`Move ${label.toLowerCase()}`}
        >
          <GripHorizontal className="h-4 w-4" />
          {label}
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title={`Hide ${label.toLowerCase()}`}
            className="tap-target flex items-center justify-center px-2.5 self-stretch text-chalk/50 hover:text-chalk"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
