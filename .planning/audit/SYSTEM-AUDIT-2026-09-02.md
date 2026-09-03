# System Audit — Playbuilder Pro working environment
**Date:** 2026-09-02 · **Scope:** `/Users/jeremyknepp/Documents/Playbuilder Pro/` (parent dir + `project/` git repo) · **Method:** three parallel read-only discovery passes (structure/git/docs; Claude Code + automation layer; secrets/deps/code health). Analysis only — nothing was modified.

---

## Executive Summary

**Overall health: B-.** The core that carries the business is genuinely healthy — zero secrets have ever entered git history, a 6,470-line Playwright smoke suite drives the real app, schema docs are fresher than every SQL file, and every one of CLAUDE.md's 41 file references resolves. The grade drops for three reasons. First, `npm audit` reports **9 production-dependency vulnerabilities (1 critical, 5 high)**, including XSS bypasses in the exact `dompurify` version that sanitizes community-post HTML — a live attack surface on a public site. Second, **both scheduled automations are dead while the documentation describes them as operating**: the nightly executor still runs a prompt pointed at the frozen BACKLOG.md, and feedback-triage has never filed an issue. Third, the AI-tooling layer (37% of all tracked files) is rotting fastest — a broken skill frontmatter, a skill name collision, four generic agents costing ~12,750 tokens of routing context every session, and a 143KB generated build cache committed to git.

**Top 3 risks:** (1) dompurify/react-router vulnerabilities on a public community site; (2) automations silently doing nothing while believed live; (3) a privileged `SUPABASE_SERVICE_ROLE_KEY` on disk at mode 644, undocumented in `.env.example` and contradicting CLAUDE.md's env-var claims.

**Top 3 opportunities:** (1) `npm audit fix` + smoke run — an afternoon that removes the critical risk; (2) a one-block eslint config fix that turns `npm run verify` from permanently-red to meaningful; (3) pruning `.claude/agents/` to reclaim ~12.7K tokens per session, ~3× the cost of CLAUDE.md itself.

---

## Repo Map

**Purpose:** solo-operator environment for Playbuilder Pro (playbuilderpro.com) — a React 18 + Supabase web app for youth/flag football coaches, deployed on Netlify, monetized freemium ($39/yr Pro).

**The two layers:** Layer B (embedded software) is essentially the whole system. **Layer A (knowledge/content) barely exists** — there is no vault or notes system; the parent directory holds only loose 2025-era file clutter. This audit weights everything toward Layer B.

### Parent directory — `/Users/jeremyknepp/Documents/Playbuilder Pro/` (~493M)

| Entry | Size | Classification | Activity |
|---|---|---|---|
| `project/` | 305M | software — the git repo | **active** (daily) |
| `Windsurf-darwin-arm64-1.12.2.dmg` | 180M | archive-candidate — installer | dead (Aug 2025) |
| `Canva AI - Canva_files/` (102 files) | 5.8M | archive-candidate — saved webpage | dead (Jul 2025) |
| `Canva AI - Canva.html` / `.pdf` | 420K / 636K | archive-candidate / content | dead (Jul 2025) |
| 4× `ChatGPT Image Aug 23, 2025 …png` | ~6.6M | content (two are byte-identical — likely duplicates) | dead (Aug 2025) |
| `Cross X.pdf` | 104K | unclear | dead (Jul 2025) |
| `project-bolt-sb1-mn8ghnx1.zip` | 164K | archive-candidate — original Bolt.new scaffold | dead (Aug 2025) |
| `.DS_Store` | 12K | config (Finder state) | — |

### Repo top level — `project/`

| Entry | Size | Classification | Activity |
|---|---|---|---|
| `src/` (83 files, 18,419 LOC) | 940K | software | **active** |
| `supabase/` (27 root .sql + docs + 7 Edge Functions) | 452K | software + docs | **active** |
| `tests/` (4 smoke specs, 6,470 lines) | 312K | software | **active** |
| `.claude/` (69 files; skills, agents, settings) | 560K | config | active, rotting |
| `.agents/` (63 files, vendored skills) | 2.0M | config | dormant (frozen Jul 27) |
| `public/`, `scripts/`, `docs/`, `.github/` | — | software / content / config | recent |
| `.bolt/` (incl. discarded migrations) | 52K | archive-candidate | dead (Aug 2025, still tracked) |
| `supabase/migrations/` (15 files) | — | archive-candidate — superseded by root .sql channel | dead (frozen 2025) |
| `dist/`, `node_modules/`, `test-results/` | 2.2M / 277M / 4K | generated — all correctly git-ignored | — |
| `tsconfig.tsbuildinfo` | 143K | generated — **wrongly tracked in git** | perpetually dirty |
| `BACKLOG.md` | 58K | content — self-declared frozen archive | frozen by design |
| `CLAUDE.md` | 17K | config | active (Aug 24) |
| `LEGAL_REVIEW_PACKET.md` (untracked), `MARKETING.md`, `README.md` | 18K / 9K / 2.4K | content | stale (Jul–Aug) |

