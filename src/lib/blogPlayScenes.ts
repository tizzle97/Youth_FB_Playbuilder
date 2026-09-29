import type { PathItem, PlayerIcon, Zone } from './renderPlayScene';

/**
 * Concept -> play-scene registry for diagrams embedded in blog posts (see
 * blogDiagrams.ts for how a post picks from these). Keyed by football
 * concept, not by post, so the same "flood" diagram can illustrate any post
 * that talks about flood.
 *
 * Most of these are COPIED (not imported) from src/lib/wristbandDemo.ts's
 * DEMO_PLAYS — real, reviewed plays from the seeded library (issue #89), on
 * the correct 17/30 LOS. Copied rather than imported because wristbandDemo.ts
 * is a generated file (`⚠ GENERATED FILE — do not hand-edit`,
 * scripts/extract-demo-plays.mjs can rewrite its contents/order), and this
 * registry needs a stable, independent set that won't silently change which
 * diagram a published post shows. `1-3-1-zone` and `route-tree` are
 * hand-authored here — nothing in the existing demo library covers them.
 */

export type PlayScene = {
  /** Caption shown above the diagram, in the designer's own voice. */
  label: string;
  /** The canvas's aria-label — a real sentence, not the bare label. */
  alt: string;
  icons: PlayerIcon[];
  paths: PathItem[];
  zones?: Zone[];
};

const LOS_Y = 17 / 30; // FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS — see renderPlayScene.ts

