import { PlayDiagramCard } from './PlayDiagramCard';
import type { PathItem, PlayerIcon } from '../lib/renderPlayScene';

/**
 * Homepage hero demo — a real play, rendered by the same renderScene the
 * designer uses (not a screenshot or mockup), with its routes drawing
 * themselves in once on mount. Closes the "no product demo" gap flagged in
 * MARKETING.md: this is the first thing a visitor sees of what the tool
 * actually produces.
 *
 * Sample: a 5v5/7v7 trips-right look (no offensive line, matching how flag
 * formations are actually drawn) — a 3-level flood to the trips side (slant,
 * out, flat). Receivers line up on the LOS (the field's "20" line, at
 * FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS of the height); only the QB sits
 * behind it. The snapper (C) has no route, same as a real snap.
 *
 * A thin wrapper over PlayDiagramCard (generalized for blog use — see
 * blogPlayScenes.ts) with this fixed sample and Hero's own mount-driven
 * choreography. Kept separate so the blog redesign can't touch this page's
 * render path or its smoke coverage.
 */
const LOS_Y = 17 / 30; // FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS, kept in sync with renderPlayScene's field

const DEMO_ICONS: PlayerIcon[] = [
  { x: 0.5, y: LOS_Y, letter: 'C', color: '#16283D' },
  { x: 0.5, y: 0.72, letter: 'Q', color: '#16283D' },
  { x: 0.62, y: LOS_Y, letter: 'H', color: '#16283D' },
  { x: 0.74, y: LOS_Y, letter: 'Z', color: '#16283D' },
  { x: 0.86, y: LOS_Y, letter: 'X', color: '#16283D' },
];

const DEMO_PATHS: PathItem[] = [
  {
    // H: slant
    startIconIndex: 2,
    color: '#1FA75D',
    mode: 'waypoint',
    points: [
      { x: 0.62, y: LOS_Y },
      { x: 0.55, y: 0.42 },
      { x: 0.46, y: 0.32 },
    ],
  },
  {
    // Z: out
    startIconIndex: 3,
    color: '#1FA75D',
    mode: 'waypoint',
    points: [
      { x: 0.74, y: LOS_Y },
      { x: 0.74, y: 0.45 },
      { x: 0.82, y: 0.4 },
    ],
  },
  {
    // X: flat
    startIconIndex: 4,
    color: '#1FA75D',
    mode: 'straight',
    points: [
      { x: 0.86, y: LOS_Y },
      { x: 0.86, y: 0.5 },
      { x: 0.94, y: 0.47 },
    ],
  },
];

type HeroPlayCardProps = {
  /** Delay before the card itself fades in ("lights on"). Routes start
   *  drawing CARD_FADE_MS after that, once the card has fully appeared —
   *  part of Hero's load choreography. */
  revealDelayMs?: number;
};

export function HeroPlayCard({ revealDelayMs = 0 }: HeroPlayCardProps) {
  return (
    <PlayDiagramCard
      icons={DEMO_ICONS}
      paths={DEMO_PATHS}
      label="Trips Rt · Flood"
      alt="Sample play diagram: trips right formation with a slant, out, and flat route flood, drawn in Playbuilder Pro"
      animate="mount"
      revealDelayMs={revealDelayMs}
    />
  );
}