### Automation inventory

- **7 Supabase Edge Functions** (`supabase/functions/`): `create-checkout-session`, `create-portal-session`, `stripe-webhook` (+`livemode.ts` guard), `sitemap`, `feedback-triage`, `feedback-notify` (pg_cron-called digest), `feedback-reply-notify` (Aug 31, undocumented in CLAUDE.md).
- **2 cloud routines** (prompts checked in at `docs/automation/`): nightly executor and feedback triage — **neither is actually operating** (see findings A-1).
- **5 local scripts** (`scripts/`): two one-shot migrations (Jul 2026), icon rasterizer, seed-library pipeline. No cron/launchd jobs exist anywhere on this machine for this project — **all scheduling lives outside version control** (Claude cloud routines UI + Supabase pg_cron).

### Claude Code inventory & context cost

- `CLAUDE.md` ~4,320 tokens + `MEMORY.md` index ~540 + settings ~210 = **~5,070 tokens always loaded**.
- `.claude/agents/` — 4 generic imported subagents (`ai-engineer`, `code-reviewer`, `frontend-developer`, `fullstack-developer`), ~51KB of description frontmatter ≈ **~12,750 tokens surfaced every session for delegation routing** — the single largest context contributor, ~3× CLAUDE.md.
- 6 skills (3 symlinked into `~/Documents/.agents/`, 3 real dirs); no hooks, no commands, no `.mcp.json` anywhere.

**Surprises:** 115 of 315 tracked files (37%) are AI-agent config/skill content rather than application code; the scheduling layer is entirely un-versionable; the parent directory's largest item is a 180MB IDE installer.

---

## Audit Report

Findings are grouped by dimension, severity-sorted. Each is labeled **[fact]** (verified, cited) or **[judgment]** (reasoned opinion). Audit tiers: **DEEP** on `project/` (it carries the business); **LIGHT** (structure + secrets + staleness only) on the parent dir, `.bolt/`, `supabase/migrations/`, and `scripts/seed-library/`.

### Security & dependencies

**S-1 · CRITICAL · [fact] — Known-vulnerable production dependencies.**
`npm audit --omit=dev`: 9 vulnerabilities (1 critical, 5 high, 3 moderate), incl. `@remix-run/router` (high, XSS via open redirect), `ws` (high), `canvg` (high, prototype pollution), `@babel/runtime` (moderate, ReDoS), `@tiptap/core` (moderate), and a **critical in `jspdf` 2.5.2** (Local File Inclusion / Path Traversal, plus HTML Injection in New Window paths).

> **⚠ CORRECTION (2026-09-03).** The original version of this finding claimed the vulnerable dompurify was "precisely what sanitizes untrusted community-post HTML — stored XSS against other coaches." **That was wrong.** Verified since: `src/lib/sanitizeHtml.ts:1` imports the **top-level** dompurify, which is **3.4.13** — above the `<=3.4.12` advisory ceiling, so it was never vulnerable — and it runs with a strict allowlist (`ALLOWED_TAGS`, `ALLOWED_ATTR: []`). The vulnerable copy is jspdf's **nested dompurify 2.5.9**, reachable only through PDF generation (`src/components/designer/PlayDesigner.tsx`), where the inputs are play data rather than arbitrary attacker HTML. The community-post sanitization path was never at risk. The real critical is jspdf itself. Severity of the finding stands; the stated blast radius was overstated and is corrected here rather than quietly edited.

