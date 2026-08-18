<!--
Closes #<issue>

That line is not decoration — it is how the queue stays honest. Merging the PR
closes the issue, so "remember to mark it done" stops being a step anyone can
forget. Before this repo used issues, two items shipped and sat in the backlog
as open work for days.

No issue? For a genuine one-off (a typo, a revert) say so here and carry on.
-->

Closes #

## What changed and why

## Verification

<!--
  npm run typecheck && npm run build && npm run smoke
  npx eslint <touched files>          # no NEW errors; the repo has a backlog

  npm run verify still fails at the lint step on pre-existing errors — see
  CLAUDE.md. Paste real output, not an intention.

  If a test is meant to catch a regression, say how you confirmed it FAILS
  without the fix. A green test proves nothing on its own.
-->
