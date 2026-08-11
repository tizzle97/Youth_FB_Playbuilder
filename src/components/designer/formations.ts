import type { PlayerIcon } from './Canvas';
import { FIELD_YARDS_ABOVE_LOS, TOTAL_FIELD_YARDS } from './Canvas';
import type { PlayMetadata } from '../../types/play';

// Formation templates (B-24): curated starting positions coaches can stamp
// onto the canvas instead of hand-placing every icon. Coordinates are
// authored relative to the line of scrimmage using the same math Canvas.tsx
// uses to render it (yFromYards), so a template lands on the field exactly
// where a hand-placed icon would.
//
// Every icon then sits one yard further back than its authored alignment
// (2026-08-11): the front line starts a yard off the ball instead of straddling
// it, and everything behind shifts with it, so relative spacing is unchanged.
// Applied here rather than in each template so the numbers below stay readable
// as plain yards behind the LOS. This only affects newly stamped formations —
// plays already saved keep the coordinates they were saved with.
const TEMPLATE_SETBACK_YARDS = 1;

const yBehindLOS = (yardsBehindLOS: number) =>
  (FIELD_YARDS_ABOVE_LOS + yardsBehindLOS + TEMPLATE_SETBACK_YARDS) / TOTAL_FIELD_YARDS;

/** The front line — on the ball, plus the shared setback above. */
const LINE_Y = yBehindLOS(0);

// Colors reuse the app's existing player-icon palette (PlayerToolbar.tsx /
// PlayerStyleEditor.tsx's SWATCH_COLORS) so stamped icons look like ones a
// coach placed by hand, not a separate visual language.
const C = { QB: '#3B82F6', RB: '#10B981', FB: '#F59E0B', WR: '#8B5CF6', TE: '#EC4899', OL: '#000000', SLOT: '#6366F1' };

const ol = (x: number, letter: string): PlayerIcon => ({ x, y: LINE_Y, letter, color: C.OL, shape: 'square' });
const wr = (x: number, letter: string, y = LINE_Y, color = C.WR): PlayerIcon => ({ x, y, letter, color, shape: 'circle' });

export type FormationTemplate = {
  id: string;
  name: string;
  gameType: PlayMetadata['gameType'];
  /** All curated templates are offensive alignments — see B-24 scope. */
  playType: 'offense';
  icons: PlayerIcon[];
};

// ---------------------------------------------
// 11v11 (five-man line + six skill/backfield players)
// ---------------------------------------------
const line11 = [ol(0.30, 'LT'), ol(0.40, 'LG'), ol(0.50, 'C'), ol(0.60, 'RG'), ol(0.70, 'RT')];

