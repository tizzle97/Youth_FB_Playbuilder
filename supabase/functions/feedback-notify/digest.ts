// Pure helpers for the feedback digest, split out of index.ts so they can be
// exercised without a Deno runtime or a live Resend key. No Deno globals and
// no npm imports in this file — that's the whole point of it existing.

import { FEEDBACK_FROM } from '../_shared/email.ts';

/** Cap the batch so one spam burst can't produce a megabyte email. Anything
 *  beyond this stays unnotified and rolls into tomorrow's digest. */
export const MAX_ITEMS = 50;

/** Per-item excerpt in the email body. The full text is one click away in
 *  /admin, and a digest is a prompt to go look, not a replacement for looking. */
export const MAX_EXCERPT = 500;

const FROM = FEEDBACK_FROM;
const SITE = 'https://playbuilderpro.com';

export interface Row {
  id: string;
  type: string;
  content: string;
  page_path: string | null;
  created_at: string;
  user_id: string | null;
}

/** Length-independent comparison, so response timing can't be used to guess
 *  the secret byte by byte. Same shape as feedback-triage's.
 *  Returns false when `expected` is empty — an unset secret must fail closed,
 *  never accept an empty header. */
export function secretMatches(provided: string, expected: string): boolean {
  if (!expected) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  // Fold length into the result rather than early-returning on it.
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const subjectFor = (count: number) =>
  `${count} new piece${count === 1 ? '' : 's'} of Playbuilder Pro feedback`;

export const recipients = (digestTo: string) =>
  digestTo.split(',').map((s) => s.trim()).filter(Boolean);

/** Table-based layout and inline styles, matching supabase/email-templates/ —
 *  Outlook desktop strips <style> blocks and ignores most modern CSS. */
export function renderDigest(rows: Row[], emails: Map<string, string>): string {
  const items = rows.map((r) => {
    const who = (r.user_id && emails.get(r.user_id)) || 'Unknown user';
    const excerpt = r.content.length > MAX_EXCERPT
      ? `${r.content.slice(0, MAX_EXCERPT)}…`
      : r.content;
    return `
      <tr><td style="padding:12px 0;border-bottom:1px solid #dcd8ce;">
        <div style="font:600 12px/1.4 Arial,sans-serif;color:#178B4D;text-transform:uppercase;letter-spacing:.04em;">
          ${escapeHtml(r.type)}
        </div>
        <div style="font:400 12px/1.4 Arial,sans-serif;color:#666;margin:2px 0 6px;">
          ${escapeHtml(who)} · ${new Date(r.created_at).toUTCString()}${r.page_path ? ` · on ${escapeHtml(r.page_path)}` : ''}
        </div>
        <div style="font:400 14px/1.5 Arial,sans-serif;color:#101D2E;white-space:pre-wrap;">
          ${escapeHtml(excerpt)}
        </div>
      </td></tr>`;
  }).join('');

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F8F6F1;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;">
      <tr><td style="padding-bottom:8px;">
        <span style="font:700 20px/1 Arial,sans-serif;color:#101D2E;">PLAYBUILDER</span><span style="font:700 20px/1 Arial,sans-serif;color:#1FA75D;">PRO</span>
      </td></tr>
      <tr><td style="font:700 18px/1.4 Arial,sans-serif;color:#101D2E;padding-bottom:4px;">
        ${rows.length} new piece${rows.length === 1 ? '' : 's'} of feedback
      </td></tr>
      <tr><td style="font:400 13px/1.5 Arial,sans-serif;color:#666;padding-bottom:8px;">
        Excerpts only — open the admin dashboard to read, reply, and set status.
      </td></tr>
      ${items}
      <tr><td style="padding-top:20px;">
        <a href="${SITE}/admin" style="display:inline-block;background:#1FA75D;color:#fff;font:600 14px/1 Arial,sans-serif;padding:12px 20px;border-radius:6px;text-decoration:none;">
          Open the admin dashboard
        </a>
      </td></tr>
    </table>
  </body></html>`;
}

export { FROM, SITE };
