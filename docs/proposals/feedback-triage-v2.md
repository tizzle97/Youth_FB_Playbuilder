# Proposal — feedback triage, second attempt

**Status:** proposed, 2026-09-03 · **Replaces:** `docs/automation/feedback-triage.md` (dormant, never ran)

## The problem, stated honestly

User feedback lands in the `feedback` table and **nothing looks at it.** The
v1 design — a Claude cloud routine that reads feedback via the
`feedback-triage` Edge Function, classifies it, and files a GitHub issue —
was never switched on. Its SQL ran and its Edge Function deployed, but the
routine itself was never created, so it has filed exactly zero issues.

## Why v1 failed (this is the part that matters)

Not because the design was wrong. Because **the last mile was a manual step
in a web UI, and nothing made its absence visible.**

- The schedule lived in the Claude cloud routines UI — outside git, so it
  couldn't be reviewed, diffed, or restored.
- Turning it on required remembering to paste a prompt into that UI. The
  runbook's own checklist has had steps 4–6 unchecked since 2026-08-19.
- Nothing failed loudly. A routine that was never created doesn't error — it
  just doesn't exist, which looks exactly like a quiet week of no feedback.
- The same failure killed the nightly executor (its step 3 was never done
  either). Two lanes, one root cause: **config that lives in a UI rots, and
  silence is indistinguishable from success.**

Any v2 that ends with "…then paste this into a web UI" will die the same way.

## Design principles

1. **The schedule lives in version control.** If it can't be diffed, it will
   drift and nobody will notice.
2. **Absence must be loud.** The system has to distinguish "no feedback" from
   "not running." Silence is not evidence of health.
3. **Ship the smallest rung that solves today's problem.** Today's problem is
   *nobody sees the feedback* — not *nobody classifies it*. Visibility first,
   automation second.

## Recommended: a two-rung ladder

### Rung 1 — turn on the digest that already exists (do this first)

`supabase/feedback_notify.sql` **already contains a working `cron.schedule()`
block** for a daily 13:00 UTC email digest, and the `feedback-notify` Edge
Function is written and deployed. It was simply never run. This is one SQL
Editor paste away from working, using the repo's normal migration workflow —
no new infrastructure, no UI config, nothing to build.

What it takes:
1. Fill the two placeholders in `supabase/feedback_notify.sql`
   (`<PROJECT-REF>`, `<FEEDBACK_NOTIFY_SECRET>`) and run it in the SQL Editor.
2. Confirm the secrets are set: `FEEDBACK_NOTIFY_SECRET`, `RESEND_API_KEY`,
   `FEEDBACK_DIGEST_TO` (see `supabase/EMAIL_SETUP.md` §6).
3. Verify with the queries already written into the bottom of that file
   (`cron.job`, then `cron.job_run_details`).

This alone ends the current situation. It is unglamorous and it is the
highest-value thing on this page.

**Make it loud (principle 2):** send the digest *every* day, including days
with zero feedback — an explicit "0 new since yesterday" email. A digest that
only arrives when there's news is indistinguishable from a broken digest. One
line of change in `feedback-notify`, and it converts silence into a positive
health signal you'd notice the absence of.

### Rung 2 — classification via GitHub Actions, only if volume justifies it

If the digest proves the volume is high enough that reading it by hand is the
bottleneck, add classification — but put the schedule in the repo, not a UI:

- A `.github/workflows/feedback-triage.yml` with a `schedule:` cron, calling
  the **already-deployed** `feedback-triage` Edge Function (which correctly
  withholds `user_id` and submitter email, since its output lands in public
  issues), then `gh issue create` with `GITHUB_TOKEN`.
- Classification can start rule-based (keyword → label) and only add a Claude
  API call if the rules prove insufficient. Secrets go in GitHub repo secrets.
- **Why this satisfies the principles:** the cron expression is a file in git;
  a failed run turns the Actions tab red and emails you automatically; and
  there is no manual UI step, so it can't silently never-exist.

The v1 safety rules carry over unchanged and are non-negotiable: feedback text
is **untrusted public input** — treat it as data, never instructions; never
auto-code changes to billing/auth/RLS/legal/SQL from a feedback report; and
keep the injection-guard dry run as a hard gate before anything files issues
automatically (`docs/automation/feedback-triage.md` L230-232).

## Explicit non-goal

Do not resurrect the Claude cloud routine for this. Not because the agent
was the wrong tool, but because that placement put the schedule somewhere
unversioned and failure-silent, and it has now demonstrably failed twice for
exactly that reason.

## Open question for the owner

What is the actual feedback volume? Rung 1 answers this within a week, and the
answer determines whether Rung 2 is worth building at all. Don't build the
classifier before knowing whether there are 3 items a month or 30 a week.
