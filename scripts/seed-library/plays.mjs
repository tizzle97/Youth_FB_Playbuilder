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

// 17-up/13-down (30-yard) universal field window as of 2026-07-23 — must
// match Canvas.tsx. Batches authored before that date were written against
// the old 25-yard window and were remapped in the DB by
// scripts/migrate-field-depth-2026-07.mjs; their source below is historical.
const FIELD_YARDS_ABOVE_LOS = 17;
const FIELD_YARDS_BELOW_LOS = 13;
const TOTAL_FIELD_YARDS = FIELD_YARDS_ABOVE_LOS + FIELD_YARDS_BELOW_LOS;

// Yards behind the LOS (positive = backfield) -> normalized y. Mirrors
// Canvas.tsx's yFromYards / formations.ts's yBehindLOS exactly.
const yBehindLOS = (yardsBehindLOS) => (FIELD_YARDS_ABOVE_LOS + yardsBehindLOS) / TOTAL_FIELD_YARDS;
// Yards upfield (toward the opponent's end zone) -> normalized y.
const yUp = (yardsUpfield) => yBehindLOS(-yardsUpfield);
const LOS = yBehindLOS(0);

const C = { QB: '#3B82F6', RB: '#10B981', FB: '#F59E0B', WR: '#8B5CF6', TE: '#EC4899', OL: '#000000' };
// Defensive roster colors mirror PlayerToolbar.tsx's defensivePlayers exactly.
const D = { D: '#F97316', LB: '#14B8A6', CB: '#84CC16', S: '#E11D48' };

const ol = (x, letter) => ({ x, y: LOS, letter, color: C.OL, shape: 'square' });
const wr = (x, letter, y = LOS) => ({ x, y, letter, color: C.WR, shape: 'circle' });
// Defenders are placed by yards upfield of the LOS (their side of the ball).
const dl = (x, yardsUp, letter) => ({ x, y: yUp(yardsUp), letter, color: D.D, shape: 'circle' });
const lb = (x, yardsUp, letter) => ({ x, y: yUp(yardsUp), letter, color: D.LB, shape: 'circle' });
const cb = (x, yardsUp, letter) => ({ x, y: yUp(yardsUp), letter, color: D.CB, shape: 'circle' });
const saf = (x, yardsUp, letter) => ({ x, y: yUp(yardsUp), letter, color: D.S, shape: 'circle' });
// Zone of responsibility ellipse, positioned by yards upfield of the LOS.
const zone = (iconIndex, cx, cyYardsUp, rx, ry, color) => ({ iconIndex, cx, cy: yUp(cyYardsUp), rx, ry, color });

