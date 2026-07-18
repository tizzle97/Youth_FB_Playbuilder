import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from 'lucide-react';
import { formationsFor } from './formations';
import type { PlayerIcon } from './Canvas';
import type { PlayMetadata } from '../../types/play';

interface FormationMenuProps {
  gameType: PlayMetadata['gameType'];
  onStamp: (icons: PlayerIcon[]) => void;
}

export function FormationMenu({ gameType, onStamp }: FormationMenuProps) {
  const [open, setOpen] = useState(false);
  // Position is computed from the trigger button's real screen location and
  // the popover is portaled to <body> as position:fixed — the toolbar row it
  // lives in scrolls horizontally (`overflow-x-auto`), which per the CSS
  // overflow spec forces overflow-y to `auto` too, so an `absolute`-positioned
  // popover nested inside that row gets silently clipped out of view instead
  // of showing (still clickable via automation, just invisible to a real
  // user — see B-24 follow-up).
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const templates = formationsFor(gameType);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setCoords({ left: rect.left, top: rect.bottom + 4 });
    };
    updatePosition();
    // The toolbar can scroll/resize (horizontal scroll row, mobile rotation);
    // close instead of leaving the popover pinned to a stale position.
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const btnBase = 'flex items-center justify-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Formation templates"
        className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${open ? active : inactive}`}
      >
        <Layout className="h-4 w-4" />
        <span className="hidden sm:inline whitespace-nowrap">Formation</span>
      </button>

      {open && coords && createPortal(
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="fixed z-40 bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-2 w-56"
            style={{ left: coords.left, top: coords.top }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] uppercase tracking-wide text-chalk/40 px-1.5 pb-1">
              {gameType} formations
            </p>
            {templates.length === 0 ? (
              <p className="text-xs text-chalk/50 px-1.5 py-1">No templates yet for this format.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onStamp(t.icons);
                      setOpen(false);
                    }}
                    className="text-left px-2 py-1.5 rounded-lg text-sm text-chalk hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
