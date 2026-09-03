# Frozen — this is NOT the live migration channel

These 15 timestamped files are the original Supabase CLI migration history
(Feb–Jun 2025). **Nothing here has changed since 2025 and nothing new should be
added here.**

## Where migrations actually live

New schema changes are **plain `.sql` files in `supabase/` (the parent
directory)**, run **by hand in the Supabase SQL Editor**. There is no automated
migration runner. See `CLAUDE.md` → "Database / migrations workflow", and read
`supabase/SCHEMA.md` for the current schema rather than reconstructing it from
either set of files.

## Why this directory still exists

The Supabase CLI is linked to the live project (`supabase/.temp/linked-project.json`),
and the CLI reads this directory. Deleting it would leave the local migration
history diverged from the remote `supabase_migrations.schema_migrations` table,
which `supabase db push`/`db diff` compare against. It stays for that reason
alone — not because it describes the current schema.
