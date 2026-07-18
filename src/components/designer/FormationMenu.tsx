import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from 'lucide-react';
import { formationsFor } from './formations';
import type { PlayerIcon } from './Canvas';
import type { PlayMetadata } from '../../types/play';

const GAME_TYPES: PlayMetadata['gameType'][] = ['5v5', '7v7', '11v11'];

interface FormationMenuProps {
  gameType: PlayMetadata['gameType'];
  onSetGameType: (gameType: PlayMetadata['gameType']) => void;
  onStamp: (icons: PlayerIcon[]) => void;
  /** Full-width left-aligned trigger for the sidebar layout. */
  fullWidth?: boolean;
}

export function FormationMenu({ gameType, onSetGameType, onStamp, fullWidth = false }: FormationMenuProps) {
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
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const btnBase = 'flex items-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';

  return (
    <div className={`relative shrink-0 ${fullWidth ? 'w-full' : ''}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Formation templates"
        className={`${btnBase} text-xs font-medium ${
          fullWidth ? 'w-full justify-start gap-2 px-2.5 py-2' : 'justify-center px-2.5 py-2 gap-1.5'
        } ${open ? active : inactive}`}
      >
        <Layout className="h-4 w-4" />
        <span className={fullWidth ? 'whitespace-nowrap' : 'hidden sm:inline whitespace-nowrap'}>Formation</span>
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
              Game format
            </p>
            <div className="flex items-center rounded-md border border-chalk/15 overflow-hidden mb-2">
              {GAME_TYPES.map((g) => (
                <button
                  key={g}
                  onClick={() => onSetGameType(g)}
                  className={`flex-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                    gameType === g ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
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
