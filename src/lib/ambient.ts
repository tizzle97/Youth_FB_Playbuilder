import type React from 'react';

/**
 * Ambient surface treatments shared by the marketing hero and the designer's
 * canvas deck — the "night game under the lights" vocabulary the brand tokens
 * come from (navy `board`, cream `chalk`, amber `stadium`).
 *
 * These are backgrounds only. `stadium` amber is an ambient/mood color by
 * rule (see tailwind.config.js) — never on an interactive element.
 */

/** Faint graph-paper grid, like a coach's printed play sheet, on navy. */
export const GRID_PAPER_IMAGE =
  'repeating-linear-gradient(to right, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px),' +
  'repeating-linear-gradient(to bottom, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px)';

/** Two floodlight cones, like stadium light towers catching dust in the air
 *  over a night game. Bright enough to be the hero's signature. */
export const FLOODLIGHTS_IMAGE =
  'radial-gradient(ellipse 70% 60% at 10% -15%, rgba(232,163,61,0.38), transparent 65%),' +
  'radial-gradient(ellipse 70% 60% at 90% -15%, rgba(232,163,61,0.30), transparent 65%)';

/** One dim cone from the top edge for the designer's deck — the margin
 *  around the field. Much quieter than the hero pair on purpose: on this
 *  surface the lit turf is the subject, and a bright glow would compete. */
export const DECK_FLOODLIGHT_IMAGE =
  'radial-gradient(ellipse 90% 55% at 50% -20%, rgba(232,163,61,0.14), transparent 60%)';

export const gridPaper: React.CSSProperties = { backgroundImage: GRID_PAPER_IMAGE };
export const floodlights: React.CSSProperties = { backgroundImage: FLOODLIGHTS_IMAGE };

/** The designer deck: grid paper under a single dim floodlight. Applied to
 *  the scroll container, whose background stays put while a zoomed canvas
 *  pans across it. */
export const deck: React.CSSProperties = {
  backgroundImage: `${DECK_FLOODLIGHT_IMAGE}, ${GRID_PAPER_IMAGE}`,
};