const FORMATIONS_11V11: FormationTemplate[] = [
  {
    id: '11v11-i-formation',
    name: 'I-Formation',
    gameType: '11v11',
    playType: 'offense',
    icons: [
      ...line11,
      wr(0.80, 'TE', LINE_Y, C.TE),
      wr(0.10, 'WR'),
      wr(0.90, 'WR'),
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(7), letter: 'RB', color: C.RB, shape: 'circle' },
    ],
  },
  {
    id: '11v11-shotgun',
    name: 'Shotgun',
    gameType: '11v11',
    playType: 'offense',
    icons: [
      ...line11,
      wr(0.80, 'TE', LINE_Y, C.TE),
      wr(0.06, 'WR'),
      wr(0.18, 'WR'),
      wr(0.94, 'WR'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.40, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
    ],
  },
  {
    id: '11v11-spread',
    name: 'Spread',
    gameType: '11v11',
    playType: 'offense',
    icons: [
      ...line11,
      wr(0.06, 'WR'),
      wr(0.20, 'WR'),
      wr(0.80, 'WR'),
      wr(0.94, 'WR'),
      { x: 0.50, y: yBehindLOS(5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.40, y: yBehindLOS(5), letter: 'RB', color: C.RB, shape: 'circle' },
    ],
  },
  {
    id: '11v11-wing-t',
    name: 'Wing-T',
    gameType: '11v11',
    playType: 'offense',
    icons: [
      ...line11,
      wr(0.80, 'TE', LINE_Y, C.TE),
      { x: 0.86, y: yBehindLOS(1), letter: 'WR', color: C.SLOT, shape: 'circle' }, // wingback, tight off the LOS
      wr(0.10, 'WR'),
      { x: 0.50, y: yBehindLOS(1.5), letter: 'QB', color: C.QB, shape: 'circle' },
      { x: 0.50, y: yBehindLOS(4), letter: 'FB', color: C.FB, shape: 'circle' },
      { x: 0.42, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
    ],
  },
];

// ---------------------------------------------
// Flag formations (7v7 / 5v5): no offensive line — every player is
// eligible, so a snapping "C" is the only square, and the rest are WRs.
// ---------------------------------------------
function flagFormation(
  id: string,
  name: string,
  gameType: '5v5' | '6v6' | '7v7',
  receivers: PlayerIcon[],
  extras: PlayerIcon[] = [],
): FormationTemplate {
  return {
    id,
    name,
    gameType,
    playType: 'offense',
    icons: [
      ol(0.50, 'C'),
      { x: 0.50, y: yBehindLOS(4), letter: 'QB', color: C.QB, shape: 'circle' },
      ...receivers,
      ...extras,
    ],
  };
}

const FORMATIONS_7V7: FormationTemplate[] = [
  flagFormation('7v7-trips', 'Trips', '7v7', [
    wr(0.10, 'WR1'), wr(0.25, 'WR2'),
    wr(0.65, 'WR3'), wr(0.78, 'WR4'), wr(0.90, 'WR5'),
  ]),
  flagFormation('7v7-bunch', 'Bunch', '7v7', [
    wr(0.15, 'WR1'),
    wr(0.70, 'WR2'), { x: 0.75, y: yBehindLOS(0.5), letter: 'WR3', color: C.WR, shape: 'circle' }, wr(0.80, 'WR4'),
  ], [
    { x: 0.40, y: yBehindLOS(4), letter: 'RB', color: C.RB, shape: 'circle' },
  ]),
  flagFormation('7v7-twins', 'Twins', '7v7', [
    wr(0.15, 'WR1'), wr(0.30, 'WR2'),
    wr(0.70, 'WR3'), wr(0.85, 'WR4'),
  ], [
    { x: 0.50, y: yBehindLOS(6), letter: 'RB', color: C.RB, shape: 'circle' },
  ]),
];

const FORMATIONS_6V6: FormationTemplate[] = [
  flagFormation('6v6-trips', 'Trips', '6v6', [
    wr(0.10, 'WR1'), wr(0.25, 'WR2'),
    wr(0.75, 'WR3'), wr(0.90, 'WR4'),
  ]),
  flagFormation('6v6-bunch', 'Bunch', '6v6', [
    wr(0.15, 'WR1'),
    wr(0.72, 'WR2'), { x: 0.78, y: yBehindLOS(0.5), letter: 'WR3', color: C.WR, shape: 'circle' }, wr(0.84, 'WR4'),
  ]),
  flagFormation('6v6-twins', 'Twins', '6v6', [
    wr(0.15, 'WR1'), wr(0.30, 'WR2'),
    wr(0.75, 'WR3'),
  ], [
    { x: 0.50, y: yBehindLOS(6), letter: 'RB', color: C.RB, shape: 'circle' },
  ]),
];

const FORMATIONS_5V5: FormationTemplate[] = [
  flagFormation('5v5-trips', 'Trips', '5v5', [
    wr(0.65, 'WR1'), wr(0.78, 'WR2'), wr(0.90, 'WR3'),
  ]),
  flagFormation('5v5-bunch', 'Bunch', '5v5', [
    wr(0.68, 'WR1'), { x: 0.74, y: yBehindLOS(0.5), letter: 'WR2', color: C.WR, shape: 'circle' }, wr(0.80, 'WR3'),
  ]),
  flagFormation('5v5-twins', 'Twins', '5v5', [
    wr(0.15, 'WR1'),
    wr(0.75, 'WR2'), wr(0.88, 'WR3'),
  ]),
];

export const FORMATION_TEMPLATES: FormationTemplate[] = [
  ...FORMATIONS_11V11,
  ...FORMATIONS_7V7,
  ...FORMATIONS_6V6,
  ...FORMATIONS_5V5,
];

export function formationsFor(gameType: PlayMetadata['gameType']): FormationTemplate[] {
  return FORMATION_TEMPLATES.filter((f) => f.gameType === gameType);
}
