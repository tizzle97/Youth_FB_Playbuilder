import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout, Lock, Plus, Trash2 } from 'lucide-react';
import { formationsFor, type FormationTemplate } from './formations';
import type { PlayerIcon } from './Canvas';
import type { PlayMetadata } from '../../types/play';
import { useEntitlement } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';
import { loadCustomFormations, saveCustomFormation, deleteCustomFormation } from '../../lib/customFormations';
import { getSafeErrorMessage } from '../../lib/errors';

const GAME_TYPES: PlayMetadata['gameType'][] = ['5v5', '6v6', '7v7', '11v11'];

interface FormationMenuProps {
  gameType: PlayMetadata['gameType'];
  onSetGameType: (gameType: PlayMetadata['gameType']) => void;
  onStamp: (icons: PlayerIcon[]) => void;
  /** The only thing FormationMenu can't self-serve — it has no canvas ref. */
  getCurrentIcons: () => PlayerIcon[];
  /** Full-width left-aligned trigger for the sidebar layout. */
  fullWidth?: boolean;
}

export function FormationMenu({ gameType, onSetGameType, onStamp, getCurrentIcons, fullWidth = false }: FormationMenuProps) {
  const [open, setOpen] = useState(false);
  const { isPro, loading: entitlementLoading } = useEntitlement();
  const [customFormations, setCustomFormations] = useState<FormationTemplate[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  // Position is computed from the trigger button's real screen location and
  // the popover is portaled to <body> as position:fixed — the toolbar row it
  // lives in scrolls horizontally (`overflow-x-auto`), which per the CSS
  // overflow spec forces overflow-y to `auto` too, so an `absolute`-positioned
  // popover nested inside that row gets silently clipped out of view instead
  // of showing (still clickable via automation, just invisible to a real
  // user — see B-24 follow-up).
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const templates = formationsFor(gameType);

  useEffect(() => {
    if (!open) return;
    const openedAt = Date.now();
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Clamp inside the viewport horizontally (w-56 popover on narrow
      // phones), and open upward when the trigger sits in the lower half —
      // on mobile the toolbar is at the bottom, so opening downward puts
      // the menu below the screen.
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 224 - 8));
      const openUp = rect.bottom > window.innerHeight / 2;
      setCoords(
        openUp
          ? { left, bottom: window.innerHeight - rect.top + 4 }
          : { left, top: rect.bottom + 4 },
      );
    };
    updatePosition();
    // The toolbar can scroll/resize (horizontal scroll row, mobile rotation);
    // close instead of leaving the popover pinned to a stale position. But a
    // scroll in the first moment after opening is typically the browser's
    // own "scroll the just-focused trigger into view" behavior inside the
    // horizontally-scrolling toolbar row (happens whenever the trigger isn't
    // already fully in view when clicked) — reposition instead of closing,
    // or the menu would flicker shut immediately after the click that opened
    // it whenever the trigger sits near the scrollable edge.
    const close = () => setOpen(false);
    const onScroll = () => {
      if (Date.now() - openedAt < 300) { updatePosition(); return; }
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Custom formations are a Pro feature — only fetch while the popover is
  // open (avoids a background request on every mount) and only for Pro
  // users (non-Pro see a locked upsell row instead of an empty section).
  useEffect(() => {
    if (!open || !isPro) { setCustomFormations([]); return; }
    let cancelled = false;
    loadCustomFormations(gameType)
      .then((rows) => { if (!cancelled) setCustomFormations(rows); })
      .catch((err) => { if (!cancelled) console.error('Failed to load custom formations:', err); });
    return () => { cancelled = true; };
  }, [open, isPro, gameType]);

  const handleSaveCurrent = async () => {
    if (!saveName.trim()) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const icons = getCurrentIcons();
      const saved = await saveCustomFormation(saveName.trim(), gameType, icons);
      setCustomFormations((prev) => [...prev, saved]);
      setSaveName('');
      setShowSaveInput(false);
    } catch (err) {
      setSaveError(getSafeErrorMessage(err, 'Could not save this formation.'));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    setCustomFormations((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteCustomFormation(id);
    } catch (err) {
      console.error('Failed to delete custom formation:', err);
    }
  };

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
          fullWidth ? 'w-full justify-start gap-2 px-2.5 py-2' : 'tap-target justify-center px-2.5 py-2 gap-1.5'
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
            className="fixed z-40 bg-board-light border border-chalk/20 rounded-xl shadow-2xl p-2 w-56 max-h-[60vh] overflow-y-auto"
            style={{ left: coords.left, top: coords.top, bottom: coords.bottom }}
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

            <div className="my-2 border-t border-chalk/10" />

            {isPro ? (
              <>
                <p className="text-[10px] uppercase tracking-wide text-chalk/40 px-1.5 pb-1">
                  Your Formations
                </p>
                {customFormations.length > 0 && (
                  <div className="flex flex-col gap-0.5 mb-1">
                    {customFormations.map((f) => (
                      <div key={f.id} className="flex items-center gap-1 group">
                        <button
                          onClick={() => {
                            onStamp(f.icons);
                            setOpen(false);
                          }}
                          className="flex-1 text-left px-2 py-1.5 rounded-lg text-sm text-chalk hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          {f.name}
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(f.id)}
                          title="Delete this formation"
                          className="p-1.5 rounded-lg text-chalk/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showSaveInput ? (
                  <div className="px-1.5 py-1 space-y-1.5" onPointerDown={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCurrent(); if (e.key === 'Escape') setShowSaveInput(false); }}
                      placeholder="Formation name"
                      className="w-full px-2 py-1 text-sm bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/40 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {saveError && <p className="text-[11px] text-red-400">{saveError}</p>}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleSaveCurrent}
                        disabled={saveBusy || !saveName.trim()}
                        className="flex-1 px-2 py-1 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                      >
                        {saveBusy ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setSaveError(null); }}
                        className="px-2 py-1 text-xs text-chalk/60 hover:text-chalk"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-sm text-chalk/70 hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Save current arrangement
                  </button>
                )}
              </>
            ) : (
              !entitlementLoading && (
                <button
                  onClick={() => { setOpen(false); setShowUpgradePrompt(true); }}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-sm text-chalk/50 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Save your own formations — Pro
                </button>
              )
            )}
          </div>
        </>,
        document.body,
      )}

      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Custom formations"
        description="Saving your own formations to reuse later is part of Playbuilder Pro ($39/yr)."
      />
    </div>
  );
}
