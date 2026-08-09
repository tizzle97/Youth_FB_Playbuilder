# Database schema (current state)

Concise canonical reference for the live Supabase Postgres schema. **Read this
instead of grepping `combined_migrations.sql`** (~2,000 lines with many
superseded duplicate definitions — last-one-wins, which makes it error-prone to
audit). Only open the raw `.sql` when you need exact DDL for a change.

Migrations are plain `.sql` files run **manually** by the user in the Supabase
SQL Editor — there is no automated runner. When you change the schema, add a new
idempotent `.sql` file and update this doc in the same change.

## Migration files → what they add
| File | Status | Contents |
|---|---|---|
| `combined_migrations.sql` | applied | Original bundled schema: all core tables, RLS, functions, triggers. Has internal duplicate/superseded blocks. |
| `migrations/*.sql` | applied (legacy) | The timestamped source migrations that were bundled into `combined_migrations.sql`. Historical — don't edit. |
| `plays_save.sql` | applied | Adds `plays.thumbnail`, `plays.is_public`, `plays.metadata`; public-read policy for public plays. |
| `feedback_admin.sql` | applied | Admin RLS on `feedback`; `admin_list_feedback()`, `admin_list_users()`, `delete_user()`. |
| `subscriptions.sql` | applied | `subscriptions` table, `is_pro()`, Founding-Member backfill. |
| `security_hardening.sql` | applied (2026-07-09) | Pins `search_path` on `is_admin()`/`is_pro()`; drops the unsafe `user_reputation` write policy; switches `image_reports` moderator policies to `is_admin()`. |
| `community_authors.sql` | applied (2026-07-09) | `get_community_authors(uuid[])` for Community post author display. |
| `free_tier_limits.sql` | applied (2026-07-04) | `BEFORE INSERT` triggers on `plays`/`playbooks` blocking free-plan users past `FREE_LIMITS` (15 plays / 2 playbooks). |
| `founding_member_backfill.sql` | applied (2026-07-09) | Re-runs the Founding Member grandfathering `INSERT` from `subscriptions.sql` to catch users who signed up between that original run and now (free-tier gates went live in the meantime). Idempotent — safe to run again. |
| `play_votes.sql` | applied (2026-07-15) | B-10 play voting: `plays.upvotes` cached counter, `play_votes` table (one vote per user per play), RLS, count-sync triggers. |
| `user_preferences.sql` | applied (2026-07-15) | B-14/B-15 per-user settings: team identity (name/logo for export stamping), default game format, save & export defaults. |
| `blog_seo.sql` | applied (2026-07-15) | SEO: adds `blog_posts.slug` (unique, backfilled), `description`, `status ('draft'\|'published')`; public SELECT now shows published only (admins see drafts). |
| `football_avatars.sql` | applied (verified 2026-08-05) | Replaces the seeded Dicebear "bottts" robot avatar icons with 8 self-contained football-themed SVG data URIs (football, helmet, flag, whistle, goalpost, cleat, playbook, trophy). Repoints any user on an old icon to the new default first. |
| `playbook_packs.sql` | applied (2026-08-03) | B-33 starter playbook packs: adds `playbooks.is_public`; public-read policies for public playbooks, their `playbook_plays` rows, and the plays inside them; `clone_playbook_pack(pack_playbook_id)` (Pro-gated, `SECURITY DEFINER`) clones a public playbook + its plays into the caller's own account. |
| `feedback_triage.sql` | applied (verified 2026-08-05) | B-35 automated feedback triage: additive `triage_class`/`triage_state`/`triage_ref`/`triage_notes`/`triaged_at` columns on `feedback` + a partial index on untriaged rows. No RLS or existing-column changes. |
| `feedback_capture.sql` | **pending — needs SQL run** | Adds nullable `feedback.page_path` (which route the user was on when they submitted) and a `feedback_content_len` CHECK capping `content` at 4000 chars, matching `MAX_CONTENT_CHARS` in the `feedback-triage` Edge Function. Added `NOT VALID` so it doesn't scan pre-existing rows. Additive — no RLS, policy, or existing-column changes. |
| `admin_entitlements.sql` | **pending — needs SQL run** | Admin Dashboard entitlement management, replacing one-off grant SQL. Re-creates `admin_list_users()` with `plan`/`current_period_end`/`is_stripe_backed` (DROP first — return type changed); adds `admin_set_user_plan(uuid, text)`. No schema/RLS change. |
| `custom_roster.sql` | **pending — needs SQL run** | Adds nullable `user_preferences.custom_roster jsonb` — saved player-icon rosters for the designer toolbar, keyed by play type (`offense`/`defense`/`special_teams`). NULL or a missing key = built-in defaults for that play type. Needs its own file because `user_preferences.sql`'s `CREATE TABLE IF NOT EXISTS` won't add a column to the existing table. No CHECK — structure is validated client-side in `designer/rosters.ts`. |
| `fix_playbook_plays_positions.sql` | **pending — needs SQL run** | One-off data repair, no schema change: renumbers any `playbook_plays` rows stranded at `order_position <= 0` by the drag-to-reorder bug (a failed reorder only rolled back the browser's on-screen state, never the partial DB write, so retries collided with the stranded row forever). Idempotent — no-op once nothing is `<= 0`. |
| `add_6v6_game_format.sql` | **pending — needs SQL run** | Widens `custom_formations.game_type` and `user_preferences.default_game_format`'s `CHECK` constraints to allow `'6v6'`, alongside new 6v6 formation templates in `formations.ts`. No new column. |
| `community_top_contributors.sql` | **pending — needs SQL run** | `get_top_contributors(result_limit int)` — real top-N posters by `user_reputation.reputation` (>0 only), same `auth.users`/`avatar_icons` join pattern as `get_community_authors()`. Fixes the Community page's "Top Contributors" sidebar, which was hardcoded mock data (fake usernames/photos/reputation) presented as real. |
| `community_posts_updated_at.sql` | **pending — needs SQL run** | `BEFORE UPDATE` trigger on `posts` reusing the existing `update_updated_at_column()` function (already wired to `plays`/`playbooks`, just missing here). Lets the UI show an "(edited)" marker instead of an edit looking identical to the original post. No schema change. |

> "verify applied" = created recently; confirm it has been run in Supabase before
> relying on the behavior.

## Conventions
- **Every table has RLS enabled.** Ownership checks use `auth.uid() = user_id`.
- **Admin** = membership in `admin_users` (NOT a column on `auth.users`), checked
  via `is_admin()`. **Pro entitlement** = `subscriptions` row, checked via
  `is_pro()`. Both are `SECURITY DEFINER` with pinned `search_path`.
- **Never trust `auth.users.raw_user_meta_data` for authorization** — users can
  set it on themselves. (A `role='moderator'` check there was a privilege-
  escalation hole; fixed in `security_hardening.sql`.)
- Enum `play_type` = `'offense' | 'defense' | 'special_teams'`.
- `updated_at` columns are maintained by the `update_updated_at_column()` trigger.

## Tables

### Play design
| Table | Key columns | RLS summary |
|---|---|---|
| `plays` | `id`, `user_id`, `name`, `type play_type`, `formation_id`, `canvas_data text` (JSON `{version,paths,playerIcons}`), `description`, `thumbnail`, `is_public bool`, `metadata jsonb`, `upvotes int` (trigger-cached from `play_votes`), timestamps | Owner full access (`auth.uid()=user_id`); admins manage all; **anyone** (anon+auth) can SELECT where `is_public=true`, or where the play belongs to a public playbook (B-33, `playbook_packs.sql`). `BEFORE INSERT` trigger blocks a 16th row for non-`is_pro()` users (`free_tier_limits.sql`). |
| `playbooks` | `id`, `user_id`, `name`, `description`, `is_public bool` (B-33), timestamps | Owner full access. `BEFORE INSERT` trigger blocks a 3rd row for non-`is_pro()` users (`free_tier_limits.sql`). **Anyone** (anon+auth) can SELECT where `is_public=true` (`playbook_packs.sql`). |
| `playbook_plays` | `id`, `playbook_id`, `play_id`, `order_position`; UNIQUE`(playbook_id,play_id)` & `(playbook_id,order_position)` | Access via owning playbook (`playbooks.user_id=auth.uid()`); **anyone** can also SELECT rows whose playbook is public (`playbook_packs.sql`). |
| `formations` | `id`, `user_id`, `name`, `type`, `template`, `is_system bool` | Read if `is_system` or owner; manage own non-system rows. **Unused** — no frontend references; superseded by `custom_formations` below. |
| `custom_formations` | `id`, `user_id`, `name`, `game_type ('5v5'\|'6v6'\|'7v7'\|'11v11')`, `icons jsonb` (offense-only `PlayerIcon[]`, same shape as the curated templates in `formations.ts`), `created_at` | Owner full access. `BEFORE INSERT` trigger blocks all non-`is_pro()` users — Pro-only feature, not just free-tier-capped (`custom_formations.sql`). |
| `categories` | `id`, `name`, `type`, `parent_id`, `playbook_id`, `order_position` | Access via owning playbook. |

### Community / social
| Table | Key columns | RLS summary |
|---|---|---|
| `posts` | `id`, `user_id`, `title`, `content`, `upvotes`, `downvotes`, timestamps | SELECT public (`true`); insert/update/delete own. `updated_at` refreshed on edit by `community_posts_updated_at.sql`'s trigger. |
| `comments` | `id`, `user_id`, `post_id`, `parent_id`, `content`, `upvotes`, `downvotes` | SELECT public; CRUD own; admins can delete any. |
| `votes` | `id`, `user_id`, `post_id?`, `comment_id?`, `vote_type bool`; UNIQUE per user+target | SELECT public; CRUD own. Target check: exactly one of post/comment. |
| `play_votes` | `id`, `user_id`, `play_id`, `created_at`; UNIQUE`(user_id,play_id)` | SELECT public; INSERT own **and only on public plays**; DELETE own. Triggers keep `plays.upvotes` in sync (`play_votes.sql`, B-10). |
| `user_reputation` | `id`, `user_id` (unique), `reputation int`, `avatar_type`, `avatar_url`, `avatar_icon_id→avatar_icons` | SELECT public; user may UPDATE own (avatar). **Writes to reputation happen via trigger only** (the old catch-all write policy was dropped in `security_hardening.sql`). |
| `avatar_icons` | `id`, `icon_url`, `name` | SELECT public; seeded with 8 football-themed SVG data-URI icons (`football_avatars.sql`) — no external image host. |
| `image_reports` | `id`, `reporter_id`, `reported_user_id`, `image_url`, `reason`, `status`, `resolver_id` | Reporter inserts/reads own; **admins** (via `is_admin()`) read/update all. |

### Platform
| Table | Key columns | RLS summary |
|---|---|---|
| `feedback` | `id`, `user_id`, `type ('bug'\|'feature'\|'general')`, `content` (≤4000 chars, `feedback_capture.sql`), `page_path` (submitting route — **deliberately excluded from the triage Edge Function's select list**, since a path can embed a play id and triage output reaches public PRs), `status ('pending'\|'reviewed'\|'resolved')`, timestamps. Triage columns (B-35, `feedback_triage.sql`): `triage_class ('bug'\|'feature'\|'general'\|'spam'\|'injection')`, `triage_state ('untriaged'\|'triaged'\|'skipped'\|'flagged')`, `triage_ref`, `triage_notes`, `triaged_at` | User inserts/reads own; admins read+update all (`feedback_admin.sql`). No DELETE policy exists — nobody can delete feedback via the client. **`status` is the human admin workflow** (shown in `FeedbackManagement.tsx`); **`triage_state` is the agent's**, deliberately separate so automation can't make the admin UI misreport what a human has reviewed. Triage columns are written only by the `feedback-triage` Edge Function (service role). |
| `blog_posts` | `id`, `author_id`, `title`, `content`, `slug` (unique), `description`, `status ('draft'\|'published')`, `published_at`, timestamps | Public SELECT of published rows only; admins see drafts and manage all (RLS + `enforce_admin_blog_posts` trigger). Served at `/blog/<slug>`; listed in `/sitemap.xml` (edge fn `sitemap`). |
| `admin_users` | `user_id` (PK→auth.users), `created_at` | Only admins can SELECT. Insert via SQL only. Grant admin: `INSERT INTO admin_users (user_id) SELECT id FROM auth.users WHERE email='you@example.com';` |
| `subscriptions` | `user_id` (PK), `plan ('free'\|'founding'\|'pro')`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, timestamps | User reads **own only**. Writes via Stripe webhook (service role) / admin SQL only — never the client. |
| `user_preferences` | `user_id` (PK), `team_name`, `team_logo_url`, `default_game_format ('5v5'\|'6v6'\|'7v7'\|'11v11')`, `default_visibility ('private'\|'public')`, `default_play_type`, `paper_size ('letter'\|'a4')`, `default_export_style ('simple'\|'detailed'\|'grid')`, `custom_roster jsonb` (saved toolbar rosters, `custom_roster.sql`), timestamps | User CRUD **own row only** (`user_preferences.sql`, B-14/B-15). Absent row = client defaults. |

### Storage
- Bucket **`avatars`** (public, 2 MB limit, image MIME types). Users may
  upload/update/delete only within their own `auth.uid()` folder; public read.

## Functions
| Function | Purpose |
|---|---|
| `is_admin() → bool` | True if caller is in `admin_users`. `SECURITY DEFINER`, `search_path` pinned. Use in RLS. |
| `is_pro(uid uuid = auth.uid()) → bool` | True if caller has an active `founding`/`pro` subscription. `SECURITY DEFINER`, pinned. |
| `admin_list_users()` | Admin-gated; all users w/ email, username, created_at, is_admin flag, plus entitlement columns `plan` (`COALESCE(s.plan,'free')` — no row = free), `current_period_end`, `is_stripe_backed` (`admin_entitlements.sql`). |
| `admin_list_feedback()` | Admin-gated; feedback rows joined to submitter email. |
| `delete_user(target_user_id uuid)` | Admin-gated; deletes the auth account (cascades). Blocks self-deletion. |
| `admin_set_user_plan(target_user_id uuid, new_plan text)` | Admin-gated; sets a user's entitlement from the Admin Dashboard (upsert, `current_period_end` NULL). Only `'free'`/`'founding'` are settable — `'pro'` belongs to the Stripe webhook. Refuses any row with a `stripe_subscription_id`. All rejections raise `PBP06` (`admin_entitlements.sql`). |
| `get_community_authors(target_ids uuid[])` | Returns `id, username, avatar_url` for a batch of authors (Community page; avoids embedding a nonexistent `profiles` table). Granted to anon+authenticated. |
| `get_top_contributors(result_limit int)` | Returns `id, username, avatar_url, reputation` for the top N posters by reputation (>0 only). Granted to anon+authenticated. |
| `enforce_plays_free_limit()` / `enforce_playbooks_free_limit()` | Trigger fns: raise `PBP01`/`PBP02` (custom SQLSTATE, user-safe message) when a non-`is_pro()` user's insert would exceed `FREE_LIMITS.plays`/`FREE_LIMITS.playbooks`. Client maps these codes to an upgrade prompt in `src/lib/errors.ts`. |
| `clone_playbook_pack(pack_playbook_id uuid) → uuid` | `SECURITY DEFINER`, pinned `search_path`. B-33: clones a public playbook + its plays (private copies, preserving order) into the caller's own account, returning the new playbook id. Raises `PBP04` if the caller isn't `is_pro()`, `PBP05` if `pack_playbook_id` isn't a public playbook. Granted to `authenticated`. |
| `handle_new_user_signup()` | Trigger fn: on `auth.users` insert, creates a `user_reputation` row with a default avatar. |
| `update_updated_at_column()` | Generic `updated_at` touch trigger. |
| `update_user_reputation()` | Trigger fn: bumps poster reputation on new post/comment. |
| `update_post_vote_counts()` / comment equivalent | Trigger fns: maintain `upvotes`/`downvotes` from `votes`. |
| `update_play_vote_counts()` | Trigger fn: maintains `plays.upvotes` from `play_votes`. `SECURITY DEFINER`, pinned `search_path` (voters can't UPDATE others' plays rows under RLS). |
| `enforce_admin_blog_posts()` | Trigger fn: blocks non-admins from writing `blog_posts`. |
| `handle_approved_report()` | Trigger fn for `image_reports` resolution. |

## Known caveats
- `combined_migrations.sql` defines several tables/policies **multiple times**
  across bundled migrations; only the final definition is live. This doc reflects
  the final state — trust it over a mid-file grep.
- The client only ever uses the **anon key**; all access is RLS-enforced. There is
  no server/API layer (static SPA + Supabase).
