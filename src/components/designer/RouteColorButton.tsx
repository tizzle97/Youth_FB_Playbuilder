import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RouteColorEditor } from './RouteColorEditor';

const DEFAULT_PREVIEW_COLOR = '#3B82F6';

interface RouteColorButtonProps {
  /** 'auto' = new routes match their player's color (today's only behavior).
   *  Anything else is a hex color new routes are drawn with instead. */
  value: 'auto' | string;
  onChange: (value: 'auto' | string) => void;
  /** Full-width left-aligned trigger for the sidebar layout. */
  fullWidth?: boolean;
}

/**
 * Toolbar control for the sticky "next route" color default. Portal-anchored
 * to the trigger button exactly like FormationMenu's popover — same reason:
 * the toolbar row scrolls horizontally, which forces overflow-y: auto too,
 * silently clipping an `absolute`-positioned popover nested inside it.
 */
export function RouteColorButton({ value, onChange, fullWidth = false }: RouteColorButtonProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const openedAt = Date.now();
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 230 - 8));
      const openUp = rect.bottom > window.innerHeight / 2;
      setCoords(
        openUp
          ? { left, bottom: window.innerHeight - rect.top + 4 }
          : { left, top: rect.bottom + 4 },
      );
    };
    updatePosition();
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      // Same fix as FormationMenu: a capture-phase window listener sees the
      // editor's own internal scrolling too, since scroll events don't
      // bubble but still fire capture handlers on ancestors — without this
      // check, scrolling inside the popover was indistinguishable from the
      // page scrolling behind it and closed the very thing being scrolled.
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
      if (Date.now() - openedAt < 300) { updatePosition(); return; }
      close();
    };
    const onResize = () => {
      // Don't discard in-progress input (e.g. a custom hex value) just
      // because the on-screen keyboard opening fired a resize.
      if (popoverRef.current && document.activeElement && popoverRef.current.contains(document.activeElement)) {
        updatePosition();
        return;
      }
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const btnBase = 'flex items-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';
  const isAuto = value === 'auto';

  return (
    <div className={`relative shrink-0 ${fullWidth ? 'w-full' : ''}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Route color: Auto (match player) or a fixed color for every new route"
        className={`${btnBase} text-xs font-medium ${
          fullWidth ? 'w-full justify-start gap-2 px-2.5 py-2' : 'tap-target justify-center px-2.5 py-2 gap-1.5'
        } ${open ? active : inactive}`}
      >
        {isAuto ? (
          <span
            className="w-4 h-4 rounded-full shrink-0"
            style={{ background: 'conic-gradient(#3B82F6, #10B981, #F59E0B, #EF4444, #8B5CF6, #3B82F6)' }}
          />
        ) : (
          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: value }} />
        )}
        <span className={fullWidth ? 'whitespace-nowrap' : 'hidden sm:inline whitespace-nowrap'}>
          {isAuto ? 'Auto' : 'Route Color'}
        </span>
      </button>

      {open && coords && createPortal(
        <>
          {/* z-[55]/z-[60], not z-30/z-40: portaled to <body>, so this now competes
              directly with /designer's own `z-50` full-screen shell (see the
              z-index note in Navbar.tsx) instead of nesting inside it. */}
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div ref={popoverRef} className="fixed z-[60]" style={{ left: coords.left, top: coords.top, bottom: coords.bottom }}>
            <RouteColorEditor
              initialColor={isAuto ? DEFAULT_PREVIEW_COLOR : value}
              initialAuto={isAuto}
              applyLabel="Set"
              onApply={(color, auto) => { onChange(auto ? 'auto' : color); setOpen(false); }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
