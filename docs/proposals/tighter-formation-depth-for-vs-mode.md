# Proposal: Start offensive formation templates closer to the LOS

**Status:** design proposal, not yet approved — filed from user feedback via
the triage routine (2026-08-11).

## Problem, in the user's terms

> "The default formations for offense should start on the first yard line
> behind the line of scrimmage. This works best with the offense v defense
> full screen mode."

Today's curated Formation templates (`src/components/designer/formations.ts`,
B-24) place offensive backfield players well behind the line of scrimmage —
e.g. the 11v11 I-Formation's RB sits 7 yards back, FB 4 yards back, QB 1.5;
Shotgun/Spread QBs sit 5 yards back. Those depths are realistic, but the
field itself spans 17 yards upfield of the LOS and 13 yards behind it
(`FIELD_YARDS_ABOVE_LOS`/`FIELD_YARDS_BELOW_LOS` in
`src/lib/renderPlayScene.ts`) to fit every route a play might draw. On
`/vs` (`src/components/vs/VsDefenseView.tsx`), which composites a saved
offensive play and a saved defensive play onto that same full-size field via
`renderOverlayScene()`, a formation stamped with deep backfield alignment
ends up looking small and centered in a lot of empty space — the reporter's
"works best in full-screen mode" point is that a tighter stack near the LOS
would read more clearly at the scale `/vs` displays plays.

## Proposed UX

Shift the backfield `yBehindLOS(...)` offsets in `formations.ts` toward the
LOS for every offensive template, without changing the field geometry itself
(unlike B-29b, this is a content change, not a coordinate-system change — no
migration of existing saved plays is needed since formation templates are
only ever *stamped onto* a play, never referenced by id afterward). Rough
target: keep QB under center at ~1 yard, move shotgun QB from 5 to ~3 yards,
compress skill-position splits (FB/RB) proportionally so the formation still
reads correctly (an I-Formation RB directly behind the FB, not stacked on
top of it) but the whole backfield sits closer to the LOS than today.

Two open questions this proposal does not resolve (see below) affect exactly
how tight "the first yard line behind the LOS" should be taken literally.

## Files / systems affected

- `src/components/designer/formations.ts` — the only place formation
  coordinates are authored (10 templates: 4× 11v11, 3× 7v7, 3× 5v5). Pure
  data change, no new component or prop.
- No `Canvas.tsx`, `renderPlayScene.ts`, or DB schema change — formations are
  stamped as ordinary `playerIcons` entries (`stampFormation()` in
  `Canvas.tsx`), so this doesn't touch the save format or `/vs` rendering
  logic at all, only the starting coordinates a coach gets when they click a
  formation.
- `tests/smoke/` has an existing formation smoke test (stamps I-Formation,
  asserts 11 icons land in-bounds, confirms Undo clears them, per B-24) that
  would need its expected-position assertions (if any pin exact y-values)
  checked against the new depths.

## Risks / tradeoffs

- **Realism vs. legibility.** Real backfield splits (FB 4yd, RB 7yd) exist so
  routes/blocking assignments drawn from a stamped formation look like an
  actual snap. Compressing them is a deliberate simplification for display
  clarity, and only Jeremy can say how far to push that trade — this is a
  coaching-content judgment call, not an engineering one.
- **Icon overlap at tight depths.** 5v5/7v7 already have fewer, closer
  players; verify compressed depths don't visually stack skill positions on
  top of each other or the LOS line at small canvas sizes (mobile designer,
  not just `/vs`).
- **Scope of "vs mode."** The reporter specifically ties this to `/vs`. An
  alternative that doesn't touch template data at all: give `/vs` its own
  tighter effective field crop (e.g. render a narrower Y-window than the
  full 30 yards when both a formation-stamped offense and a defense are
  present) instead of changing what a coach gets when hand-building a play
  in the normal designer. That's a larger change (touches
  `renderOverlayScene()` and possibly `EXPORT_WIDTH`/`EXPORT_HEIGHT` framing)
  but avoids trading off realism for every designer use, not just `/vs`.
  Worth a human decision on which lever to pull before implementation.

## Open questions needing a human decision

1. Literally "1 yard behind the LOS" for every backfield player (collapses
   FB/RB/QB depth distinctions), or a smaller proportional compression that
   preserves relative depth ordering?
2. Change the formation template data (affects every use of "Formation" in
   the designer, not just `/vs`), or scope the fix to `/vs`'s own rendering
   crop instead (see tradeoff above)?
3. Does this apply to all three game formats, or mainly 11v11 (whose 7-yard
   RB depth is the most extreme case)?

## Rough size estimate

Small if scoped to `formations.ts` data only (a few hours: adjust 10
templates' `yBehindLOS` calls, re-verify the existing formation smoke test,
eyeball each template in the designer at each game format). Medium-large if
scoped to a `/vs`-specific rendering crop instead, per open question 2.
