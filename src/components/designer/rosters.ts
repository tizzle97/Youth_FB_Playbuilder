import type { IconShape } from './Canvas';
import type { PlayType } from './DesignerToolbar';
import { MAX_PLAYER_LABEL_LENGTH } from './PlayerStyleEditor';

/**
 * The built-in toolbar rosters, and the merge that lets a coach override them.
 *
 * Chips carry a stable `id` rather than being identified by their label: a
 * coach can rename two chips to the same thing, which would otherwise collide
 * as React keys and make both highlight when either is selected. The id also
 * survives relabeling, so overrides stay attached to the right chip and a
 * future change to a built-in label doesn't strand saved rows.
 */
export type RosterChip = {
  id: string;
  letter: string;
  color: string;
  shape: IconShape;
};

/** One saved roster per play type. A missing key = built-in defaults for that
 *  play type, so customizing offense leaves defense alone. */
export type CustomRoster = Partial<Record<PlayType, RosterChip[]>>;

export const DEFAULT_ROSTERS: Record<PlayType, RosterChip[]> = {
  offense: [
    { id: 'off-q', letter: 'Q', color: '#3B82F6', shape: 'circle' }, // Blue
    { id: 'off-r', letter: 'R', color: '#10B981', shape: 'circle' }, // Green
    { id: 'off-a', letter: 'A', color: '#F59E0B', shape: 'circle' }, // Yellow
    { id: 'off-b', letter: 'B', color: '#EF4444', shape: 'circle' }, // Red
    { id: 'off-c', letter: 'C', color: '#000000', shape: 'square' }, // Black — the center
    { id: 'off-x', letter: 'X', color: '#8B5CF6', shape: 'circle' }, // Purple
    { id: 'off-y', letter: 'Y', color: '#EC4899', shape: 'circle' }, // Pink
    // Lime, not the indigo it used to be: a coach reported Q/X/Z were
    // indistinguishable at a glance, and they were — blue 217°, indigo 239°,
    // purple 258°, all inside a 41° band. Lime sits at 82°, in the one wide
    // gap this palette has (between A's amber at 38° and R's green at 160°),
    // so it clears every other chip by at least 78°. Changing Z rather than
    // Q or X keeps the conventional blue QB and leaves X/Y as the pair a
    // coach is least likely to confuse, since they're rarely adjacent.
    { id: 'off-z', letter: 'Z', color: '#84CC16', shape: 'circle' }, // Lime
  ],
  // Defensive Line, Linebacker, Cornerback, Safety. "CB" (not "C") since "C"
  // is already the offensive Center above.
  defense: [
    { id: 'def-d', letter: 'D', color: '#F97316', shape: 'circle' },  // Orange
    { id: 'def-lb', letter: 'LB', color: '#14B8A6', shape: 'circle' }, // Teal
    { id: 'def-cb', letter: 'CB', color: '#84CC16', shape: 'circle' }, // Lime
    { id: 'def-s', letter: 'S', color: '#E11D48', shape: 'circle' },  // Rose
  ],
  // B-27: Kicker/Punter, Long Snapper, Returner, Coverage (place one per
  // gunner/coverage player needed).
  special_teams: [
    { id: 'st-kp', letter: 'K/P', color: '#06B6D4', shape: 'circle' }, // Cyan
    { id: 'st-ls', letter: 'LS', color: '#64748B', shape: 'circle' },  // Slate
    { id: 'st-ret', letter: 'RET', color: '#D946EF', shape: 'circle' }, // Fuchsia
    { id: 'st-cov', letter: 'COV', color: '#EAB308', shape: 'circle' }, // Yellow
  ],
};

const SHAPES: IconShape[] = ['circle', 'square', 'triangle', 'star'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Whether a saved override is safe to render. `custom_roster` is user-controlled
 * JSON that round-trips through the database, so a malformed entry must fall
 * back to the built-in chip rather than putting an empty label or an arbitrary
 * string into a CSS `background-color`.
 */
function isValidOverride(value: unknown): value is Partial<RosterChip> {
  if (typeof value !== 'object' || value === null) return false;
  const chip = value as Record<string, unknown>;
  if (typeof chip.letter !== 'string') return false;
  const letter = chip.letter.trim();
  if (letter.length < 1 || letter.length > MAX_PLAYER_LABEL_LENGTH) return false;
  if (typeof chip.color !== 'string' || !HEX_COLOR.test(chip.color)) return false;
  if (chip.shape !== undefined && !SHAPES.includes(chip.shape as IconShape)) return false;
  return true;
}

/**
 * The roster to show for a play type: built-in defaults with any saved
 * overrides applied by id.
 *
 * Merging by id (rather than replacing the array wholesale) means the chip set
 * and its order always come from DEFAULT_ROSTERS. Saved ids that no longer
 * exist are ignored, and chips added to the built-ins later appear immediately
 * for coaches who already saved a roster — neither case needs a data migration.
 */
export function resolveRoster(playType: PlayType, customRoster?: CustomRoster | null): RosterChip[] {
  const defaults = DEFAULT_ROSTERS[playType];
  const saved = customRoster?.[playType];
  if (!Array.isArray(saved) || saved.length === 0) return defaults;

  const overrides = new Map<string, Partial<RosterChip>>();
  for (const entry of saved) {
    const id = (entry as { id?: unknown })?.id;
    if (typeof id === 'string' && isValidOverride(entry)) overrides.set(id, entry);
  }

  return defaults.map((chip) => {
    const override = overrides.get(chip.id);
    if (!override) return chip;
    return {
      ...chip,
      letter: override.letter!.trim(),
      color: override.color!,
      shape: override.shape ?? chip.shape,
    };
  });
}

/** True when this play type's roster differs from the built-in defaults —
 *  drives whether the "Reset" control is worth showing. */
export function rosterIsCustomized(playType: PlayType, customRoster?: CustomRoster | null): boolean {
  const resolved = resolveRoster(playType, customRoster);
  return resolved.some((chip, i) => {
    const d = DEFAULT_ROSTERS[playType][i];
    return chip.letter !== d.letter || chip.color !== d.color || chip.shape !== d.shape;
  });
}
