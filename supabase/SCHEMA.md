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
| `security_hardening.sql` | **verify applied** | Pins `search_path` on `is_admin()`/`is_pro()`; drops the unsafe `user_reputation` write policy; switches `image_reports` moderator policies to `is_admin()`. |
| `community_authors.sql` | **verify applied** | `get_community_authors(uuid[])` for Community post author display. |
| `free_tier_limits.sql` | **verify applied** | `BEFORE INSERT` triggers on `plays`/`playbooks` blocking free-plan users past `FREE_LIMITS` (15 plays / 2 playbooks). |
| `founding_member_backfill.sql` | **needs running** | Re-runs the Founding Member grandfathering `INSERT` from `subscriptions.sql` to catch users who signed up between that original run and now (free-tier gates went live in the meantime). Idempotent — safe to run again. |

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
| `plays` | `id`, `user_id`, `name`, `type play_type`, `formation_id`, `canvas_data text` (JSON `{version,paths,playerIcons}`), `description`, `thumbnail`, `is_public bool`, `metadata jsonb`, timestamps | Owner full access (`auth.uid()=user_id`); admins manage all; **anyone** (anon+auth) can SELECT where `is_public=true`. `BEFORE INSERT` trigger blocks a 16th row for non-`is_pro()` users (`free_tier_limits.sql`). |
| `playbooks` | `id`, `user_id`, `name`, `description`, timestamps | Owner full access. `BEFORE INSERT` trigger blocks a 3rd row for non-`is_pro()` users (`free_tier_limits.sql`). |
| `playbook_plays` | `id`, `playbook_id`, `play_id`, `order_position`; UNIQUE`(playbook_id,play_id)` & `(playbook_id,order_position)` | Access via owning playbook (`playbooks.user_id=auth.uid()`). |
| `formations` | `id`, `user_id`, `name`, `type`, `template`, `is_system bool` | Read if `is_system` or owner; manage own non-system rows. |
| `categories` | `id`, `name`, `type`, `parent_id`, `playbook_id`, `order_position` | Access via owning playbook. |

### Community / social
| Table | Key columns | RLS summary |
|---|---|---|
| `posts` | `id`, `user_id`, `title`, `content`, `upvotes`, `downvotes`, timestamps | SELECT public (`true`); insert/update/delete own. |
| `comments` | `id`, `user_id`, `post_id`, `parent_id`, `content`, `upvotes`, `downvotes` | SELECT public; CRUD own; admins can delete any. |
| `votes` | `id`, `user_id`, `post_id?`, `comment_id?`, `vote_type bool`; UNIQUE per user+target | SELECT public; CRUD own. Target check: exactly one of post/comment. |
| `user_reputation` | `id`, `user_id` (unique), `reputation int`, `avatar_type`, `avatar_url`, `avatar_icon_id→avatar_icons` | SELECT public; user may UPDATE own (avatar). **Writes to reputation happen via trigger only** (the old catch-all write policy was dropped in `security_hardening.sql`). |
| `avatar_icons` | `id`, `icon_url`, `name` | SELECT public; seeded with default bot avatars. |
| `image_reports` | `id`, `reporter_id`, `reported_user_id`, `image_url`, `reason`, `status`, `resolver_id` | Reporter inserts/reads own; **admins** (via `is_admin()`) read/update all. |

### Platform
| Table | Key columns | RLS summary |
|---|---|---|
| `feedback` | `id`, `user_id`, `type ('bug'\|'feature'\|'general')`, `content`, `status ('pending'\|'reviewed'\|'resolved')`, timestamps | User inserts/reads own; admins read+update all (`feedback_admin.sql`). |
| `blog_posts` | `id`, `author_id`, `title`, `content`, `published_at`, timestamps | SELECT public; only admins manage (RLS + `enforce_admin_blog_posts` trigger). |
| `admin_users` | `user_id` (PK→auth.users), `created_at` | Only admins can SELECT. Insert via SQL only. Grant admin: `INSERT INTO admin_users (user_id) SELECT id FROM auth.users WHERE email='you@example.com';` |
| `subscriptions` | `user_id` (PK), `plan ('free'\|'founding'\|'pro')`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, timestamps | User reads **own only**. Writes via Stripe webhook (service role) / admin SQL only — never the client. |

### Storage
- Bucket **`avatars`** (public, 2 MB limit, image MIME types). Users may
  upload/update/delete only within their own `auth.uid()` folder; public read.

## Functions
| Function | Purpose |
|---|---|
| `is_admin() → bool` | True if caller is in `admin_users`. `SECURITY DEFINER`, `search_path` pinned. Use in RLS. |
| `is_pro(uid uuid = auth.uid()) → bool` | True if caller has an active `founding`/`pro` subscription. `SECURITY DEFINER`, pinned. |
| `admin_list_users()` | Admin-gated; all users w/ email, username, created_at, is_admin flag. |
| `admin_list_feedback()` | Admin-gated; feedback rows joined to submitter email. |
| `delete_user(target_user_id uuid)` | Admin-gated; deletes the auth account (cascades). Blocks self-deletion. |
| `get_community_authors(target_ids uuid[])` | Returns `id, username, avatar_url` for a batch of authors (Community page; avoids embedding a nonexistent `profiles` table). Granted to anon+authenticated. |
| `enforce_plays_free_limit()` / `enforce_playbooks_free_limit()` | Trigger fns: raise `PBP01`/`PBP02` (custom SQLSTATE, user-safe message) when a non-`is_pro()` user's insert would exceed `FREE_LIMITS.plays`/`FREE_LIMITS.playbooks`. Client maps these codes to an upgrade prompt in `src/lib/errors.ts`. |
| `handle_new_user_signup()` | Trigger fn: on `auth.users` insert, creates a `user_reputation` row with a default avatar. |
| `update_updated_at_column()` | Generic `updated_at` touch trigger. |
| `update_user_reputation()` | Trigger fn: bumps poster reputation on new post/comment. |
| `update_post_vote_counts()` / comment equivalent | Trigger fns: maintain `upvotes`/`downvotes` from `votes`. |
| `enforce_admin_blog_posts()` | Trigger fn: blocks non-admins from writing `blog_posts`. |
| `handle_approved_report()` | Trigger fn for `image_reports` resolution. |

## Known caveats
- `combined_migrations.sql` defines several tables/policies **multiple times**
  across bundled migrations; only the final definition is live. This doc reflects
  the final state — trust it over a mid-file grep.
- The client only ever uses the **anon key**; all access is RLS-enforced. There is
  no server/API layer (static SPA + Supabase).
