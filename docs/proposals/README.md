# Design proposals

Design write-ups for work that has been *thought through* but not built.

Most files here are written by the **feedback triage routine**
([`../automation/feedback-triage.md`](../automation/feedback-triage.md)): when a
user submits a feature request, the agent is explicitly forbidden from writing
feature code and instead lands a `<slug>.md` here plus a `[from feedback]` entry
in [`BACKLOG.md`](../../BACKLOG.md), on a **draft** PR. The point is to get the
design reviewed before anyone spends effort on an implementation.

Humans should feel free to add proposals here too, using the same shape:

- **Problem** — in the user's terms, not the codebase's.
- **Proposed UX** — what the coach actually sees and does.
- **Affected files/systems** — the real blast radius.
- **Risks and tradeoffs.**
- **Open questions needing a human decision.**
- **Rough size estimate.**

A proposal is not a commitment. Accepted ones graduate into a BACKLOG item and
get built from there; rejected ones stay for the record, with a short note at
the top saying why. Never paste raw feedback text or any identifying detail
about a submitter into a file here — these are public.
