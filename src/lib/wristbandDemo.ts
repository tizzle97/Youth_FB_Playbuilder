import { renderScene } from './renderPlayScene';
import type { PathItem, PlayerIcon } from './renderPlayScene';

/**
 * Sample plays for the wristband preview (see components/WristbandPreview).
 *
 * Used only where the viewer has no plays of their own to show — the Pricing
 * page, and a signed-out or empty designer. Rendered by the same renderScene
 * the designer and every export use, so a preview built from these is a real
 * render of real play data, not a mockup or a screenshot that could drift.
 *
 * Flag-style looks throughout (no offensive line — receivers on the LOS, only
 * the QB behind it), matching how the app's own formations are drawn.
 */

// FIELD_YARDS_ABOVE_LOS / TOTAL_FIELD_YARDS — the LOS as a fraction of field
// height. Kept in sync with renderPlayScene's field window, same as
// HeroPlayCard does.
const LOS_Y = 17 / 30;

const INK = '#16283D';

/** Five-across flag set: snapper, QB, and three receivers on the LOS. */
const baseIcons = (): PlayerIcon[] => [
  { x: 0.5, y: LOS_Y, letter: 'C', color: INK },
  { x: 0.5, y: 0.72, letter: 'Q', color: INK },
  { x: 0.64, y: LOS_Y, letter: 'H', color: INK },
  { x: 0.78, y: LOS_Y, letter: 'Z', color: INK },
  { x: 0.9, y: LOS_Y, letter: 'X', color: INK },
];

const route = (startIconIndex: number, points: { x: number; y: number }[], mode: PathItem['mode'] = 'straight'): PathItem => ({
  points,
  color: '#1FA75D',
  startIconIndex,
  mode,
});

type DemoPlay = { name: string; icons: PlayerIcon[]; paths: PathItem[] };

const DEMO_PLAYS: DemoPlay[] = [
  {
    name: 'Trips Flood',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.6, y: 0.34 }]),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.44 }, { x: 0.92, y: 0.4 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.16 }], 'waypoint'),
    ],
  },
  {
    name: 'Double Slant',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.52, y: 0.4 }]),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.66, y: 0.36 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.46 }, { x: 0.98, y: 0.44 }]),
    ],
  },
  {
    name: 'Mesh',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.22, y: 0.48 }], 'waypoint'),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.36, y: 0.42 }], 'waypoint'),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.2 }]),
    ],
  },
  {
    name: 'Z Out',
    icons: baseIcons(),
    paths: [
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.38 }, { x: 0.94, y: 0.36 }]),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.64, y: 0.5 }, { x: 0.5, y: 0.48 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.86, y: 0.22 }], 'waypoint'),
    ],
  },
  {
    name: 'Corner Wheel',
    icons: baseIcons(),
    paths: [
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.82, y: 0.42 }, { x: 0.94, y: 0.18 }], 'waypoint'),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.3 }]),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.56, y: 0.52 }]),
    ],
  },
  {
    name: 'Center Screen',
    icons: baseIcons(),
    paths: [
      route(0, [{ x: 0.5, y: LOS_Y }, { x: 0.42, y: 0.62 }], 'waypoint'),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.64, y: 0.26 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.24 }]),
    ],
  },
  {
    name: 'Curl Flat',
    icons: baseIcons(),
    paths: [
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.32 }, { x: 0.72, y: 0.38 }], 'waypoint'),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.48 }, { x: 0.99, y: 0.46 }]),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.5, y: 0.44 }]),
    ],
  },
  {
    name: 'Post Dig',
    icons: baseIcons(),
    paths: [
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.3 }, { x: 0.74, y: 0.18 }]),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.36 }, { x: 0.58, y: 0.34 }]),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.64, y: 0.5 }]),
    ],
  },
  {
    name: 'Hitch Seam',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.64, y: 0.22 }]),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.46 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.46 }]),
    ],
  },
  {
    name: 'Drag Wheel',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.3, y: 0.5 }], 'waypoint'),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.96, y: 0.42 }, { x: 0.92, y: 0.2 }], 'waypoint'),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.68, y: 0.3 }]),
    ],
  },
  {
    name: 'Jet Sweep',
    icons: baseIcons(),
    paths: [
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.3, y: 0.66 }, { x: 0.16, y: 0.5 }], 'waypoint'),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.66, y: 0.36 }]),
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.9, y: 0.28 }]),
    ],
  },
  {
    name: 'Flood Corner',
    icons: baseIcons(),
    paths: [
      route(4, [{ x: 0.9, y: LOS_Y }, { x: 0.94, y: 0.2 }], 'waypoint'),
      route(3, [{ x: 0.78, y: LOS_Y }, { x: 0.78, y: 0.4 }, { x: 0.9, y: 0.36 }]),
      route(2, [{ x: 0.64, y: LOS_Y }, { x: 0.64, y: 0.54 }, { x: 0.78, y: 0.52 }]),
    ],
  },
];

/** Matches PlayDesigner's own thumbnail size (exportImage(660, 510)), so a
 *  demo cell and a real play's thumbnail land in the wristband at the same
 *  resolution. */
const THUMB_W = 660;
const THUMB_H = 510;

export type PreviewPlay = { name: string; image: string };

let cached: PreviewPlay[] | null = null;

/**
 * Render the sample plays to PNG data URIs, the same shape a saved play's
 * `thumbnail` has. Memoized — the result is identical every call and each
 * render is a full field draw.
 *
 * Returns names with empty images if a 2D context isn't available (jsdom, a
 * locked-down browser); generateWristbandHTML renders its own placeholder for
 * a falsy image, and text-only mode never needs one.
 */
export function demoWristbandPlays(): PreviewPlay[] {
  if (cached) return cached;
  cached = DEMO_PLAYS.map(({ name, icons, paths }) => {
    let image = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderScene(ctx, THUMB_W, THUMB_H, paths, icons);
        image = canvas.toDataURL('image/png');
      }
    } catch {
      // Leave the image empty — the sheet still renders with a placeholder.
    }
    return { name, image };
  });
  return cached;
}
