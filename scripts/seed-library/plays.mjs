// Content for the official starter play library (B-31). Each entry becomes
// one row in `plays`, owned by the official account, saved as a private
// draft for review before anyone flips it public.
//
// Coordinates mirror the conventions in src/components/designer/formations.ts
// (yards-from-LOS math, the same player-icon color palette) so these plays
// look like anything else in the app — not a separate visual language.
// These are original renditions of generic, decades-old public-domain route
// concepts (slants, mesh, four verts, power-O, etc.) — never traced from any
// commercial playbook product.

const FIELD_YARDS_ABOVE_LOS = 15;
const FIELD_YARDS_BELOW_LOS = 10;
const TOTAL_FIELD_YARDS = FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS;

// Yards behind the LOS (positive = backfield) -> normalized y. Mirrors
// Canvas.tsx's yFromYards / formations.ts's yBehindLOS exactly.
const yBehindLOS = (yardsBehindLOS) => (FIELD_YARDS_ABOVE_LOS + yardsBehindLOS) / TOTAL_FIELD_YARDS;
// Yards upfield (toward the opponent's end zone) -> normalized y.
const yUp = (yardsUpfield) => yBehindLOS(-yardsUpfield);
const LOS = yBehindLOS(0);

const C = { QB: '#3B82F6', RB: '#10B981', FB: '#F59E0B', WR: '#8B5CF6', TE: '#EC4899', OL: '#000000' };

const ol = (x, letter) => ({ x, y: LOS, letter, color: C.OL, shape: 'square' });
const wr = (x, letter, y = LOS) => ({ x, y, letter, color: C.WR, shape: 'circle' });

