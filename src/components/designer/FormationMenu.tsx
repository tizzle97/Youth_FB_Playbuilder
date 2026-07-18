import React, { useState } from 'react';
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
  const templates = formationsFor(gameType);

  const btnBase = 'flex items-center justify-center rounded-lg transition-colors shrink-0';
  const inactive = 'text-chalk/60 hover:text-chalk hover:bg-white/10';
  const active = 'bg-primary/20 text-primary';

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Formation templates"
        className={`${btnBase} px-2.5 py-2 gap-1.5 text-xs font-medium ${open ? active : inactive}`}
      >
        <Layout className="h-4 w-4" />
        <span className="hidden sm:inline whitespace-nowrap">Formation</span>
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-40 bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-2 w-56"
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
        </>
      )}
    </div>
  );
}