export const PLAY_SCENES: Record<string, PlayScene> = {
  flood: {
    label: 'Trips Rt · Flood',
    alt: 'Trips right formation with a three-level flood: slant, out, and flat routes to the same side',
    icons: [
      { x: 0.5, y: LOS_Y, letter: 'C', color: '#16283D' },
      { x: 0.5, y: 0.72, letter: 'Q', color: '#16283D' },
      { x: 0.62, y: LOS_Y, letter: 'H', color: '#16283D' },
      { x: 0.74, y: LOS_Y, letter: 'Z', color: '#16283D' },
      { x: 0.86, y: LOS_Y, letter: 'X', color: '#16283D' },
    ],
    paths: [
      { startIconIndex: 2, color: '#1FA75D', mode: 'waypoint', points: [{ x: 0.62, y: LOS_Y }, { x: 0.55, y: 0.42 }, { x: 0.46, y: 0.32 }] },
      { startIconIndex: 3, color: '#1FA75D', mode: 'waypoint', points: [{ x: 0.74, y: LOS_Y }, { x: 0.74, y: 0.45 }, { x: 0.82, y: 0.4 }] },
      { startIconIndex: 4, color: '#1FA75D', mode: 'straight', points: [{ x: 0.86, y: LOS_Y }, { x: 0.86, y: 0.5 }, { x: 0.94, y: 0.47 }] },
    ],
  },
  curl: {
    label: 'Trips · Z-Curl',
    alt: 'Trips formation with the Z receiver running a curl route back to the quarterback',
    icons: [
      { x: 0.5, y: 0.5667, letter: 'C', color: '#000000', shape: 'square' },
      { x: 0.5, y: 0.7333, letter: 'QB', color: '#3B82F6' },
      { x: 0.38, y: 0.7333, letter: 'RB', color: '#10B981' },
      { x: 0.08, y: 0.5667, letter: 'X', color: '#8B5CF6' },
      { x: 0.62, y: 0.5667, letter: 'WR2', color: '#8B5CF6' },
      { x: 0.76, y: 0.5667, letter: 'Z', color: '#8B5CF6' },
      { x: 0.9, y: 0.5667, letter: 'WR4', color: '#8B5CF6' },
    ],
    paths: [
      { startIconIndex: 3, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.08, y: 0.5667 }, { x: 0.12, y: 0.1 }] },
      { startIconIndex: 4, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.62, y: 0.5667 }, { x: 0.55, y: 0.5333 }] },
      { startIconIndex: 5, color: '#8B5CF6', mode: 'waypoint', points: [{ x: 0.76, y: 0.5667 }, { x: 0.78, y: 0.2667 }, { x: 0.74, y: 0.3 }] },
      { startIconIndex: 6, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.9, y: 0.5667 }, { x: 0.95, y: 0.1667 }] },
      { startIconIndex: 2, color: '#10B981', mode: 'straight', points: [{ x: 0.38, y: 0.7333 }, { x: 0.25, y: 0.6333 }] },
    ],
  },
  mesh: {
    label: 'Twins · Mesh',
    alt: 'Two receivers crossing underneath at shallow depth from opposite sides, passing close to each other in the middle',
    icons: [
      { x: 0.5, y: 0.5667, letter: 'C', color: '#000000', shape: 'square' },
      { x: 0.5, y: 0.7333, letter: 'QB', color: '#3B82F6' },
      { x: 0.4, y: 0.7333, letter: 'RB', color: '#10B981' },
      { x: 0.06, y: 0.5667, letter: 'WR1', color: '#8B5CF6' },
      { x: 0.3, y: 0.5667, letter: 'WR2', color: '#8B5CF6' },
      { x: 0.7, y: 0.5667, letter: 'WR3', color: '#8B5CF6' },
      { x: 0.94, y: 0.5667, letter: 'WR4', color: '#8B5CF6' },
    ],
    paths: [
      { startIconIndex: 3, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.06, y: 0.5667 }, { x: 0.1, y: 0.1 }] },
      { startIconIndex: 6, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.94, y: 0.5667 }, { x: 0.9, y: 0.1 }] },
      { startIconIndex: 4, color: '#8B5CF6', mode: 'waypoint', points: [{ x: 0.3, y: 0.5667 }, { x: 0.3, y: 0.5 }, { x: 0.68, y: 0.5 }] },
      { startIconIndex: 5, color: '#8B5CF6', mode: 'waypoint', points: [{ x: 0.7, y: 0.5667 }, { x: 0.7, y: 0.4833 }, { x: 0.32, y: 0.4833 }] },
      { startIconIndex: 2, color: '#10B981', mode: 'straight', points: [{ x: 0.4, y: 0.7333 }, { x: 0.25, y: 0.6333 }] },
    ],
  },
  'four-verts': {
    label: 'Spread · Four Verts',
    alt: 'Four receivers spread wide, all running vertical seam routes up the field',
    icons: [
      { x: 0.5, y: 0.5667, letter: 'C', color: '#000000', shape: 'square' },
      { x: 0.5, y: 0.7333, letter: 'QB', color: '#3B82F6' },
      { x: 0.4, y: 0.7333, letter: 'RB', color: '#10B981' },
      { x: 0.06, y: 0.5667, letter: 'WR1', color: '#8B5CF6' },
      { x: 0.28, y: 0.5667, letter: 'WR2', color: '#8B5CF6' },
      { x: 0.72, y: 0.5667, letter: 'WR3', color: '#8B5CF6' },
      { x: 0.94, y: 0.5667, letter: 'WR4', color: '#8B5CF6' },
    ],
    paths: [
      { startIconIndex: 3, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.06, y: 0.5667 }, { x: 0.06, y: 0.1333 }] },
      { startIconIndex: 4, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.28, y: 0.5667 }, { x: 0.32, y: 0.1333 }] },
      { startIconIndex: 5, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.72, y: 0.5667 }, { x: 0.68, y: 0.1333 }] },
      { startIconIndex: 6, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.94, y: 0.5667 }, { x: 0.94, y: 0.1333 }] },
    ],
  },
  'post-corner': {
    label: 'Spread · Post-Corner',
    alt: 'A double move: the receiver threatens a post route inside before breaking back out to the corner',
    icons: [
      { x: 0.5, y: 0.5667, letter: 'C', color: '#000000', shape: 'square' },
      { x: 0.5, y: 0.7, letter: 'QB', color: '#3B82F6' },
      { x: 0.35, y: 0.7, letter: 'RB', color: '#10B981' },
      { x: 0.15, y: 0.5667, letter: 'WR1', color: '#8B5CF6' },
      { x: 0.85, y: 0.5667, letter: 'WR2', color: '#8B5CF6' },
      { x: 0.65, y: 0.5667, letter: 'WR3', color: '#8B5CF6' },
      { x: 0.3, y: 0.5667, letter: 'WR4', color: '#8B5CF6' },
    ],
    paths: [
      { startIconIndex: 4, color: '#8B5CF6', mode: 'waypoint', points: [{ x: 0.85, y: 0.5667 }, { x: 0.78, y: 0.3667 }, { x: 0.92, y: 0.2333 }] },
      { startIconIndex: 3, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.15, y: 0.5667 }, { x: 0.1, y: 0.1667 }] },
      { startIconIndex: 2, color: '#10B981', mode: 'straight', points: [{ x: 0.35, y: 0.7 }, { x: 0.2, y: 0.6333 }] },
    ],
  },
  screen: {
    label: 'Trips · Center Screen',
    alt: 'Screen pass concept with the outside receivers running off the coverage and blocking downfield',
    icons: [
      { x: 0.5, y: 0.5667, letter: 'C', color: '#000000', shape: 'square' },
      { x: 0.5, y: 0.6667, letter: 'QB', color: '#3B82F6' },
      { x: 0.15, y: 0.5667, letter: 'WR1', color: '#8B5CF6' },
      { x: 0.85, y: 0.5667, letter: 'WR2', color: '#8B5CF6' },
      { x: 0.65, y: 0.5667, letter: 'WR3', color: '#8B5CF6' },
    ],
    paths: [
      { startIconIndex: 0, color: '#000000', mode: 'straight', points: [{ x: 0.5, y: 0.5667 }, { x: 0.5, y: 0.5 }] },
      { startIconIndex: 2, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.15, y: 0.5667 }, { x: 0.15, y: 0.2333 }] },
      { startIconIndex: 3, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.85, y: 0.5667 }, { x: 0.85, y: 0.2333 }] },
      { startIconIndex: 4, color: '#8B5CF6', mode: 'straight', points: [{ x: 0.65, y: 0.5667 }, { x: 0.4, y: 0.5 }] },
    ],
  },

  // Hand-authored — nothing in the demo library covers these.

  '1-3-1-zone': {
    label: 'Defense · 1-3-1 Zone',
    alt: '1-3-1 zone defense: one defender deep, three across underneath, one spying the flat',
    icons: [
      { x: 0.5, y: 0.22, letter: 'S', color: '#DC2626' },
      { x: 0.22, y: 0.45, letter: 'C1', color: '#DC2626' },
      { x: 0.5, y: 0.45, letter: 'LB', color: '#DC2626' },
      { x: 0.78, y: 0.45, letter: 'C2', color: '#DC2626' },
      { x: 0.5, y: 0.68, letter: 'R', color: '#DC2626' },
    ],
    paths: [],
    zones: [
      { iconIndex: 0, cx: 0.5, cy: 0.22, rx: 0.42, ry: 0.14, color: '#DC2626' },
      { iconIndex: 1, cx: 0.22, cy: 0.45, rx: 0.22, ry: 0.14, color: '#DC2626' },
      { iconIndex: 2, cx: 0.5, cy: 0.45, rx: 0.2, ry: 0.13, color: '#DC2626' },
      { iconIndex: 3, cx: 0.78, cy: 0.45, rx: 0.22, ry: 0.14, color: '#DC2626' },
      { iconIndex: 4, cx: 0.5, cy: 0.68, rx: 0.42, ry: 0.14, color: '#DC2626' },
    ],
  },
  'route-tree': {
    label: 'Route Tree · Go / Out / In / Curl',
    alt: 'Four receivers from one formation, each running a different basic route: go, out, in, and curl',
    icons: [
      { x: 0.5, y: LOS_Y, letter: 'C', color: '#16283D' },
      { x: 0.5, y: 0.72, letter: 'Q', color: '#16283D' },
      { x: 0.14, y: LOS_Y, letter: 'X', color: '#16283D' },
      { x: 0.38, y: LOS_Y, letter: 'H', color: '#16283D' },
      { x: 0.62, y: LOS_Y, letter: 'Y', color: '#16283D' },
      { x: 0.86, y: LOS_Y, letter: 'Z', color: '#16283D' },
    ],
    paths: [
      // X: go
      { startIconIndex: 2, color: '#1FA75D', mode: 'straight', points: [{ x: 0.14, y: LOS_Y }, { x: 0.14, y: 0.08 }] },
      // H: out
      { startIconIndex: 3, color: '#1FA75D', mode: 'waypoint', points: [{ x: 0.38, y: LOS_Y }, { x: 0.38, y: 0.32 }, { x: 0.24, y: 0.28 }] },
      // Y: in
      { startIconIndex: 4, color: '#1FA75D', mode: 'waypoint', points: [{ x: 0.62, y: LOS_Y }, { x: 0.62, y: 0.32 }, { x: 0.76, y: 0.28 }] },
      // Z: curl
      { startIconIndex: 5, color: '#1FA75D', mode: 'waypoint', points: [{ x: 0.86, y: LOS_Y }, { x: 0.86, y: 0.34 }, { x: 0.78, y: 0.42 }] },
    ],
  },
};

export type PlaySceneKey = keyof typeof PLAY_SCENES;