export const PLAYS = [
  // ---------------------------------------------------------------
  // Flag (5v5 / 7v7)
  // ---------------------------------------------------------------
  {
    name: 'Double Slants',
    icons: [
      ol(0.50, 'C'),
      { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      wr(0.15, 'WR1'),
      wr(0.85, 'WR2'),
      { x: 0.65, y: LOS, letter: 'WR3', color: '#6366F1', shape: 'circle' },
    ],
    paths: [
      { points: [{ x: 0.15, y: LOS }, { x: 0.32, y: yUp(5) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.85, y: LOS }, { x: 0.62, y: yUp(5) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.65, y: LOS }, { x: 0.85, y: yUp(1) }], color: '#6366F1', startIconIndex: 4, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Twins', difficulty: 'beginner',
      tags: ['slants', 'quick game', '5v5'],
      description: 'Two receivers break inside on quick slants while a third releases to the flat as a hot read — a simple, fast-hitting concept for beginners.',
    },
  },
  {
    name: 'Mesh',
    icons: [
      ol(0.50, 'C'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.40, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'),
      wr(0.30, 'WR2'),
      wr(0.70, 'WR3'),
      wr(0.94, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.06, y: LOS }, { x: 0.10, y: yUp(14) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.90, y: yUp(14) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
      { points: [{ x: 0.30, y: LOS }, { x: 0.30, y: yUp(2) }, { x: 0.68, y: yUp(2) }], color: C.WR, startIconIndex: 4, mode: 'waypoint' },
      { points: [{ x: 0.70, y: LOS }, { x: 0.70, y: yUp(2.5) }, { x: 0.32, y: yUp(2.5) }], color: C.WR, startIconIndex: 5, mode: 'waypoint' },
      { points: [{ x: 0.40, y: yBehindLOS(5) }, { x: 0.25, y: yBehindLOS(2) }], color: C.RB, startIconIndex: 2, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Twins', difficulty: 'intermediate',
      tags: ['mesh', 'crossers', '7v7'],
      description: 'Two receivers run shallow crossing routes underneath while the outside receivers clear out deep — classic mesh spacing with a checkdown built in.',
    },
  },
  {
    name: 'Trips Z-Curl',
    icons: [
      ol(0.50, 'C'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.38, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.08, 'X'),
      wr(0.62, 'WR2'),
      wr(0.76, 'Z'),
      wr(0.90, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.08, y: LOS }, { x: 0.12, y: yUp(14) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.62, y: LOS }, { x: 0.55, y: yUp(1) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
      { points: [{ x: 0.76, y: LOS }, { x: 0.78, y: yUp(9) }, { x: 0.74, y: yUp(8) }], color: C.WR, startIconIndex: 5, mode: 'waypoint' },
      { points: [{ x: 0.90, y: LOS }, { x: 0.95, y: yUp(12) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
      { points: [{ x: 0.38, y: yBehindLOS(5) }, { x: 0.25, y: yBehindLOS(2) }], color: C.RB, startIconIndex: 2, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Trips', difficulty: 'intermediate',
      tags: ['trips', 'curl', '7v7'],
      description: 'Trips to one side with the Z receiver settling into a curl for an easy completion — underneath and clearout routes occupy the rest of the defense.',
    },
  },

  // ---------------------------------------------------------------
  // 11v11
  // ---------------------------------------------------------------
  {
    name: 'Four Verts',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'),
      wr(0.22, 'WR2'),
      wr(0.78, 'WR3'),
      wr(0.94, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(14) }], color: C.WR, startIconIndex: 7, mode: 'straight' },
      { points: [{ x: 0.22, y: LOS }, { x: 0.28, y: yUp(14) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.78, y: LOS }, { x: 0.72, y: yUp(14) }], color: C.WR, startIconIndex: 9, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.94, y: yUp(14) }], color: C.WR, startIconIndex: 10, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Spread', difficulty: 'intermediate',
      tags: ['four verts', 'vertical stretch', '11v11'],
      description: 'Four receivers push vertically to stretch the defense deep — the running back stays in to protect while the quarterback reads the seams.',
    },
  },
  {
    name: 'Slant-Flat',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'),
      wr(0.94, 'WR2'),
      wr(0.20, 'WR3'),
    ],
    paths: [
      { points: [{ x: 0.80, y: LOS }, { x: 0.90, y: yUp(2) }], color: C.TE, startIconIndex: 7, mode: 'straight' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(14) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.75, y: yUp(5) }], color: C.WR, startIconIndex: 9, mode: 'straight' },
      { points: [{ x: 0.20, y: LOS }, { x: 0.35, y: yUp(2) }], color: C.WR, startIconIndex: 10, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Pro', difficulty: 'beginner',
      tags: ['slant-flat', 'quick game', '11v11'],
      description: 'A simple, fast-developing 2-man combo — the outside receiver runs a slant while the tight end releases to the flat behind it, giving the quarterback a high-low read.',
    },
  },
  {
    name: 'Power',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(7), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'),
      wr(0.94, 'WR2'),
    ],
    paths: [
      // Backside guard pulls to lead through the playside (right) gap.
      { points: [{ x: 0.60, y: LOS }, { x: 0.50, y: yUp(0.5) }, { x: 0.74, y: yUp(1) }], color: C.OL, startIconIndex: 3, mode: 'block' },
      { points: [{ x: 0.70, y: LOS }, { x: 0.66, y: yUp(1) }], color: C.OL, startIconIndex: 4, mode: 'block' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.74, y: yUp(1) }], color: C.TE, startIconIndex: 5, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(4) }, { x: 0.68, y: yUp(0.5) }], color: C.FB, startIconIndex: 7, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(7) }, { x: 0.52, y: yBehindLOS(4) }, { x: 0.65, y: yUp(3) }], color: C.RB, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'run', formation: 'I-Formation', difficulty: 'intermediate',
      tags: ['power', 'gap scheme', '11v11', 'run'],
      description: 'Classic Power-O: the backside guard pulls to lead through the hole while the fullback kicks out the edge defender, opening a downhill lane for the running back.',
    },
  },
];