*Consequence:* the jspdf criticals sit in the PDF export path — a paid Pro feature — and attacker-influenced text (a community play's name, copied via "Use as Template") can reach it. Fix requires jspdf 2→4, a two-major bump; see the disposition note below.

**S-2 · HIGH · [fact] — Privileged service-role key on disk, undocumented, contradicting CLAUDE.md.**
`.env` (mode 644, git-ignored, never in history) contains 4 real keys including `SUPABASE_SERVICE_ROLE_KEY` (219-char JWT). Mitigations verified: no `VITE_` prefix, value absent from `dist/`. But `.env.example` documents only 2 of the 4 keys, and CLAUDE.md ("Env" section) claims exactly three env vars are all that `src/` reads — true for `src/`, but the file itself holds a fourth, privileged credential (used by `scripts/seed-library/*` and migrations).
*Consequence:* a future session or collaborator following the docs won't know the key exists, where it's used, or that it must never gain a `VITE_` prefix; 644 perms expose it to any local process running as any user in the default group.

**S-3 · strengths-grade · [fact] — Secrets hygiene is otherwise excellent.** `git log --all -- .env` is empty; `-S` sweeps for `sk_live_`, JWTs, and Resend keys across all history: zero hits. All 12 `sk_test_`/`whsec_` grep matches are documentation placeholders. `supabase/SECRETS.md` (11.9K, Aug 31) is a true index — names, locations, verify-commands, no values.

### Automation health

**A-1 · HIGH · [fact] — Both scheduled automations are dead; the docs describe them as live.**
- Nightly executor: its own runbook `docs/automation/nightly-executor.md:18-27` marks step 3 ("Routine's prompt in the cloud UI replaced") **not done**, and states the routine is therefore still running the old BACKLOG.md-reading prompt and "will do no work." Consistent evidence: ~20 stale `origin/nightly/*` branches, none recent.
- Feedback triage: `docs/automation/feedback-triage.md:31-36` marks steps 4–6 (dry run, routine creation, prompt update) all not done; `:52-57` states plainly "the routine has never filed an issue" — the only `from-feedback` issues (#100, #101) were hand-filed.
- Meanwhile `CLAUDE.md:160-176` presents both as the operating automation layer, and `MEMORY.md:3` calls the nightly routine "live."
*Consequence:* feedback from real users accumulates untriaged and `agent-ok` issues sit unworked, while every agent session (and the owner, at a glance) believes the pipeline is running. This is the silent-failure mode the runbooks were written to prevent.

**A-2 · MEDIUM · [judgment] — Scheduling is entirely outside version control.** No cron/launchd/workflow artifact exists in the repo; the only schedule definitions live in the Claude cloud routines UI and Supabase pg_cron (referenced in `supabase/functions/feedback-notify/index.ts:4,11`). The checked-in prompts mitigate this, but there is no way to diff or restore the schedule itself, and no failure alerting exists for either lane.

### Claude Code system quality

**C-1 · HIGH · [fact] — Broken skill frontmatter is live right now.** `.claude/skills/react-best-practices/SKILL.md` has a stray leading blank line before the `---` delimiter (this is the entire uncommitted "modification" `git status` shows — `git diff` = 1 insertion, an empty line 1). YAML frontmatter fails to parse; the session skill listing confirms the skill's description renders as literally `---`.
*Consequence:* the skill can no longer trigger on its description; any session relying on it gets a blank. One-character fix.

**C-2 · HIGH · [fact] — Skill name collision.** `.claude/skills/front-end-design/SKILL.md` declares `name: frontend-design` — identical to the `frontend-design` skill symlinked from `.agents/skills/`. Two installed skills share one name with different content.
*Consequence:* which skill loads on invocation is ambiguous; the two give materially different design guidance.

**C-3 · HIGH · [fact/judgment] — `.claude/agents/` costs ~12,750 tokens every session for four generic agents.** Four imported subagent files (50,979B combined, almost entirely `description:` frontmatter with embedded examples) are surfaced for routing in every session — roughly 3× the cost of CLAUDE.md. All four grant Write/Edit; none contain any Playbuilder content; they cross-reference agents that don't exist here (`llm-architect`, `ml-engineer`, `context-manager`). [judgment] For a solo Vite SPA, this is pure overhead unless they're being invoked deliberately.

**C-4 · MEDIUM · [fact] — CLAUDE.md content drift (paths are clean, facts are stale).** All 41 referenced paths verified to exist — unusually good. But: lint counts claim ~42 errors + ~51 warnings vs. actual 57E/59W; the Edge Function list (L153-154) omits `feedback-reply-notify` (7 exist, 6 documented); the installed-skills list (L257-258) omits `mobile-design` and `front-end-design`; and the automation section presents dead routines as live (A-1).

**C-5 · MEDIUM · [fact] — MEMORY.md index drift.** `MEMORY.md:3` still describes the "BACKLOG.md queue" and a "Sonnet 5, ~2am" nightly routine (contradicting CLAUDE.md's 2026-08-17 move to GitHub issues — and it's the only surviving model/time claim anywhere); `:4` cites "B-18" where CLAUDE.md says B-21/#83/#82. Index-to-file integrity itself is perfect (12↔12, no orphans).

**C-6 · LOW · [fact] — `settings.local.json` has a malformed permission rule.** Two curl allowlist entries hardcode the Supabase project ref with an unbalanced quote pattern; the first rule likely never matches. Also pre-approves `source .env*` into the shell — [judgment] acceptable for a solo operator, worth knowing.

### Git & repo hygiene

**G-1 · HIGH · [fact] — 143KB generated build cache tracked and perpetually dirty.** `tsconfig.tsbuildinfo` is in `git ls-files`, absent from `.gitignore`, re-committed in `fffe3e3`, `44bc69d`, `7ffef2d`, and modified again right now.
*Consequence:* every build dirties the tree, every commit that sweeps it bloats history, and its diff noise trains the operator to ignore `git status` — which is how real strays slip through.

**G-2 · MEDIUM · [fact] — Branch rot.** 51 of 55 local branches are merged into `main` and never deleted; remote carries ~20 `nightly/*`, 5 `feedback/*`, 3 `claude/*`, and `backlog-sweep`. Local `main` is 1 behind `origin/main`.
*Consequence:* `git branch` output is unusable as a signal of what's in flight.

**G-3 · MEDIUM · [fact] — Dead scaffolding still tracked.** `.bolt/` (frozen Aug 2025, includes `supabase_discarded_migrations/`) and `supabase/migrations/` (15 files, all mtime Aug 23 2025, names ending Jun 2025) are both tracked while the real migration channel is the 27 loose root `.sql` files. Nothing marks the frozen dirs as superseded.
*Consequence:* a cold-start reader (or an agent) can reasonably conclude `supabase/migrations/` is the migration system and run/extend the wrong thing. CLAUDE.md documents the loose-file convention but never mentions the frozen directory exists.

**G-4 · strengths-grade · [fact] — Otherwise clean.** Remote exists (GitHub, pushed); no dist/logs/zips/.DS_Store/env files tracked; `.gitignore` covers everything except `*.tsbuildinfo`; .git is a modest 21M.

### Embedded software quality (DEEP tier: the app)

**Q-1 · MEDIUM · [fact] — The verify pipeline is red for reasons that are 100% config, not code.** `npx eslint .`: 116 problems (57E/59W). 56 of 57 errors are `no-undef` in `.mjs` Node scripts (`scripts/*`, `supabase/functions/*.check.mjs`) because `eslint.config.js` never registers Node globals for that file set. **Zero errors in `src/`.** `npm run verify` therefore always fails at lint, which is why CLAUDE.md has a standing workaround instructing everyone to bypass it.
*Consequence:* the one-command quality gate the repo defines is untrustworthy, and the workaround culture it breeds is worse than the errors.

**Q-2 · MEDIUM · [fact] — Orphaned TypeScript configs hide 40 real (if trivial) errors.** `tsconfig.json` has no `references` array and nothing extends `tsconfig.app.json` or `tsconfig.node.json` — they are evaluated by no tool. `tsconfig.app.json` (with `noUnusedLocals/noUnusedParameters`) reports 40 errors, all TS6133, effectively all stale `import React` lines across 40 files under the modern JSX transform. The two configs also disagree on `target` (`es5` vs `ES2020`).
*Consequence:* `npm run typecheck` reports 0 while stricter, intended settings sit unenforced; the configs mislead about what's actually checked.

**Q-3 · MEDIUM · [fact] — Dependency staleness beyond the vulnerabilities.** 30 packages behind; notable: `@supabase/supabase-js` 2.56 → 2.114 (58 minors — auth/RLS client fixes accrue here), `vite` 3 majors, `typescript` and `jspdf` 2 majors, `react` 18→19, `tailwindcss` 3→4, `react-router-dom` 6→7.

**Q-4 · LOW · [judgment] — Size concentration, acknowledged not urgent.** `Canvas.tsx` (1,977 lines) + `PlaybooksPage.tsx` (1,859) = 21% of src; `tests/smoke/designer.spec.ts` (5,446 lines) = 84% of test code. All working and smoke-covered; a solo operator can live with this, but each is a merge-conflict and comprehension chokepoint.

LIGHT-tier projects (`scripts/seed-library/`, `.bolt/`, parent-dir artifacts): structure inspected, no secrets found, no further review — dormant.

### Information architecture (Layer A) & knowledge lifecycle

**L-1 · MEDIUM · [fact] — Parent-dir clutter.** ~188M of dead 2025 artifacts sits beside the repo (table in Repo Map), including a 180M installer and two byte-identical PNGs. No archive convention exists.

**L-2 · MEDIUM · [fact] — Root doc rot.** `README.md` (Jul 4) omits four existing component dirs and four of seven npm scripts; `MARKETING.md` (Jul 21) predates the Stripe go-live work it says is gated; `LEGAL_REVIEW_PACKET.md` is an untracked point-in-time copy of legal text whose canonical source is `src/components/legal/` — it can only drift.

**L-3 · strengths-grade · [fact] — No unbounded accumulation anywhere.** No exports/screenshots/transcripts/report dirs; `test-results/` holds one JSON stub; Playwright leaves no residue. The knowledge-lifecycle failure mode this audit expects simply isn't present.

### Strengths (preserve these)

- **Zero secrets ever committed** — verified across all branches and history.
- **`supabase/SECRETS.md` as an index with verify-commands** — a genuinely rare pattern worth keeping ironclad.
- **Docs refreshed as a discipline:** SCHEMA/SECRETS/EMAIL_SETUP share an Aug 31 refresh pass and SCHEMA.md is newer than every `.sql` file — no schema drift.
- **A real verification culture:** 6,470 lines of smoke tests that drive the actual app, plus checked-in automation prompts, the PBP-errcode gate pattern, the `livemode.ts` webhook guard, and the "no fabricated content" house rule (visible in `TopPlays.tsx`'s render-nothing-until-real-votes behavior).
- **Memory system integrity:** 12 index entries ↔ 12 files, exact match.
- **CLAUDE.md path accuracy:** all 41 referenced files exist.

---

## Improvement Strategy

Four themes explain nearly all 20 findings.

**T1 — Trust the signals.** (S-1, Q-1, Q-2) A quality gate that always fails is worse than none; a typecheck that checks the wrong config lies. *Target:* `npm run verify` passes on a clean tree; `npm audit --omit=dev` ≤ moderate; one coherent tsconfig lineage that actually enforces the intended strictness. *Principle:* every red must mean something, every green must be earned.

**T2 — Automation honesty.** (A-1, C-4, C-5) *Target:* each routine is either demonstrably running (an issue filed, a PR opened, within the last cycle) or explicitly marked DORMANT in its runbook, CLAUDE.md, and MEMORY.md. *Principle:* documentation may only claim what evidence shows — the repo already believes this (it's why the runbooks have checklists); finish the loop.

**T3 — Config-layer hygiene.** (C-1, C-2, C-3, C-6, G-1) The AI tooling is 37% of tracked files and decays fastest because nothing exercises it daily. *Target:* every SKILL.md parses; no name collisions; `.claude/agents/` pruned to what's actually invoked or deleted; generated files untracked. *Principle:* config that costs context every session must pay rent.

**T4 — Archive lifecycle.** (L-1, L-2, G-3, and parent-dir findings) *Target:* parent dir contains `project/` plus at most one `archive/` folder; frozen tracked dirs either deleted or carry a one-line README saying "superseded by X"; point-in-time snapshots live in `docs/` or die. *Principle:* everything dead is either labeled dead or gone.

**Non-goals (deliberate):**
- **Major-version dependency migrations** (React 19, Tailwind 4, Vite 8, router 7) — days of effort, everything works, no security driver once S-1 is fixed.
- **Splitting `Canvas.tsx` / `designer.spec.ts`** — working, smoke-covered, solo-operator-acceptable; revisit only when a change actually hurts.
- **A unit-test layer** — the smoke suite carries the risk today and matches how this app breaks (integration seams, not pure functions).
- **Rewriting `supabase/migrations/` history** — archive-label it instead.

**Definition of done (measurable):**
- `npm audit --omit=dev`: 0 critical/high.
- `npm run verify` exits 0 on a clean checkout.
- `git status` clean after `npm run build` (tsbuildinfo untracked).
- Both automation docs' status checklists show all-✅ or a DORMANT banner.
- `claude` session skill listing shows 6 skills, 6 distinct names, 6 real descriptions.
- Local branches ≤ 5; parent dir ≤ 2 entries besides `project/`.
- `.env.example` documents all 4 keys; `.env` is mode 600.

---

## Task Plan

### Milestone 0 — Safety net (before anything else)

| # | Task | Effort | Risk | Depends |
|---|---|---|---|---|
| 0.1 | **Resolve the dirty tree deliberately.** Fix the SKILL.md leading blank line (C-1) rather than committing it; commit or discard the untracked `.claude/` dirs and `LEGAL_REVIEW_PACKET.md` per owner decision (Open Q5); leave `tsconfig.tsbuildinfo` for task 2.1. Accept: `git status` shows only intended state. | S | Low | — |
| 0.2 | **Reference inventory for path fragility.** Record before any move: 3 skill symlinks target `~/Documents/.agents/skills/` (machine-absolute); `settings.local.json` hardcodes the Supabase project ref; `scripts/seed-library/*` read `.env` by relative path; CLAUDE.md references 41 paths. Accept: list saved into `.planning/audit/`. | S | None | — |
| 0.3 | **Confirm off-machine state.** Push current branch; fast-forward local `main` (it's 1 behind origin). Accept: nothing exists only on this laptop. | S | Low | — |

### Milestone 1 — Critical

| # | Task | Effort | Risk | Depends |
|---|---|---|---|---|
| 1.1 | **`npm audit fix` + full verification.** See sketch below. Accept: 0 critical/high in `--omit=dev`; 173-test smoke suite green; community-post sanitization spot-checked. | S–M | Med (dep bumps) | 0.3 |
| 1.2 | **Service-role key hygiene.** `chmod 600 .env`; add all 4 keys to `.env.example` with comments (service-role: "server-side scripts only — NEVER add VITE_ prefix"); correct CLAUDE.md's "only three env vars" claim; add a SECRETS.md row if missing. Accept: definition-of-done bullets met. | S | None | — |
| 1.3 | **Automation: revive or retire (owner decision, then execute).** Revival = the runbooks' own remaining checklist steps (nightly: swap the cloud prompt, `docs/automation/nightly-executor.md` step 3; triage: dry-run incl. injection-guard test, create routine, confirm — steps 4–6). Retirement = DORMANT banner on both docs + CLAUDE.md automation section + MEMORY.md correction. Accept: T2 definition of done. | M | Low | Open Q1 |

### Milestone 2 — High-leverage structure

| # | Task | Effort | Risk | Breakage list | Depends |
|---|---|---|---|---|---|
| 2.1 | **Untrack `tsconfig.tsbuildinfo`**: `git rm --cached`, add `*.tsbuildinfo` to `.gitignore`. | S | None | None — generated; nothing reads it from git | 0.1 |
| 2.2 | **eslint Node-globals block** for `**/*.mjs` + `supabase/functions/**/*.mjs` in `eslint.config.js`; fix the 1 real unused-var; update CLAUDE.md's verify-workaround paragraph to say verify now passes. | S | Low | CLAUDE.md lint-count claims (update in same change) | — |
| 2.3 | **Resolve skill collision**: rename `front-end-design`'s frontmatter `name:` (or delete the weaker duplicate — Open Q4). | S | Low | Any prompt/doc invoking `frontend-design` by name now resolves unambiguously; CLAUDE.md skills list (update in 2.6) | 0.1 |
| 2.4 | **Prune `.claude/agents/`**: delete agents not deliberately used (Open Q4); for keepers, trim descriptions to a paragraph. | S | Low | None in-repo — nothing references them; reclaims ~12.7K tokens/session | Open Q4 |
| 2.5 | **Branch sweep**: delete 51 merged local branches (`git branch --merged main`), then stale remote `nightly/*`, `feedback/*`, `claude/*` after confirming merged/abandoned. | S | Low (merged = recoverable via reflog/PRs) | None — no CI references branches | 0.3 |
| 2.6 | **CLAUDE.md + MEMORY.md accuracy pass**: add `feedback-reply-notify`, fix skills list, fix lint counts (post-2.2), automation status (post-1.3); rewrite MEMORY.md L3–4. | S | None | — | 1.3, 2.2, 2.3 |
| 2.7 | **tsconfig lineage**: recommended shape — make `tsconfig.json` a solution file with `references` to app/node configs so `noUnusedLocals` is enforced, then burn down the 40 TS6133s (mechanical `import React` deletions). Alternative: delete the orphaned configs and fold settings into one file. | M | Med | `npm run typecheck` semantics change (intended); verify `vite.config.ts` + eslint's `parserOptions.project` (if any) still resolve; CLAUDE.md "pre-existing tsc errors" paragraph becomes false — update it | 2.2 |

### Milestone 3 — Quality & polish

| # | Task | Effort | Risk | Breakage list | Depends |
|---|---|---|---|---|---|
| 3.1 | **Parent-dir archive sweep**: owner sign-off on delete list (DMG, Canva files, dup PNGs, Bolt zip — Open Q2); survivors into one `archive/` folder. | S | Low | None — nothing in-repo references parent-dir files (verified: zero grep hits) | Open Q2 |
| 3.2 | **README refresh**: real structure tree, all 7 npm scripts, pointer to CLAUDE.md. | S | None | — | — |
| 3.3 | **Root-doc disposition**: `MARKETING.md` → `docs/` (update or header-date it); `LEGAL_REVIEW_PACKET.md` → delete or `docs/legal-review-2026-07/` with "snapshot, source of truth is src/components/legal/" header. | S | None | Grep first for inbound references (none found in discovery) | Open Q5 |
| 3.4 | **Label or drop frozen dirs**: `.bolt/` delete-or-README; `supabase/migrations/` add `README.md`: "frozen pre-Jun-2026 history — live migrations are the root .sql files, see CLAUDE.md." | S | Low | None — no tooling reads either (no migration runner exists) | Open Q3 |
| 3.5 | **Fix malformed curl rule** in `settings.local.json`. | S | None | — | — |

### Quick wins (all S, all high-impact)
**1.1** audit fix · **0.1/C-1** SKILL.md blank line (one character) · **2.1** tsbuildinfo · **2.2** eslint globals → verify goes green · **1.2** chmod + env docs · **2.5** branch sweep.

### Implementation sketches — top 3

**1.1 `npm audit fix`:** On a fresh branch: `npm audit fix` (no `--force` first pass); diff `package-lock.json` to confirm only semver-compatible bumps; `npm run build && npm run typecheck && npm run smoke` (173 tests are the real gate); manually exercise community-post create/render (dompurify seam) and a playbook PDF export (jspdf seam). If `jspdf`'s vulnerable dompurify pin survives, evaluate the jspdf 2→4 major separately rather than forcing. Gotcha: `npm audit fix --force` would jump react-router to v7 — do not.

**1.3 Automation revival (if chosen):** Each runbook already contains its own remaining steps with checkboxes — execute them literally in order, checking boxes in the same commit as the cloud-UI change (the repo's own rule: "edit the file in the same change as the cloud UI, or the doc becomes a lie"). For triage, the injection-guard dry run (`feedback-triage.md:230-232`) is a hard gate: wrong classification = stop, don't schedule. Evidence of life = one triage-filed issue and one nightly PR within a cycle; then update CLAUDE.md/MEMORY.md (task 2.6).

**2.1 tsbuildinfo:** `git rm --cached tsconfig.tsbuildinfo && echo '*.tsbuildinfo' >> .gitignore && git commit`. History keeps old blobs (~143K/commit × a handful — not worth a rewrite). Verify: `npm run build && git status` → clean.

---

## Open Questions (owner decisions)

1. **Automations — revive or retire?** Both are one checklist away from either state. If the business isn't ready for autonomous nightly PRs, retiring honestly beats the current zombie state. (Gates task 1.3.)
2. **Parent-dir artifacts — delete or archive?** The 180MB DMG is re-downloadable (delete); Canva/ChatGPT images may have sentimental/marketing value (archive?); the Bolt zip is the pre-git origin snapshot (archive one copy?). (Gates 3.1.)
3. **`.bolt/` and `supabase/migrations/` — drop from tracking or label?** History preserves them either way; labeling is zero-risk, deletion is cleaner. (Gates 3.4.)
4. **Which of the 4 `.claude/agents/` and 6 skills do you actually use?** Discovery can't see invocation history. Honest answers here determine 2.3/2.4 — anything unused should go; each survivor costs context every session. Note `react-best-practices` is already flagged in CLAUDE.md as a poor fit (Next.js guidance, Vite reality).
5. **`BACKLOG.md` (58K) and `LEGAL_REVIEW_PACKET.md` at root — keep, move to `docs/`, or delete?** Both are archives of decisions, not live documents.

---

## Remediation log — 2026-09-03

Owner decisions and what was executed on branch `chore/system-audit-cleanup`.

**Owner answers:** (1) keep BACKLOG *and* the automation docs as archive — the routines never worked and a new feedback strategy is needed; (2) archive parent-dir artifacts; (3) delete only where risk-free, else label; (4) delete config that costs too many resources; (5) move root docs to `docs/`.

| Finding | Disposition |
|---|---|
| S-1 vulns | **Partly fixed.** `npm audit fix` cleared all 5 highs; prod vulns 9 → 4. Remaining 4 all need major bumps — **open decision** (below). |
| S-2 service-role key | **Fixed.** `.env` → `chmod 600`; key documented in `.env.example` with an explicit never-use-`VITE_`-prefix warning. Also verified CLAUDE.md's "only three env vars in `src/`" claim is **correct** (`analytics.ts:15` hardcodes the GA ID) — that part of S-2 was overstated. |
| A-1 dead automations | **Retired honestly** per answer 1. DORMANT banners on both runbooks + CLAUDE.md; new plan at `docs/proposals/feedback-triage-v2.md`. |
| C-1 broken skill | **Fixed.** Stray leading blank line removed; description parses again. |
| C-2 name collision | **Fixed** by renaming, not deleting — `front-end-design` drove the homepage redesign and was worth keeping. |
| C-3 agent cost | **Deleted** `.claude/agents/` — reclaims ~12,745 tokens/session. Measured: agents 50,979 chars vs. **all six** skill descriptions 1,963 chars, so skills were never the resource problem despite the phrasing of answer 4. `mobile-design` also deleted (React Native/Flutter, N/A to a Vite SPA). |
| C-4/C-5 doc drift | **Fixed.** CLAUDE.md lint counts, verify status, Edge Function list, skills list; MEMORY.md + `automation-foundation.md` corrected. |
| G-1 tsbuildinfo | **Fixed.** Untracked + gitignored. |
| G-3 frozen dirs | **`.bolt/` deleted** (verified inert: zero inbound references, template stub + discarded migrations). **`supabase/migrations/` labeled, not deleted** — the Supabase CLI is linked to the live project, so removing it would diverge local history from the remote `schema_migrations` table. This is exactly the "otherwise label" case in answer 3. |
| Q-1 red verify | **Fixed.** Node+browser globals for `**/*.mjs`; lint 57 errors → **0**; `npm run verify` passes end-to-end for the first time. |
| L-1/L-2 clutter | **Fixed.** Parent dir is now `project/` + `archive/` (with a README). `MARKETING.md` and `LEGAL_REVIEW_PACKET.md` → `docs/archive/` with dated names. README refreshed. |
| Q-2 tsconfig, Q-3 staleness, Q-4 size | **Deferred** (see non-goals / open decision). |

**RESOLVED 2026-09-03 — jspdf: removed, not upgraded.** ✅

Investigating the upgrade showed the premise was wrong twice over, so the fix changed shape:

1. **jsPDF never touched the Pro features.** Playbook PDFs (detailed + grid) and wristband export build HTML with `@media print` and call `window.open()` + `printWindow.print()` (`ExportModal.tsx:873-894`). They never imported jsPDF. My "touches the Pro feature set" claim was wrong.
2. **jsPDF was never reachable at all.** Its only consumer was `handleExportToPDF` in `PlayDesigner.tsx`, passed to `ExportModal` as `onExport` — a prop that is declared in the interface but **never destructured and never called in any commit in repo history** (`git log --all -S "onExport("` → empty). It dates to the original Bolt scaffold commit `a44be90`. Confirmed empirically: a full single-play export fires `window.open()` and fetches **zero** jspdf/html2canvas chunks.

So the critical CVE was never exploitable here — the vulnerable code could not execute. Rather than a two-major upgrade of an unused library, the dead code and both dependencies (`jspdf`, `html2canvas` — the latter imported by nothing in `src/`) were **deleted outright**. That removes the CVE permanently instead of deferring it to the next advisory, and drops ~590KB from the build.

**Result: production vulnerabilities 9 → 2**, both moderate, both `react-router`. Guarded by a new smoke test asserting the export path prints via generated HTML and pulls in no PDF library.

**Still open — `react-router-dom` 6.29 → 7.18.** Clears the last 2 moderates. One (`deserializeErrors()` SSR hydration) **cannot apply** to this client-only SPA; the other (open redirect via backslash in `<Link>`/`useNavigate`) can. A router major touches every route in the app, so it deserves its own change and its own testing pass.

*Lesson worth keeping:* dead code that looks load-bearing is worse than no code — it cost this audit a mis-scored critical and nearly cost a needless major-version migration of a library the app doesn't use.

---
*Audit performed 2026-09-02 by Claude Code (three parallel read-only discovery agents + synthesis); remediation 2026-09-03. All `path:line` citations verified at discovery time. One finding (S-1 blast radius) was found wrong on execution and is corrected in place above rather than silently removed.*