// Batch 1 (2026-07-20 pilot, shipped and live — kept here for reference so
// the file stays a full record of the library; NOT exported, so re-running
// the pipeline never re-inserts it. run.mjs only ever inserts `PLAYS` below.
const PILOT_BATCH_2026_07_20 = [
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

// Batch 2 (2026-07-21): the remaining ~29 plays to complete the ~35-play
// starter library scope. This is what run.mjs actually inserts.
export const PLAYS = [
  // ---------------------------------------------------------------
  // 5v5 (batch 2)
  // ---------------------------------------------------------------
  {
    name: 'Center Screen (5v5)',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(3), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.15, 'WR1'), wr(0.85, 'WR2'), wr(0.65, 'WR3')],
    paths: [
      { points: [{ x: 0.50, y: LOS }, { x: 0.50, y: yUp(2) }], color: C.OL, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.15, y: LOS }, { x: 0.15, y: yUp(10) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.85, y: LOS }, { x: 0.85, y: yUp(10) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.65, y: LOS }, { x: 0.40, y: yUp(2) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'screen', formation: 'Trips', difficulty: 'beginner',
      tags: ['screen', 'center screen', '5v5'],
      description: 'The center releases after the snap for a screen pass while the receivers clear out deep and underneath — a simple way to get your best athlete the ball in space.',
    },
  },
  {
    name: 'Wheel Route',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.15, 'WR1'), wr(0.85, 'WR2'), { x: 0.35, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' }],
    paths: [
      { points: [{ x: 0.15, y: LOS }, { x: 0.65, y: yUp(2) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.85, y: LOS }, { x: 0.92, y: yUp(10) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.35, y: yBehindLOS(4) }, { x: 0.55, y: yUp(0.5) }, { x: 0.75, y: yUp(9) }], color: C.RB, startIconIndex: 4, mode: 'waypoint' },
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Weak', difficulty: 'intermediate',
      tags: ['wheel', 'running back route', '5v5'],
      description: 'The running back releases to the flat and turns the corner upfield along the sideline while the drag and clearout routes occupy underneath and deep defenders.',
    },
  },
  {
    name: 'Fade-Out',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(3), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.90, 'WR1'), wr(0.15, 'WR2'), wr(0.50, 'WR3')],
    paths: [
      { points: [{ x: 0.90, y: LOS }, { x: 0.96, y: yUp(12) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.15, y: LOS }, { x: 0.05, y: yUp(1) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.50, y: LOS }, { x: 0.30, y: yUp(2) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Spread', difficulty: 'beginner',
      tags: ['fade', 'sideline', '5v5'],
      description: "A simple fade up the sideline paired with a quick outlet — an easy first read for a young quarterback: throw the fade if it's open, check down if not.",
    },
  },
  {
    name: 'Motion Return',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.90, 'WR1'), wr(0.15, 'WR2'), wr(0.65, 'WR3')],
    paths: [
      { points: [{ x: 0.90, y: LOS }, { x: 0.30, y: LOS }, { x: 0.20, y: yUp(6) }], color: C.WR, startIconIndex: 2, mode: 'waypoint' },
      { points: [{ x: 0.15, y: LOS }, { x: 0.10, y: yUp(10) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.65, y: LOS }, { x: 0.80, y: yUp(2) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'trick', formation: 'Motion', difficulty: 'intermediate',
      tags: ['motion', 'jet', '5v5'],
      description: "A receiver motions across the formation before the snap to get a numbers advantage, then releases upfield — great against defenses that don't rotate with motion.",
    },
  },
  {
    name: 'Post-Wheel',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.15, 'WR1'), wr(0.85, 'WR2'), { x: 0.35, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' }],
    paths: [
      { points: [{ x: 0.85, y: LOS }, { x: 0.85, y: yUp(7) }, { x: 0.55, y: yUp(11) }], color: C.WR, startIconIndex: 3, mode: 'waypoint' },
      { points: [{ x: 0.35, y: yBehindLOS(4) }, { x: 0.55, y: yUp(0.5) }, { x: 0.80, y: yUp(6) }], color: C.RB, startIconIndex: 4, mode: 'waypoint' },
      { points: [{ x: 0.15, y: LOS }, { x: 0.10, y: yUp(10) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Weak', difficulty: 'intermediate',
      tags: ['post', 'wheel', 'high-low', '5v5'],
      description: 'A post-wheel combination on the same side creates a high-low read on the deep defender — post over the top, wheel underneath.',
    },
  },
  {
    name: 'Quick Out & Up',
    icons: [ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(3), letter: 'QB', color: C.QB, shape: 'circle' }, wr(0.15, 'WR1'), wr(0.85, 'WR2'), wr(0.50, 'WR3')],
    paths: [
      { points: [{ x: 0.15, y: LOS }, { x: 0.05, y: yUp(3) }], color: C.WR, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.85, y: LOS }, { x: 0.72, y: yUp(3) }, { x: 0.80, y: yUp(11) }], color: C.WR, startIconIndex: 3, mode: 'waypoint' },
      { points: [{ x: 0.50, y: LOS }, { x: 0.65, y: yUp(1) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Spread', difficulty: 'beginner',
      tags: ['out route', 'double move', '5v5'],
      description: 'A quick out on one side and a slant-and-go double move on the other give the quarterback a fast, easy completion or a shot over the top if the corner bites.',
    },
  },
  {
    name: '5v5 Man Coverage',
    type: 'defense',
    icons: [dl(0.5, 0.5, 'D'), cb(0.15, 1, 'CB1'), cb(0.85, 1, 'CB2'), lb(0.65, 2, 'LB1'), saf(0.35, 9, 'S1')],
    paths: [{ points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(3) }], color: D.D, startIconIndex: 0, mode: 'straight' }],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Man', difficulty: 'beginner',
      tags: ['man coverage', 'defense', '5v5'],
      description: 'Each defender locks onto a receiver in man coverage with a safety deep for help over the top — simple and effective for teams without complex defensive rules.',
    },
  },
  {
    name: '5v5 Cover 2 Zone',
    type: 'defense',
    icons: [dl(0.5, 0.5, 'D'), cb(0.15, 2, 'CB1'), cb(0.85, 2, 'CB2'), saf(0.30, 10, 'S1'), saf(0.70, 10, 'S2')],
    paths: [{ points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(3) }], color: D.D, startIconIndex: 0, mode: 'straight' }],
    zones: [
      zone(1, 0.15, 2, 0.15, 0.08, D.CB),
      zone(2, 0.85, 2, 0.15, 0.08, D.CB),
      zone(3, 0.30, 11, 0.20, 0.12, D.S),
      zone(4, 0.70, 11, 0.20, 0.12, D.S),
    ],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Cover 2', difficulty: 'intermediate',
      tags: ['cover 2', 'zone', 'defense', '5v5'],
      description: 'Two deep safeties split the field in half while the corners squat underneath — takes away the deep ball and forces short, contested throws.',
    },
  },
  {
    name: '5v5 Blitz',
    type: 'defense',
    icons: [dl(0.40, 0.5, 'D1'), dl(0.60, 0.5, 'D2'), cb(0.15, 2, 'CB1'), cb(0.85, 2, 'CB2'), saf(0.5, 10, 'S1')],
    paths: [
      { points: [{ x: 0.40, y: yUp(0.5) }, { x: 0.40, y: yUp(3.5) }], color: D.D, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.60, y: yUp(0.5) }, { x: 0.60, y: yUp(3.5) }], color: D.D, startIconIndex: 1, mode: 'straight' },
    ],
    zones: [zone(4, 0.5, 11, 0.35, 0.14, D.S)],
    metadata: {
      gameType: '5v5', playType: 'pass', formation: 'Blitz', difficulty: 'intermediate',
      tags: ['blitz', 'pressure', 'defense', '5v5'],
      description: 'Two rushers bring quick pressure while the corners play tight underneath and a single safety guards the deep middle — high risk, high reward against slower-developing routes.',
    },
  },

  // ---------------------------------------------------------------
  // 7v7 (batch 2)
  // ---------------------------------------------------------------
  {
    name: 'Center Screen (7v7)',
    icons: [
      ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.35, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'), wr(0.25, 'WR3'), wr(0.75, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.50, y: LOS }, { x: 0.50, y: yUp(2) }], color: C.OL, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(12) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.94, y: yUp(12) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
      { points: [{ x: 0.25, y: LOS }, { x: 0.45, y: yUp(2) }], color: C.WR, startIconIndex: 5, mode: 'straight' },
      { points: [{ x: 0.75, y: LOS }, { x: 0.55, y: yUp(2.5) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'screen', formation: 'Trips', difficulty: 'beginner',
      tags: ['screen', 'center screen', '7v7'],
      description: 'The center releases for a screen behind a wall of receivers clearing out and dragging across underneath — great against an aggressive pass rush.',
    },
  },
  {
    name: 'Four Verts (7v7)',
    icons: [
      ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.40, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.28, 'WR2'), wr(0.72, 'WR3'), wr(0.94, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(13) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.28, y: LOS }, { x: 0.32, y: yUp(13) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
      { points: [{ x: 0.72, y: LOS }, { x: 0.68, y: yUp(13) }], color: C.WR, startIconIndex: 5, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.94, y: yUp(13) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Spread', difficulty: 'intermediate',
      tags: ['four verts', 'vertical stretch', '7v7'],
      description: 'Four receivers push vertically to stretch a 7v7 secondary deep, with the running back staying in to help protect.',
    },
  },
  {
    name: 'Stick-Nod',
    icons: [
      ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.35, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.15, 'WR1'), wr(0.30, 'WR2'), wr(0.85, 'WR3'), wr(0.70, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.15, y: LOS }, { x: 0.10, y: yUp(12) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.30, y: LOS }, { x: 0.30, y: yUp(5) }, { x: 0.25, y: yUp(4.5) }], color: C.WR, startIconIndex: 4, mode: 'waypoint' },
      { points: [{ x: 0.85, y: LOS }, { x: 0.90, y: yUp(12) }], color: C.WR, startIconIndex: 5, mode: 'straight' },
      { points: [{ x: 0.70, y: LOS }, { x: 0.70, y: yUp(5) }, { x: 0.75, y: yUp(4.5) }], color: C.WR, startIconIndex: 6, mode: 'waypoint' },
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Doubles', difficulty: 'intermediate',
      tags: ['stick', 'nod', 'zone beater', '7v7'],
      description: 'Both inside receivers run stick routes with a head-nod to freeze zone defenders while the outside receivers clear vertically — a reliable zone-beater on third down.',
    },
  },
  {
    name: 'RB Swing Screen (7v7)',
    icons: [
      ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.60, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.10, 'WR1'), wr(0.90, 'WR2'), wr(0.30, 'WR3'), wr(0.70, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.60, y: yBehindLOS(4) }, { x: 0.85, y: yBehindLOS(2) }], color: C.RB, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.10, y: LOS }, { x: 0.10, y: yUp(10) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.90, y: LOS }, { x: 0.90, y: yUp(10) }], color: C.WR, startIconIndex: 4, mode: 'straight' },
      { points: [{ x: 0.30, y: LOS }, { x: 0.45, y: yUp(2) }], color: C.WR, startIconIndex: 5, mode: 'straight' },
      { points: [{ x: 0.70, y: LOS }, { x: 0.55, y: yUp(2) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'screen', formation: 'Spread', difficulty: 'beginner',
      tags: ['screen', 'running back', '7v7'],
      description: 'A simple swing screen to the running back with receivers clearing out — quick, safe, and effective against pressure.',
    },
  },
  {
    name: 'Post-Corner',
    icons: [
      ol(0.50, 'C'), { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.35, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.15, 'WR1'), wr(0.85, 'WR2'), wr(0.65, 'WR3'), wr(0.30, 'WR4'),
    ],
    paths: [
      { points: [{ x: 0.85, y: LOS }, { x: 0.78, y: yUp(6) }, { x: 0.92, y: yUp(10) }], color: C.WR, startIconIndex: 4, mode: 'waypoint' },
      { points: [{ x: 0.15, y: LOS }, { x: 0.10, y: yUp(12) }], color: C.WR, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.65, y: LOS }, { x: 0.45, y: yUp(2) }], color: C.WR, startIconIndex: 5, mode: 'straight' },
      { points: [{ x: 0.30, y: LOS }, { x: 0.50, y: yUp(2.5) }], color: C.WR, startIconIndex: 6, mode: 'straight' },
      { points: [{ x: 0.35, y: yBehindLOS(4) }, { x: 0.20, y: yBehindLOS(2) }], color: C.RB, startIconIndex: 2, mode: 'straight' },
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Spread', difficulty: 'advanced',
      tags: ['post-corner', 'double move', '7v7'],
      description: 'A post-corner double move looks like a post route before breaking back out to the corner — a big-play shot when the defensive back bites on the first move.',
    },
  },
  {
    name: '7v7 Cover 2 Zone',
    type: 'defense',
    icons: [dl(0.5, 0.5, 'D'), cb(0.10, 2, 'CB1'), cb(0.90, 2, 'CB2'), lb(0.35, 4, 'LB1'), lb(0.65, 4, 'LB2'), saf(0.30, 11, 'S1'), saf(0.70, 11, 'S2')],
    paths: [{ points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(3.5) }], color: D.D, startIconIndex: 0, mode: 'straight' }],
    zones: [
      zone(1, 0.10, 2, 0.14, 0.07, D.CB),
      zone(2, 0.90, 2, 0.14, 0.07, D.CB),
      zone(3, 0.35, 5, 0.16, 0.09, D.LB),
      zone(4, 0.65, 5, 0.16, 0.09, D.LB),
      zone(5, 0.30, 12, 0.22, 0.12, D.S),
      zone(6, 0.70, 12, 0.22, 0.12, D.S),
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Cover 2', difficulty: 'beginner',
      tags: ['cover 2', 'zone', 'defense', '7v7'],
      description: 'Corners and linebackers squat underneath while two safeties split the deep field in half — a sound, beginner-friendly zone shell.',
    },
  },
  {
    name: '7v7 Cover 3 Zone',
    type: 'defense',
    icons: [dl(0.5, 0.5, 'D'), cb(0.15, 10, 'CB1'), cb(0.85, 10, 'CB2'), lb(0.35, 3, 'LB1'), lb(0.65, 3, 'LB2'), saf(0.5, 11, 'S1')],
    paths: [{ points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(3.5) }], color: D.D, startIconIndex: 0, mode: 'straight' }],
    zones: [
      zone(1, 0.15, 10, 0.16, 0.12, D.CB),
      zone(2, 0.85, 10, 0.16, 0.12, D.CB),
      zone(3, 0.35, 4, 0.16, 0.09, D.LB),
      zone(4, 0.65, 4, 0.16, 0.09, D.LB),
      zone(5, 0.5, 12, 0.20, 0.12, D.S),
    ],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Cover 3', difficulty: 'intermediate',
      tags: ['cover 3', 'zone', 'defense', '7v7'],
      description: 'Three deep defenders split the field into thirds while two underneath defenders rob the short-to-intermediate middle — solid against vertical stretch concepts.',
    },
  },
  {
    name: '7v7 Man Blitz',
    type: 'defense',
    icons: [dl(0.40, 0.5, 'D1'), dl(0.60, 0.5, 'D2'), cb(0.10, 2, 'CB1'), cb(0.90, 2, 'CB2'), cb(0.30, 2, 'CB3'), lb(0.70, 2, 'LB1'), saf(0.5, 10, 'S1')],
    paths: [
      { points: [{ x: 0.40, y: yUp(0.5) }, { x: 0.40, y: yUp(3.5) }], color: D.D, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.60, y: yUp(0.5) }, { x: 0.60, y: yUp(3.5) }], color: D.D, startIconIndex: 1, mode: 'straight' },
    ],
    zones: [zone(6, 0.5, 11, 0.30, 0.13, D.S)],
    metadata: {
      gameType: '7v7', playType: 'pass', formation: 'Blitz', difficulty: 'advanced',
      tags: ['blitz', 'man coverage', 'defense', '7v7'],
      description: 'Man coverage across the board with a double A-gap style blitz and one deep safety — brings pressure fast but leaves no safety help underneath, so it lives and dies on the rush getting home.',
    },
  },

  // ---------------------------------------------------------------
  // 11v11 (batch 2)
  // ---------------------------------------------------------------
  {
    name: 'Iso',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(7), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'),
    ],
    paths: [
      { points: [{ x: 0.50, y: yBehindLOS(4) }, { x: 0.60, y: yUp(0.5) }], color: C.FB, startIconIndex: 7, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(7) }, { x: 0.52, y: yBehindLOS(4) }, { x: 0.60, y: yUp(3) }], color: C.RB, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'run', formation: 'I-Formation', difficulty: 'intermediate',
      tags: ['iso', 'isolation', 'run', '11v11'],
      description: 'The fullback leads through the hole to isolate and block a linebacker while the running back follows him downhill — a physical, straightforward power run.',
    },
  },
  {
    name: 'Inside Zone',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(3.5), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(6), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'),
    ],
    paths: [
      { points: [{ x: 0.60, y: LOS }, { x: 0.63, y: yUp(0.5) }], color: C.OL, startIconIndex: 3, mode: 'block' },
      { points: [{ x: 0.70, y: LOS }, { x: 0.73, y: yUp(0.5) }], color: C.OL, startIconIndex: 4, mode: 'block' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.83, y: yUp(0.5) }], color: C.TE, startIconIndex: 5, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(3.5) }, { x: 0.58, y: yUp(0.5) }], color: C.FB, startIconIndex: 7, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(6) }, { x: 0.55, y: yBehindLOS(3) }, { x: 0.62, y: yUp(3) }], color: C.RB, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'run', formation: 'I-Formation', difficulty: 'beginner',
      tags: ['inside zone', 'zone run', '11v11'],
      description: 'The playside line and tight end all step and block in the same direction, and the running back reads the first threat before picking his gap — the most common run scheme in modern football.',
    },
  },
  {
    name: 'Outside Zone (Stretch)',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(3.5), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(6), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'),
    ],
    paths: [
      { points: [{ x: 0.70, y: LOS }, { x: 0.80, y: yUp(0.5) }], color: C.OL, startIconIndex: 4, mode: 'block' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.90, y: yUp(0.5) }], color: C.TE, startIconIndex: 5, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(3.5) }, { x: 0.85, y: yUp(0.5) }], color: C.FB, startIconIndex: 7, mode: 'block' },
      { points: [{ x: 0.42, y: yBehindLOS(6) }, { x: 0.65, y: yBehindLOS(3) }, { x: 0.85, y: yUp(3) }], color: C.RB, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'run', formation: 'I-Formation', difficulty: 'intermediate',
      tags: ['outside zone', 'stretch', 'run', '11v11'],
      description: 'The line reaches and seals defenders toward the sideline while the running back stretches the play wide before picking a crease upfield.',
    },
  },
  {
    name: 'Counter',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(7), letter: 'RB', color: C.RB, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'),
    ],
    paths: [
      { points: [{ x: 0.40, y: LOS }, { x: 0.50, y: yUp(0.5) }, { x: 0.68, y: yUp(1) }], color: C.OL, startIconIndex: 1, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(4) }, { x: 0.60, y: yUp(0.5) }, { x: 0.72, y: yUp(1) }], color: C.FB, startIconIndex: 7, mode: 'block' },
      { points: [{ x: 0.50, y: yBehindLOS(7) }, { x: 0.42, y: yBehindLOS(5) }, { x: 0.55, y: yBehindLOS(2) }, { x: 0.68, y: yUp(3) }], color: C.RB, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'run', formation: 'I-Formation', difficulty: 'advanced',
      tags: ['counter', 'misdirection', 'run', '11v11'],
      description: "The running back steps opposite the play's direction before cutting back behind a pulling guard and fullback — the false step and misdirection freeze pursuing linebackers.",
    },
  },
  {
    name: 'Smash Concept',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'), wr(0.20, 'WR3'),
    ],
    paths: [
      { points: [{ x: 0.94, y: LOS }, { x: 0.90, y: yUp(5) }], color: C.WR, startIconIndex: 9, mode: 'straight' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.85, y: yUp(7) }, { x: 0.95, y: yUp(10) }], color: C.TE, startIconIndex: 7, mode: 'waypoint' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(13) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.20, y: LOS }, { x: 0.35, y: yUp(2) }], color: C.WR, startIconIndex: 10, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Pro', difficulty: 'intermediate',
      tags: ['smash', 'high-low', '11v11'],
      description: 'A short hitch underneath and a corner route over the top create a high-low read on the flat/deep defender — a staple concept against zone coverage.',
    },
  },
  {
    name: 'Levels',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'), wr(0.75, 'WR3'),
    ],
    paths: [
      { points: [{ x: 0.94, y: LOS }, { x: 0.94, y: yUp(5) }, { x: 0.60, y: yUp(5.5) }], color: C.WR, startIconIndex: 9, mode: 'waypoint' },
      { points: [{ x: 0.75, y: LOS }, { x: 0.75, y: yUp(10) }, { x: 0.45, y: yUp(10.5) }], color: C.WR, startIconIndex: 10, mode: 'waypoint' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(13) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.90, y: yUp(2) }], color: C.TE, startIconIndex: 7, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Pro', difficulty: 'intermediate',
      tags: ['levels', 'in-breaking', '11v11'],
      description: 'Two receivers run in-breaking routes at different depths on the same side, giving the quarterback an easy high-low read against man or zone.',
    },
  },
  {
    name: 'Mesh (11v11)',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.40, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'), wr(0.30, 'WR3'),
    ],
    paths: [
      { points: [{ x: 0.30, y: LOS }, { x: 0.30, y: yUp(2) }, { x: 0.65, y: yUp(2) }], color: C.WR, startIconIndex: 10, mode: 'waypoint' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.80, y: yUp(2.5) }, { x: 0.35, y: yUp(2.5) }], color: C.TE, startIconIndex: 7, mode: 'waypoint' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.10, y: yUp(13) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.90, y: yUp(13) }], color: C.WR, startIconIndex: 9, mode: 'straight' },
      { points: [{ x: 0.40, y: yBehindLOS(5) }, { x: 0.25, y: yBehindLOS(2) }], color: C.RB, startIconIndex: 6, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Spread', difficulty: 'intermediate',
      tags: ['mesh', 'crossers', '11v11'],
      description: 'Two receivers cross at a shallow depth underneath while the outside receivers clear out deep — the traffic from the crossing routes makes man coverage difficult to maintain.',
    },
  },
  {
    name: 'Play-Action Post-Wheel',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'),
    ],
    paths: [
      { points: [{ x: 0.50, y: yBehindLOS(4) }, { x: 0.50, y: yBehindLOS(2) }, { x: 0.75, y: yUp(0.5) }, { x: 0.90, y: yUp(8) }], color: C.RB, startIconIndex: 6, mode: 'waypoint' },
      { points: [{ x: 0.80, y: LOS }, { x: 0.80, y: yUp(7) }, { x: 0.55, y: yUp(11) }], color: C.TE, startIconIndex: 7, mode: 'waypoint' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(13) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
      { points: [{ x: 0.94, y: LOS }, { x: 0.98, y: yUp(11) }], color: C.WR, startIconIndex: 9, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'trick', formation: 'I-Formation', difficulty: 'advanced',
      tags: ['play action', 'post', 'wheel', '11v11'],
      description: 'A run fake freezes the linebackers while the tight end runs a post and the running back releases on a wheel route — timing and the run-fake sell are what make this work.',
    },
  },
  {
    name: 'RB Screen',
    icons: [
      ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
      { x: 0.80, y: LOS, letter: 'TE', color: C.TE, shape: 'circle' },
      wr(0.06, 'WR1'), wr(0.94, 'WR2'), wr(0.20, 'WR3'),
    ],
    paths: [
      { points: [{ x: 0.42, y: yBehindLOS(5) }, { x: 0.30, y: yBehindLOS(3) }, { x: 0.20, y: yBehindLOS(1) }], color: C.RB, startIconIndex: 6, mode: 'waypoint' },
      { points: [{ x: 0.40, y: LOS }, { x: 0.25, y: yUp(1) }], color: C.OL, startIconIndex: 1, mode: 'block' },
      { points: [{ x: 0.30, y: LOS }, { x: 0.15, y: yUp(1.5) }], color: C.OL, startIconIndex: 0, mode: 'block' },
      { points: [{ x: 0.06, y: LOS }, { x: 0.06, y: yUp(10) }], color: C.WR, startIconIndex: 8, mode: 'straight' },
    ],
    metadata: {
      gameType: '11v11', playType: 'screen', formation: 'Pro', difficulty: 'beginner',
      tags: ['screen', 'running back', '11v11'],
      description: 'The running back sets up behind a wall of releasing linemen for an easy completion in space — effective against an aggressive pass rush.',
    },
  },
  {
    name: 'Cover 2 Zone (11v11)',
    type: 'defense',
    icons: [
      dl(0.35, 0.5, 'D1'), dl(0.45, 0.5, 'D2'), dl(0.55, 0.5, 'D3'), dl(0.65, 0.5, 'D4'),
      lb(0.30, 3, 'LB1'), lb(0.5, 3.5, 'LB2'), lb(0.70, 3, 'LB3'),
      cb(0.10, 2, 'CB1'), cb(0.90, 2, 'CB2'),
      saf(0.30, 11, 'S1'), saf(0.70, 11, 'S2'),
    ],
    paths: [
      { points: [{ x: 0.35, y: yUp(0.5) }, { x: 0.35, y: yUp(2) }], color: D.D, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.45, y: yUp(0.5) }, { x: 0.45, y: yUp(2) }], color: D.D, startIconIndex: 1, mode: 'straight' },
      { points: [{ x: 0.55, y: yUp(0.5) }, { x: 0.55, y: yUp(2) }], color: D.D, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.65, y: yUp(0.5) }, { x: 0.65, y: yUp(2) }], color: D.D, startIconIndex: 3, mode: 'straight' },
    ],
    zones: [
      zone(7, 0.10, 2, 0.13, 0.07, D.CB),
      zone(8, 0.90, 2, 0.13, 0.07, D.CB),
      zone(4, 0.30, 4, 0.15, 0.08, D.LB),
      zone(5, 0.5, 4.5, 0.15, 0.08, D.LB),
      zone(6, 0.70, 4, 0.15, 0.08, D.LB),
      zone(9, 0.30, 12, 0.22, 0.12, D.S),
      zone(10, 0.70, 12, 0.22, 0.12, D.S),
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: '4-3 Cover 2', difficulty: 'beginner',
      tags: ['cover 2', 'zone', 'defense', '11v11'],
      description: 'A four-man rush with three linebackers underneath and two deep safeties splitting the field — a balanced, foundational zone defense for 11v11.',
    },
  },
  {
    name: 'Cover 3 Zone (11v11)',
    type: 'defense',
    icons: [
      dl(0.40, 0.5, 'D1'), dl(0.5, 0.5, 'D2'), dl(0.60, 0.5, 'D3'),
      lb(0.20, 3, 'LB1'), lb(0.40, 3.5, 'LB2'), lb(0.60, 3.5, 'LB3'), lb(0.80, 3, 'LB4'),
      cb(0.12, 10, 'CB1'), cb(0.88, 10, 'CB2'),
      saf(0.5, 12, 'S1'), saf(0.5, 6, 'S2'),
    ],
    paths: [
      { points: [{ x: 0.40, y: yUp(0.5) }, { x: 0.40, y: yUp(2) }], color: D.D, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(2) }], color: D.D, startIconIndex: 1, mode: 'straight' },
      { points: [{ x: 0.60, y: yUp(0.5) }, { x: 0.60, y: yUp(2) }], color: D.D, startIconIndex: 2, mode: 'straight' },
    ],
    zones: [
      zone(7, 0.12, 10, 0.15, 0.12, D.CB),
      zone(8, 0.88, 10, 0.15, 0.12, D.CB),
      zone(9, 0.5, 12, 0.20, 0.12, D.S),
      zone(3, 0.20, 4, 0.14, 0.08, D.LB),
      zone(4, 0.40, 4.5, 0.14, 0.08, D.LB),
      zone(5, 0.60, 4.5, 0.14, 0.08, D.LB),
      zone(6, 0.80, 4, 0.14, 0.08, D.LB),
      zone(10, 0.5, 6, 0.16, 0.09, D.S),
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: '3-4 Cover 3', difficulty: 'intermediate',
      tags: ['cover 3', 'zone', 'defense', '11v11'],
      description: 'Three deep defenders split the field into thirds, four underneath defenders rob the short-to-intermediate middle, and a robber safety spies the middle — good coverage for the deep ball while still supporting the run.',
    },
  },
  {
    name: 'Fire Zone Blitz',
    type: 'defense',
    icons: [
      dl(0.40, 0.5, 'D1'), dl(0.5, 0.5, 'D2'), dl(0.60, 0.5, 'D3'),
      lb(0.25, 1, 'LB1'), lb(0.75, 1, 'LB2'), lb(0.40, 3, 'LB3'), lb(0.60, 3, 'LB4'),
      cb(0.12, 9, 'CB1'), cb(0.88, 9, 'CB2'),
      saf(0.35, 12, 'S1'), saf(0.65, 12, 'S2'),
    ],
    paths: [
      { points: [{ x: 0.40, y: yUp(0.5) }, { x: 0.40, y: yUp(2) }], color: D.D, startIconIndex: 0, mode: 'straight' },
      { points: [{ x: 0.5, y: yUp(0.5) }, { x: 0.5, y: yUp(2) }], color: D.D, startIconIndex: 1, mode: 'straight' },
      { points: [{ x: 0.60, y: yUp(0.5) }, { x: 0.60, y: yUp(2) }], color: D.D, startIconIndex: 2, mode: 'straight' },
      { points: [{ x: 0.25, y: yUp(1) }, { x: 0.30, y: yUp(2.5) }], color: D.LB, startIconIndex: 3, mode: 'straight' },
      { points: [{ x: 0.75, y: yUp(1) }, { x: 0.70, y: yUp(2.5) }], color: D.LB, startIconIndex: 4, mode: 'straight' },
    ],
    zones: [
      zone(7, 0.12, 9, 0.15, 0.11, D.CB),
      zone(8, 0.88, 9, 0.15, 0.11, D.CB),
      zone(9, 0.35, 12, 0.20, 0.11, D.S),
      zone(10, 0.65, 12, 0.20, 0.11, D.S),
      zone(5, 0.40, 4, 0.16, 0.09, D.LB),
      zone(6, 0.60, 4, 0.16, 0.09, D.LB),
    ],
    metadata: {
      gameType: '11v11', playType: 'pass', formation: 'Fire Zone', difficulty: 'advanced',
      tags: ['blitz', 'fire zone', 'defense', '11v11'],
      description: 'Five rushers bring pressure while the two remaining linebackers drop into underneath zones behind them — disguises the blitz and still gets four defenders dropped into coverage.',
    },
  },
];
