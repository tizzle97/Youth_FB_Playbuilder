// Daily feedback digest — emails the admin everything that arrived since the
// last successful send.
//
// Deploy with JWT verification DISABLED (the caller is pg_cron, which has no
// Supabase session):
//   supabase functions deploy feedback-notify --no-verify-jwt
// Security comes from the shared secret below — every request must carry
// `x-notify-secret: <FEEDBACK_NOTIFY_SECRET>`.
//
// Required secrets (supabase secrets set KEY=value):
//   FEEDBACK_NOTIFY_SECRET — long random string, also used by the cron job
//   RESEND_API_KEY         — a Resend *API key* (re_...). NOT the SMTP
//                            credential in supabase/EMAIL_SETUP.md — that one
//                            is configured in the Supabase dashboard for auth
//                            emails and isn't reachable from app code.
//   FEEDBACK_DIGEST_TO     — where the digest lands (comma-separated allowed)
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// WHY THIS EXISTS: nothing told anyone feedback had arrived. The admin found
// out by remembering to open /admin, and the triage agent only ever routes
// what it can act on. Submissions could sit unseen indefinitely.
//
// ⚠ PRIVACY, AND HOW IT DIFFERS FROM feedback-triage: that function
// deliberately withholds `user_id` and the submitter's email because its
// output lands in public PRs and BACKLOG entries. This one goes to a single
// admin inbox, so including the submitter's email is correct and intended —
// it's how the admin knows who to follow up with. Do not "fix" this to match
// triage.
//
// Pure rendering/comparison logic lives in ./digest.ts so it can be exercised
// without a Deno runtime or a live Resend key.
//
//   POST /  → send the digest, mark those rows notified

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  FROM,
  MAX_ITEMS,
  recipients,
  renderDigest,
  secretMatches,
  subjectFor,
  type Row,
} from './digest.ts';

const notifySecret = Deno.env.get('FEEDBACK_NOTIFY_SECRET') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const digestTo = Deno.env.get('FEEDBACK_DIGEST_TO') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get('x-notify-secret') ?? '', notifySecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  // Fail loudly on misconfiguration rather than reporting a successful no-op
  // every night while nothing is actually being delivered.
  if (!resendApiKey || !digestTo) {
    console.error('feedback-notify: RESEND_API_KEY or FEEDBACK_DIGEST_TO is unset');
    return json({ error: 'Not configured' }, 500);
  }

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('id, type, content, page_path, created_at, user_id')
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(MAX_ITEMS);
    if (error) throw error;

    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return json({ sent: false, count: 0 });

    // Resolve submitter emails in one admin call rather than N joins.
    const emails = new Map<string, string>();
    const userIds = new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id));
    if (userIds.size > 0) {
      const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of users?.users ?? []) {
        if (u.email && userIds.has(u.id)) emails.set(u.id, u.email);
      }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: recipients(digestTo),
        subject: subjectFor(rows.length),
        html: renderDigest(rows, emails),
      }),
    });

    if (!res.ok) {
      // Deliberately do NOT mark the rows. A Resend outage must retry
      // tomorrow, not silently swallow a day of feedback.
      console.error('feedback-notify: Resend rejected the send', res.status, await res.text());
      return json({ error: 'Send failed' }, 502);
    }

    const { error: markError } = await supabase
      .from('feedback')
      .update({ notified_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    // The email is already out. Surface the bookkeeping failure rather than
    // pretending it worked — the only cost of not marking is a duplicate
    // digest tomorrow, which is far better than a lost one.
    if (markError) {
      console.error('feedback-notify: sent but failed to mark notified', markError);
      return json({ sent: true, count: rows.length, marked: false }, 500);
    }

    return json({ sent: true, count: rows.length, marked: true });
  } catch (err) {
    // Never echo the raw error to the caller — it can carry schema details.
    console.error('feedback-notify error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
