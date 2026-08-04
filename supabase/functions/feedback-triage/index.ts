// Feedback triage queue API for the scheduled triage agent (B-35).
//
// Deploy with JWT verification DISABLED (the agent has no Supabase session):
//   supabase functions deploy feedback-triage --no-verify-jwt
// Security comes from the shared secret check below — every request must
// carry `x-triage-secret: <FEEDBACK_TRIAGE_SECRET>`.
//
// Required secret (supabase secrets set KEY=value):
//   FEEDBACK_TRIAGE_SECRET — long random string, also set in the routine env
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// WHY THIS EXISTS instead of giving the agent a service-role key: that key
// bypasses RLS on every table (users, subscriptions, plays). This function is
// the entire blast radius of a leaked triage token — read feedback text, and
// mark it triaged. Nothing else.
//
//   GET  /?limit=25  → oldest untriaged feedback
//   POST /           → { id, triage_state, triage_class?, triage_ref?, triage_notes? }

import { createClient } from 'npm:@supabase/supabase-js@2';

const triageSecret = Deno.env.get('FEEDBACK_TRIAGE_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Feedback content has no length cap at the DB level and no rate limiting, so
// a single submission could be megabytes. Truncate before it ever reaches the
// agent's context window.
const MAX_CONTENT_CHARS = 4000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const TRIAGE_STATES = ['untriaged', 'triaged', 'skipped', 'flagged'];
const TRIAGE_CLASSES = ['bug', 'feature', 'general', 'spam', 'injection'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Length-independent comparison, so response timing can't be used to guess
 *  the secret byte by byte. */
function secretMatches(provided: string): boolean {
  if (!triageSecret) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(triageSecret);
  // Fold length into the result rather than early-returning on it.
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get('x-triage-secret') ?? '')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const requested = Number(url.searchParams.get('limit'));
      const limit = Number.isFinite(requested) && requested > 0
        ? Math.min(requested, MAX_LIMIT)
        : DEFAULT_LIMIT;

      // NOTE: the select list is a privacy guarantee, not just an
      // optimization. `user_id` and the submitter's email (which
      // admin_list_feedback() does join) are deliberately NOT returned —
      // triage output ends up in public PRs and BACKLOG entries, and no user
      // PII should ever land there.
      const { data, error } = await supabase
        .from('feedback')
        .select('id, type, content, created_at')
        .eq('triage_state', 'untriaged')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;

      const items = (data ?? []).map((row) => ({
        ...row,
        content: (row.content ?? '').slice(0, MAX_CONTENT_CHARS),
        truncated: (row.content ?? '').length > MAX_CONTENT_CHARS,
      }));
      return json({ items, count: items.length });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || typeof body.id !== 'string') {
        return json({ error: 'Body must include an `id` string' }, 400);
      }
      // Check the shape here rather than letting Postgres reject the cast —
      // otherwise a typo'd id surfaces as a 500 and looks like a server bug.
      if (!UUID_RE.test(body.id)) {
        return json({ error: '`id` must be a uuid' }, 400);
      }
      // Validate enums server-side: a confused or misled agent must not be
      // able to write arbitrary values, and leaving a row 'untriaged' via
      // this endpoint would let it silently loop forever.
      if (!TRIAGE_STATES.includes(body.triage_state) || body.triage_state === 'untriaged') {
        return json(
          { error: `triage_state must be one of: triaged, skipped, flagged` },
          400,
        );
      }
      if (body.triage_class !== undefined && !TRIAGE_CLASSES.includes(body.triage_class)) {
        return json({ error: `triage_class must be one of: ${TRIAGE_CLASSES.join(', ')}` }, 400);
      }

      const { data, error } = await supabase
        .from('feedback')
        .update({
          triage_state: body.triage_state,
          triage_class: body.triage_class ?? null,
          triage_ref: typeof body.triage_ref === 'string' ? body.triage_ref.slice(0, 500) : null,
          triage_notes: typeof body.triage_notes === 'string' ? body.triage_notes.slice(0, 2000) : null,
          triaged_at: new Date().toISOString(),
        })
        .eq('id', body.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'No feedback row with that id' }, 404);

      return json({ updated: data.id });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    // Never echo the raw error to the caller — it can carry schema details.
    console.error('feedback-triage error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
