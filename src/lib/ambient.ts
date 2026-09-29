import type React from 'react';

/**
 * Ambient surface treatments shared by the marketing hero and the blog —
 * the "night game under the lights" vocabulary the brand tokens come from
 * (navy `board`, cream `chalk`, amber `stadium`).
 *
 * These are backgrounds only. `stadium` amber is an ambient/mood color by
 * rule (see tailwind.config.js) — never on an interactive element.
 */

/** Faint graph-paper grid, like a coach's printed play sheet, on navy. */
export const gridPaper: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(to right, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px),' +
    'repeating-linear-gradient(to bottom, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px)',
};

/** Two floodlight cones, like stadium light towers catching dust in the air
 *  over a night game — ambient only, never used for anything interactive. */
export const floodlights: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse 70% 60% at 10% -15%, rgba(232,163,61,0.38), transparent 65%),' +
    'radial-gradient(ellipse 70% 60% at 90% -15%, rgba(232,163,61,0.30), transparent 65%)',
};

/** Numeric forms of the values above, for SVG consumers (a `<pattern>` or
 *  `<radialGradient>` can't read a CSS `repeating-linear-gradient`). Same
 *  numbers as `gridPaper`/`floodlights` — change both or neither. */
export const GRID_PITCH_PX = 60;
export const GRID_LINE_COLOR = 'rgba(248,246,241,0.04)';
export const CONE_AMBER = '#E8A33D'; // `stadium` — ambient only, never interactive
export const CONE_ALPHA_PRIMARY = 0.38;
export const CONE_ALPHA_SECONDARY = 0.3;

/** Lit-turf field tone, for generated blog cover art's turf band. Not used
 *  by the live designer (fieldTheme: 'screen' is a shelved, unmerged
 *  feature — see CLAUDE.md) — this is a standalone value for decorative art. */
export const TURF_DARK = '#0F2A1E';
export const TURF_CHALK = 'rgba(248,246,241,0.55)';
