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
 */
export function getSafeErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err instanceof Error && err.name === 'PostgrestError') {
    console.error('Database error:', err);
    const code = (err as Error & { code?: string }).code;
    if (code === '23505') return 'That already exists.';
    if (code === '23503') return 'That item could not be found or no longer exists.';
    if (code === '42501' || /row-level security/i.test(err.message)) {
      return "You don't have permission to do that.";
    }
    return fallback;
  }

  return err instanceof Error ? err.message : fallback;
}
