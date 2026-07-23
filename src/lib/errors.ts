/**
 * Returns a user-safe message for an error caught from a Supabase call.
 *
 * Postgrest/Postgres errors (thrown from .from() table queries) carry
 * internal details in their `.message` — table/column/constraint names,
 * RLS policy text — that should never be shown to end users; they're
 * mapped to a generic, safe message instead (the original error is still
 * logged for debugging). Supabase Auth errors and our own hand-written
 * `throw new Error('...')` validation messages are already written to be
 * user-facing, so they pass through unchanged.
 *
 * Note: this codebase's `.insert()/.update()` calls don't use `.throwOnError()`,
 * so the caught value is the raw parsed Postgrest error JSON
 * (`{code, message, details, hint}`), not an `Error`/`PostgrestError`
 * instance — detect it by shape rather than by `instanceof`/`.name`.
 */
export function getSafeErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const isPostgrestError =
    typeof err === 'object' && err !== null &&
    'code' in err && 'message' in err && 'details' in err && 'hint' in err;

  if (isPostgrestError) {
    console.error('Database error:', err);
    const { code, message } = err as { code: unknown; message: unknown };
    if (code === '23505') return 'That already exists.';
    if (code === '23503') return 'That item could not be found or no longer exists.';
    // Free-tier limit triggers (see supabase/free_tier_limits.sql) and the
    // playbook pack clone function (supabase/playbook_packs.sql) raise these
    // custom codes with an already user-safe, upgrade-prompt message.
    if (code === 'PBP01' || code === 'PBP02' || code === 'PBP03' || code === 'PBP04') return String(message);
    if (code === '42501' || (typeof message === 'string' && /row-level security/i.test(message))) {
      return "You don't have permission to do that.";
    }
    return fallback;
  }

  return err instanceof Error ? err.message : fallback;
}
