# Duplicate a playbook

## Problem

A coach wants to reuse a playbook as the starting point for a new one — the
motivating example was building a "Week 2" game plan without redrawing every
play from an existing playbook by hand. Today the only way to do that is to
open each play individually via "Use as Template" and manually re-add every
one to a brand-new playbook, one at a time. For a 15-20 play playbook that's
a lot of repetitive clicking for something that should be a single action.

## Proposed UX

A "Duplicate" action on a playbook, next to the existing per-playbook actions
on `/playbooks` (`PlaybooksPage.tsx`) — same icon-button row as delete/export,
or a menu item if that row is already crowded. Clicking it:

1. Prompts for a new name, prefilled with `"<original name> (Copy)"` (mirrors
   `SavePlayModal`'s "Use as Template" naming convention elsewhere).
2. Creates a new playbook owned by the caller, with private copies of every
   play in the source playbook, in the same order.
3. Navigates to the new playbook so the coach can start editing immediately.

The duplicate is fully independent of the source — editing a play in the copy
must never touch the original. This mirrors how "Use as Template"
(`/designer?template=<id>`) already works for a single play: a new row, not a
reference.

## Affected files/systems

- **New SQL function**, e.g. `duplicate_playbook(source_playbook_id uuid) →
  uuid`, added in a new idempotent file (`supabase/playbook_duplicate.sql`
  or similar — never edit an already-applied file). `clone_playbook_pack()`
  in `supabase/playbook_packs.sql` is almost exactly this operation already
  (clone a playbook + all its plays, preserving `order_position`) and is the
  template to start from — the differences are:
  - No `is_pro()` gate — duplicating your **own** playbook isn't a Pro
    feature the way cloning a curated public *pack* is (unless a human
    decides otherwise — see open questions).
  - Ownership check instead of a public-playbook check: raise a new
    `PBP07` (next free error code per `CLAUDE.md`) if
    `source_playbook_id` isn't owned by the caller, instead of
    `clone_playbook_pack`'s `PBP05` (not a public playbook).
  - Copies from a private source, not a public one — RLS already lets an
    owner read their own `playbooks`/`playbook_plays`/`plays` rows, so no
    new SELECT policy should be needed (unlike `playbook_packs.sql`, which
    had to add public-read policies for the pack case).
  - Should still run through `free_tier_limits.sql`'s `BEFORE INSERT`
    trigger on `playbooks` unmodified, so a free user at the 2-playbook cap
    gets the existing `PBP02` upgrade prompt when they try to duplicate a
    3rd — no special-casing needed there.
- `src/lib/errors.ts` — map `PBP07` to a user-safe message, same pattern as
  the other `PBP0x` codes.
- `PlaybooksPage.tsx` — new button/menu item, a confirm/name-prompt modal
  (small — could reuse or lightly adapt `CreatePlaybookModal.tsx`'s shell),
  and the RPC call + navigate-to-new-playbook on success.
- `supabase/SCHEMA.md` — document the new function, same section as
  `clone_playbook_pack`.

## Risks and tradeoffs

- **Play count vs. free-tier caps.** Duplicating a playbook also duplicates
  every play in it, which could push a free user over the 15-play cap even
  if they're nowhere near the 2-playbook cap. `enforce_plays_free_limit()`
  already fires per-row on the `plays` insert, so the function should be
  written to fail atomically (whole duplicate rolls back) rather than
  leaving a half-copied playbook if the Nth play trips the cap mid-copy —
  same atomicity `clone_playbook_pack` already gets from running as one
  Postgres function.
- **Large playbooks.** No stated limit on playbook size today; a very large
  playbook duplicating many plays in one function call should still be fine
  transactionally, but worth sanity-checking with a realistic play count
  during implementation.
- **Thumbnails.** Copied plays should carry over their source thumbnail
  (cheap, already-rendered) rather than regenerating — same as how "Use as
  Template" behaves for a single play today, if it does; worth confirming
  during implementation rather than assuming.

## Open questions needing a human decision

1. **Free vs. Pro.** Should duplicating your own playbook be free-tier, or a
   Pro-gated convenience feature? The monetization plan doesn't currently
   list this as a Pro feature, so the proposal defaults to free-tier
   (gated only by the existing playbook/play caps), but this is Jeremy's
   call to confirm.
2. **Naming collisions.** Is `"<name> (Copy)"`, with no dedupe against an
   already-existing playbook of that exact name, good enough, or should
   repeated duplicates auto-number ("(Copy 2)", "(Copy 3)")?

## Rough size estimate

Small-to-medium single-PR item. The SQL function is a close variant of an
already-shipped, already-reviewed one (`clone_playbook_pack`), which is most
of the risk. The UI surface is one small modal plus a button — comparable in
scope to B-33's "Clone this playbook" button on the pack library, which
shipped in one PR.
