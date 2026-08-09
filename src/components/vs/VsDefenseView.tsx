import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Home, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';
import { renderOverlayScene, EXPORT_WIDTH, EXPORT_HEIGHT, type SceneLayer } from '../../lib/renderPlayScene';
import { Logo } from '../Logo';

// ---------------------------------------------
// Read-only "vs. defense" view: one offensive play with a defensive play drawn
// on top of it, and prev/next controls to cycle through the coach's saved
// defenses. Built for teaching quarterback reads — "here's Cover 2 against
// this concept, now here's man blitz; where do you throw?"
//
// Nothing here is editable and nothing is persisted. The two plays stay two
// separate rows in `plays`; they're only ever composited at render time by
// renderOverlayScene().
// ---------------------------------------------

type PlayRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  metadata: { gameType?: string } | null;
  canvas_data: string | null;
};

type DefenseEntry = { id: string; name: string; description: string | null; gameType?: string; scene: SceneLayer };

const EMPTY_SCENE: SceneLayer = { paths: [], playerIcons: [], zones: [], textBoxes: [] };

/**
 * Parse a plays.canvas_data blob into a drawable scene. Mirrors the defensive
 * parsing in PlayDesigner's load effect: every array is shape-checked
 * independently so one bad field can't blank a whole play. Returns null when
 * the JSON itself is unusable, which lets callers drop that play rather than
 * fail the page.
 */
function parseScene(canvasData: string | null): SceneLayer | null {
  try {
    const parsed = JSON.parse(canvasData || '{}');
    return {
      paths: Array.isArray(parsed.paths) ? parsed.paths : [],
      playerIcons: Array.isArray(parsed.playerIcons) ? parsed.playerIcons : [],
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      textBoxes: Array.isArray(parsed.textBoxes) ? parsed.textBoxes : [],
    };
  } catch {
    return null;
  }
}

