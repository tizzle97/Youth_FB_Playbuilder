// Shared sender address for Edge Functions that send via Resend's HTTP API
// directly (bypassing Supabase Auth's SMTP config entirely).
//
// Must match the domain Resend actually verified — send.playbuilderpro.com,
// not the root domain, which has no SPF record. Sending "from" a domain
// that isn't the one authorized to send is exactly what SPF/DKIM alignment
// checks for; using the root domain here caused feedback-notify's digest
// emails to carry the same misalignment already fixed for Supabase Auth
// (see supabase/EMAIL_SETUP.md §2). Keep this the single source of truth so
// a future domain change doesn't need to be hunted down per-function again.
export const FEEDBACK_FROM = 'Playbuilder Pro <noreply@send.playbuilderpro.com>';
