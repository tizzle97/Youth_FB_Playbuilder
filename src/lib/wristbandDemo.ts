import { renderScene } from './renderPlayScene';
import type { PathItem, PlayerIcon } from './renderPlayScene';

/**
 * Sample plays for the wristband preview (see components/WristbandPreview).
 *
 * ⚠ GENERATED FILE — do not hand-edit the DEMO_PLAYS data below.
 * Regenerate with:  node scripts/extract-demo-plays.mjs
 *
 * These are a curated flag-football slice of the real seeded play library
 * (issue #89), pulled from the official plays published under
 * system@playbook.pro — genuine formations and route concepts rather than
 * approximations written for a mockup. A snapshot rather than a live query so
 * the Pricing page renders instantly, signed-out and offline, and so the
 * smoke tests are deterministic.
 *
 * Used only where the viewer has no plays of their own to show (the Pricing
 * page, and a signed-out or nearly-empty designer). Rendered by the same
 * renderScene the designer and every export use, so a preview built from
 * these is a real render of real play data.
 */

type DemoPlay = { name: string; icons: PlayerIcon[]; paths: PathItem[] };

const DEMO_PLAYS: DemoPlay[] = [
  {
    // 5v5 · Twins
    name: "Double Slants",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.65,"y":0.5667,"letter":"WR3","color":"#6366F1","shape":"circle"}],
    paths: [{"points":[{"x":0.65,"y":0.5667},{"x":0.85,"y":0.5333}],"color":"#6366F1","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.85,"y":0.5667},{"x":0.8498,"y":0.48},{"x":0.6884,"y":0.4007}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.15,"y":0.5667},{"x":0.153,"y":0.4724},{"x":0.2868,"y":0.4035}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"}],
  },
  {
    // 7v7 · Trips
    name: "Trips Z-Curl",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7333,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.38,"y":0.7333,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.08,"y":0.5667,"letter":"X","color":"#8B5CF6","shape":"circle"},{"x":0.62,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.76,"y":0.5667,"letter":"Z","color":"#8B5CF6","shape":"circle"},{"x":0.9,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.08,"y":0.5667},{"x":0.12,"y":0.1}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.62,"y":0.5667},{"x":0.55,"y":0.5333}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.76,"y":0.5667},{"x":0.78,"y":0.2667},{"x":0.74,"y":0.3}],"color":"#8B5CF6","startIconIndex":5,"mode":"waypoint"},{"points":[{"x":0.9,"y":0.5667},{"x":0.95,"y":0.1667}],"color":"#8B5CF6","startIconIndex":6,"mode":"straight"},{"points":[{"x":0.38,"y":0.7333},{"x":0.25,"y":0.6333}],"color":"#10B981","startIconIndex":2,"mode":"straight"}],
  },
  {
    // 5v5 · Spread
    name: "Quick Out & Up",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.6667,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.325,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.85,"y":0.5667},{"x":0.72,"y":0.4667},{"x":0.8,"y":0.2}],"color":"#8B5CF6","startIconIndex":3,"mode":"waypoint"},{"points":[{"x":0.325,"y":0.5667},{"x":0.3243,"y":0.4656},{"x":0.4299,"y":0.4675}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.15,"y":0.5667},{"x":0.1541,"y":0.4594},{"x":0.0526,"y":0.4596}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"}],
  },
  {
    // 7v7 · Doubles
    name: "Stick-Nod",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.35,"y":0.7,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.3,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"},{"x":0.7,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.15,"y":0.5667},{"x":0.1,"y":0.1667}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.3,"y":0.5667},{"x":0.3,"y":0.4},{"x":0.25,"y":0.4167}],"color":"#8B5CF6","startIconIndex":4,"mode":"waypoint"},{"points":[{"x":0.85,"y":0.5667},{"x":0.9,"y":0.1667}],"color":"#8B5CF6","startIconIndex":5,"mode":"straight"},{"points":[{"x":0.7,"y":0.5667},{"x":0.7,"y":0.4},{"x":0.75,"y":0.4167}],"color":"#8B5CF6","startIconIndex":6,"mode":"waypoint"}],
  },
  {
    // 5v5 · Weak
    name: "Post-Wheel",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.35,"y":0.7,"letter":"RB","color":"#10B981","shape":"circle"}],
    paths: [{"points":[{"x":0.85,"y":0.5667},{"x":0.85,"y":0.3333},{"x":0.55,"y":0.2}],"color":"#8B5CF6","startIconIndex":3,"mode":"waypoint"},{"points":[{"x":0.15,"y":0.5667},{"x":0.1,"y":0.2333}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"},{"points":[{"x":0.35,"y":0.7},{"x":0.7037,"y":0.6301},{"x":0.8887,"y":0.4207},{"x":0.9044,"y":0.2148}],"color":"#10B981","startIconIndex":4,"mode":"waypoint"}],
  },
  {
    // 7v7 · Twins
    name: "Mesh",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7333,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.4,"y":0.7333,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.06,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.3,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.7,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"},{"x":0.94,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.06,"y":0.5667},{"x":0.1,"y":0.1}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.94,"y":0.5667},{"x":0.9,"y":0.1}],"color":"#8B5CF6","startIconIndex":6,"mode":"straight"},{"points":[{"x":0.3,"y":0.5667},{"x":0.3,"y":0.5},{"x":0.68,"y":0.5}],"color":"#8B5CF6","startIconIndex":4,"mode":"waypoint"},{"points":[{"x":0.7,"y":0.5667},{"x":0.7,"y":0.4833},{"x":0.32,"y":0.4833}],"color":"#8B5CF6","startIconIndex":5,"mode":"waypoint"},{"points":[{"x":0.4,"y":0.7333},{"x":0.25,"y":0.6333}],"color":"#10B981","startIconIndex":2,"mode":"straight"}],
  },
  {
    // 5v5 · Motion
    name: "Motion Return",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.9,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.65,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.15,"y":0.5667},{"x":0.1,"y":0.2333}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.65,"y":0.5667},{"x":0.8,"y":0.5}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.9,"y":0.5667},{"x":0.8721,"y":0.6184},{"x":0.3209,"y":0.6096},{"x":0.2465,"y":0.4696}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"}],
  },
  {
    // 5v5 · Trips
    name: "Center Screen",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.6667,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.65,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.5,"y":0.5667},{"x":0.5,"y":0.5}],"color":"#000000","startIconIndex":0,"mode":"straight"},{"points":[{"x":0.15,"y":0.5667},{"x":0.15,"y":0.2333}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"},{"points":[{"x":0.85,"y":0.5667},{"x":0.85,"y":0.2333}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.65,"y":0.5667},{"x":0.4,"y":0.5}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"}],
  },
  {
    // 7v7 · Spread
    name: "Four Verts",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7333,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.4,"y":0.7333,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.06,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.28,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.72,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"},{"x":0.94,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.06,"y":0.5667},{"x":0.06,"y":0.1333}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.28,"y":0.5667},{"x":0.32,"y":0.1333}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.72,"y":0.5667},{"x":0.68,"y":0.1333}],"color":"#8B5CF6","startIconIndex":5,"mode":"straight"},{"points":[{"x":0.94,"y":0.5667},{"x":0.94,"y":0.1333}],"color":"#8B5CF6","startIconIndex":6,"mode":"straight"}],
  },
  {
    // 5v5 · Weak
    name: "Wheel Route",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.35,"y":0.7,"letter":"RB","color":"#10B981","shape":"circle"}],
    paths: [{"points":[{"x":0.15,"y":0.5667},{"x":0.65,"y":0.5}],"color":"#8B5CF6","startIconIndex":2,"mode":"straight"},{"points":[{"x":0.85,"y":0.5667},{"x":0.92,"y":0.2333}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.35,"y":0.7},{"x":0.7366,"y":0.6389},{"x":0.8249,"y":0.3872}],"color":"#10B981","startIconIndex":4,"mode":"waypoint"}],
  },
  {
    // 7v7 · Spread
    name: "Post-Corner",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.35,"y":0.7,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.15,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.85,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.65,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"},{"x":0.3,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.85,"y":0.5667},{"x":0.78,"y":0.3667},{"x":0.92,"y":0.2333}],"color":"#8B5CF6","startIconIndex":4,"mode":"waypoint"},{"points":[{"x":0.15,"y":0.5667},{"x":0.1,"y":0.1667}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.35,"y":0.7},{"x":0.2,"y":0.6333}],"color":"#10B981","startIconIndex":2,"mode":"straight"},{"points":[{"x":0.3,"y":0.5667},{"x":0.3013,"y":0.497},{"x":0.4144,"y":0.4189}],"color":"#8B5CF6","startIconIndex":6,"mode":"straight"},{"points":[{"x":0.65,"y":0.5667},{"x":0.6509,"y":0.494},{"x":0.558,"y":0.4248}],"color":"#8B5CF6","startIconIndex":5,"mode":"straight"}],
  },
  {
    // 7v7 · Spread
    name: "RB Swing Screen",
    icons: [{"x":0.5,"y":0.5667,"letter":"C","color":"#000000","shape":"square"},{"x":0.5,"y":0.7,"letter":"QB","color":"#3B82F6","shape":"circle"},{"x":0.6,"y":0.7,"letter":"RB","color":"#10B981","shape":"circle"},{"x":0.1,"y":0.5667,"letter":"WR1","color":"#8B5CF6","shape":"circle"},{"x":0.9,"y":0.5667,"letter":"WR2","color":"#8B5CF6","shape":"circle"},{"x":0.3,"y":0.5667,"letter":"WR3","color":"#8B5CF6","shape":"circle"},{"x":0.7,"y":0.5667,"letter":"WR4","color":"#8B5CF6","shape":"circle"}],
    paths: [{"points":[{"x":0.6,"y":0.7},{"x":0.85,"y":0.6333}],"color":"#10B981","startIconIndex":2,"mode":"straight"},{"points":[{"x":0.1,"y":0.5667},{"x":0.1,"y":0.2333}],"color":"#8B5CF6","startIconIndex":3,"mode":"straight"},{"points":[{"x":0.9,"y":0.5667},{"x":0.9,"y":0.2333}],"color":"#8B5CF6","startIconIndex":4,"mode":"straight"},{"points":[{"x":0.3,"y":0.5667},{"x":0.45,"y":0.5}],"color":"#8B5CF6","startIconIndex":5,"mode":"straight"},{"points":[{"x":0.7,"y":0.5667},{"x":0.55,"y":0.5}],"color":"#8B5CF6","startIconIndex":6,"mode":"straight"}],
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
