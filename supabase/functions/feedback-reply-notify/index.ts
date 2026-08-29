// Emails a feedback submitter when an admin replies in the Admin Console.
//
// Deploy WITH JWT verification enabled (default) — unlike feedback-notify,
// the caller here is a signed-in admin's browser session, not pg_cron:
//   supabase functions deploy feedback-reply-notify
// Authorization comes from the caller's JWT: this function calls is_admin()
// as that user before doing anything, the same gate admin_list_feedback()
// uses on the SQL side.
//
// Required secrets (supabase secrets set KEY=value):
//   RESEND_API_KEY — same Resend API key feedback-notify uses. NOT the SMTP
//                    credential configured in the Supabase dashboard.
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Called from FeedbackManagement.tsx's saveReply() right after a reply is
// saved for the first time (not on edits or on clearing a reply).
//
//   POST { feedbackId: string } → send the notification

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { FEEDBACK_FROM } from '../_shared/email.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const MAX_EXCERPT = 500;
const excerpt = (s: string) => (s.length > MAX_EXCERPT ? `${s.slice(0, MAX_EXCERPT)}…` : s);

function renderReplyEmail(feedbackExcerpt: string, reply: string): string {
  return `<div style="background-color:#eef1f5; padding:32px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e6ea;">
      <tr>
        <td style="background:linear-gradient(135deg,#16283D,#101D2E); padding:28px 32px; text-align:center;">
          <span style="font-size:20px; font-weight:700; letter-spacing:0.02em; color:#F8F6F1;">
            PLAYBUILDER<span style="color:#1FA75D;">PRO</span>
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 32px 8px 32px;">
          <h1 style="margin:0 0 16px 0; font-size:20px; line-height:1.3; color:#101D2E;">
            You've got a reply!
          </h1>
          <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6; color:#3c4a5c;">
            We replied to the feedback you sent us:
          </p>
          <div style="margin:0 0 16px 0; padding:14px 16px; background-color:#f7f8fa; border-left:3px solid #dcd8ce; border-radius:6px; font-size:14px; line-height:1.6; color:#666; white-space:pre-wrap;">
            ${escapeHtml(feedbackExcerpt)}
          </div>
          <div style="margin:0 0 8px 0; padding:14px 16px; background-color:#eafaf1; border-left:3px solid #1FA75D; border-radius:6px; font-size:14px; line-height:1.6; color:#101D2E; white-space:pre-wrap;">
            ${escapeHtml(reply)}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px; background-color:#f7f8fa; border-top:1px solid #e2e6ea;">
          <p style="margin:0; font-size:12px; line-height:1.6; color:#9aa5b1; text-align:center;">
            Questions? <a href="mailto:support@playbuilderpro.com" style="color:#178B4D;">support@playbuilderpro.com</a>
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin');
  if (adminCheckError || !isAdmin) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (!resendApiKey) {
    console.error('feedback-reply-notify: RESEND_API_KEY is unset');
    return jsonResponse({ error: 'Not configured' }, 500);
  }

  let feedbackId: string;
  try {
    const body = await req.json();
    feedbackId = body.feedbackId;
    if (!feedbackId) throw new Error('missing feedbackId');
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: row, error: rowError } = await admin
      .from('feedback')
      .select('user_id, content, admin_reply')
      .eq('id', feedbackId)
      .single();
    if (rowError || !row) throw rowError ?? new Error('feedback row not found');
    if (!row.user_id || !row.admin_reply) {
      return jsonResponse({ error: 'Nothing to notify' }, 400);
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.user_id);
    if (userError || !userData?.user?.email) {
      console.error('feedback-reply-notify: could not resolve submitter email', userError);
      return jsonResponse({ error: 'Submitter has no resolvable email' }, 404);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FEEDBACK_FROM,
        to: [userData.user.email],
        subject: 'Playbuilder Pro replied to your feedback',
        html: renderReplyEmail(excerpt(row.content), row.admin_reply),
      }),
    });

    if (!res.ok) {
      console.error('feedback-reply-notify: Resend rejected the send', res.status, await res.text());
      return jsonResponse({ error: 'Send failed' }, 502);
    }

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error('feedback-reply-notify error:', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
