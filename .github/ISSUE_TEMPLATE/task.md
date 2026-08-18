---
name: Work item
about: A unit of work for the queue — one issue, one PR
labels: priority:normal
---

<!--
Label it before saving, or an agent can't see it:
  agent-ok      an unattended agent may claim and work this
  human-only    needs a person
  blocked       has an unmet dependency — say what, below
  needs-design  a design decision is required before building
  priority:high | :normal | :low
  area:designer | :mobile | :billing | :community | :admin

Scope it to ONE pull request. If it needs several, file several and link them.
-->

## What and why

<!-- The problem, in the terms of whoever has it. Not the solution. -->

## Where

<!-- Files, line numbers, measured numbers. The more specific, the less the
     agent has to re-derive — and the less chance it works from a stale
     description. -->

## Done when

<!-- The observable outcome. If it can be asserted in tests/smoke/, say so. -->