export function VsDefenseView() {
  usePageMeta({
    title: 'Vs. Defense',
    description: 'View an offensive play against different defensive looks.',
    path: '/vs',
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const playId = searchParams.get('play');
  const defenseParam = searchParams.get('d');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offensePlay, setOffensePlay] = useState<PlayRow | null>(null);
  const [offenseScene, setOffenseScene] = useState<SceneLayer>(EMPTY_SCENE);
  const [defenses, setDefenses] = useState<DefenseEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showDefense, setShowDefense] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  const currentDefense = defenses[index] ?? null;

  // ── Load the offense and the deck of defenses ───────────────
  useEffect(() => {
    if (!playId) {
      setError('No play selected.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          navigate('/auth', { replace: true });
          return;
        }

        // The offense may be someone else's public play (RLS allows reading
        // those), but the defensive deck is always the signed-in coach's own.
        const [offenseRes, defenseRes] = await Promise.all([
          supabase
            .from('plays')
            .select('id, name, type, description, metadata, canvas_data')
            .eq('id', playId)
            .single(),
          supabase
            .from('plays')
            .select('id, name, type, description, metadata, canvas_data')
            .eq('user_id', user.id)
            .eq('type', 'defense')
            .order('name'),
        ]);
        if (cancelled) return;
        if (offenseRes.error) throw offenseRes.error;
        if (defenseRes.error) throw defenseRes.error;

        const offRow = offenseRes.data as PlayRow;
        const offScene = parseScene(offRow.canvas_data);
        if (!offScene) throw new Error('This play could not be opened (unrecognized format).');

        // Defenses whose game format matches the offense sort first, but no
        // play is excluded: metadata.gameType is optional and missing on older
        // rows, so filtering on it could silently empty the deck.
        const offFormat = offRow.metadata?.gameType;
        const deck: DefenseEntry[] = ((defenseRes.data ?? []) as PlayRow[])
          .map((row): DefenseEntry | null => {
            const scene = parseScene(row.canvas_data);
            if (!scene) return null;
            return {
              id: row.id,
              name: row.name || 'Untitled Defense',
              description: row.description,
              gameType: row.metadata?.gameType,
              scene,
            };
          })
          .filter((d): d is DefenseEntry => d !== null)
          .sort((a, b) => {
            const aMatch = offFormat && a.gameType === offFormat ? 0 : 1;
            const bMatch = offFormat && b.gameType === offFormat ? 0 : 1;
            return aMatch - bMatch || a.name.localeCompare(b.name);
          });

        setOffensePlay(offRow);
        setOffenseScene(offScene);
        setDefenses(deck);
        // Honour ?d= on first load / refresh so a specific matchup is linkable.
        const startAt = deck.findIndex((d) => d.id === defenseParam);
        setIndex(startAt >= 0 ? startAt : 0);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Vs. defense load error:', err);
        setError(getSafeErrorMessage(err, 'Failed to load play'));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // defenseParam is deliberately omitted: it's an output of cycling below,
    // and re-running the fetch on every arrow press would refetch the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId, navigate]);

  // ── Keep ?d= pointed at the visible defense ─────────────────
  useEffect(() => {
    if (!currentDefense) return;
    if (searchParams.get('d') === currentDefense.id) return;
    const next = new URLSearchParams(searchParams);
    next.set('d', currentDefense.id);
    // replace so Back leaves the view instead of walking the whole deck.
    setSearchParams(next, { replace: true });
  }, [currentDefense, searchParams, setSearchParams]);

  // ── Aspect-locked sizing, matching the designer/export ratio ─
  // Keyed on `loading` because the container lives past the loading/error
  // early-returns below — on the first pass containerRef is still null, so
  // observing then would silently leave the canvas at its default size.
  useEffect(() => {
    if (loading) return;
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxW = Math.max(280, el.clientWidth);
      const maxH = Math.max(280, el.clientHeight);
      const ratio = EXPORT_WIDTH / EXPORT_HEIGHT;
      const w = Math.min(maxW, maxH * ratio);
      setCanvasSize({ width: w, height: w / ratio });
    };
    const frame = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [loading]);

  // ── Draw ────────────────────────────────────────────────────
  const visibleDefenseScene = showDefense ? currentDefense?.scene ?? null : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Back the canvas at device resolution so diagrams stay sharp on the
    // tablet a coach is holding, then draw in CSS pixels.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasSize.width * dpr);
    canvas.height = Math.round(canvasSize.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderOverlayScene(ctx, canvasSize.width, canvasSize.height, offenseScene, visibleDefenseScene);
  }, [canvasSize, offenseScene, visibleDefenseScene]);

  // ── Cycling ─────────────────────────────────────────────────
  const deckLength = defenses.length;
  const step = useCallback((delta: number) => {
    if (deckLength < 2) return;
    setIndex((i) => (i + delta + deckLength) % deckLength);
  }, [deckLength]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack arrows while the coach is in the jump-to dropdown.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  // ── Dev-only test bridge (mirrors PlayDesigner's __PBP_TEST__) ─
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__PBP_VS_TEST__ = {
      getState: () => ({
        offenseIcons: offenseScene.playerIcons,
        defenseIcons: visibleDefenseScene?.playerIcons ?? [],
        defenseId: currentDefense?.id ?? null,
        deckLength: defenses.length,
        index,
        showDefense,
      }),
    };
    return () => { delete (window as any).__PBP_VS_TEST__; };
  }, [offenseScene, visibleDefenseScene, currentDefense, defenses.length, index, showDefense]);

  const ariaLabel = useMemo(() => {
    const off = offensePlay?.name ?? 'Play';
    return currentDefense && showDefense
      ? `${off} diagrammed against the defense ${currentDefense.name}`
      : `${off} diagrammed on a football field`;
  }, [offensePlay, currentDefense, showDefense]);

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-board flex items-center justify-center text-chalk/50">
        Loading…
      </div>
    );
  }

  if (error || !offensePlay) {
    return (
      <div className="fixed inset-0 bg-board flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-chalk/70">{error || 'That play could not be found.'}</p>
        <Link to="/plays" className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors">
          Back to My Plays
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-board overflow-hidden">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-board-light border-b border-chalk/10 px-3 py-2 flex items-center gap-2 z-30">
        <Link
          to="/plays"
          className="p-2 text-chalk/60 hover:text-chalk rounded-lg hover:bg-white/10"
          title="Back to My Plays"
        >
          <Home className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-1.5 mr-auto min-w-0">
          <Logo className="h-6 w-6 text-chalk shrink-0" />
          <span className="font-bold text-chalk text-sm sm:text-base truncate">
            {offensePlay.name}
            <span className="font-normal text-chalk/50 ml-1 text-xs hidden sm:inline">vs. defense</span>
          </span>
        </div>
        <button
          onClick={() => setShowDefense((v) => !v)}
          disabled={!currentDefense}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-board border border-chalk/20 text-chalk rounded-lg hover:bg-board-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={showDefense ? 'Hide the defense' : 'Show the defense'}
        >
          {showDefense ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="hidden sm:inline">{showDefense ? 'Hide defense' : 'Show defense'}</span>
        </button>
      </header>

      {/* ── CANVAS ─────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4">
        <canvas
          ref={canvasRef}
          id="vs-canvas"
          role="img"
          aria-label={ariaLabel}
          style={{ width: canvasSize.width, height: canvasSize.height }}
          className="rounded-lg shadow-lg"
        />
      </div>

      {/* ── CONTROLS ───────────────────────────────────────────── */}
      <footer className="shrink-0 bg-board-light border-t border-chalk/10 px-3 py-3 z-30">
        {defenses.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
            <p className="text-sm text-chalk/60">
              You haven&apos;t saved any defensive plays yet — create one to cycle defensive looks against this play.
            </p>
            <Link
              to="/designer"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
            >
              <Shield className="h-4 w-4" />
              Create a defense
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            <button
              onClick={() => step(-1)}
              disabled={defenses.length < 2}
              className="p-2 rounded-lg bg-board border border-chalk/20 text-chalk hover:bg-board-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous defense (←)"
              aria-label="Previous defense"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              {/* aria-live so a screen reader announces each new defense as
                  the coach cycles, since the canvas itself can't. */}
              <div id="vs-defense-label" aria-live="polite" className="truncate">
                <span className="text-chalk font-medium">{currentDefense?.name}</span>
                {currentDefense?.gameType && (
                  <span className="ml-2 text-xs text-chalk/50 border border-chalk/20 rounded px-1.5 py-0.5">
                    {currentDefense.gameType}
                  </span>
                )}
              </div>
              <div className="text-xs text-chalk/50 truncate">
                {index + 1} of {defenses.length}
                {currentDefense?.description ? ` · ${currentDefense.description}` : ''}
              </div>
            </div>

            {defenses.length > 1 && (
              <select
                value={currentDefense?.id ?? ''}
                onChange={(e) => {
                  const at = defenses.findIndex((d) => d.id === e.target.value);
                  if (at >= 0) setIndex(at);
                }}
                aria-label="Jump to a defense"
                className="hidden sm:block max-w-[14rem] px-2 py-2 text-sm bg-board border border-chalk/20 text-chalk rounded-lg"
              >
                {defenses.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => step(1)}
              disabled={defenses.length < 2}
              className="p-2 rounded-lg bg-board border border-chalk/20 text-chalk hover:bg-board-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next defense (→)"
              aria-label="Next defense"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
