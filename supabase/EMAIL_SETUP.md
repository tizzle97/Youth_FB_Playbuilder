# Email confirmation + branded auth emails — step-by-step

Everything below is a **human task** (Jeremy) — all three steps live in the
Supabase dashboard (and Resend's), not in this repo's code or migrations.
`AuthPage.tsx` already handles both outcomes of signup (session returned =
signed in immediately; no session = "check your email") — no app code
changes are needed for step 1.

**Do these in order.** Turning on email confirmation (step 1) before custom
SMTP is live (step 2) means every signup starts sending real confirmation
emails through Supabase's built-in sender, which is rate-limited to a
handful of emails per hour and meant for testing only — real signups would
start failing almost immediately.

## 1. Custom SMTP (Resend) — do this first

1. Sign up at https://resend.com (free tier: 3,000 emails/month, more than
   enough for signup/reset volume at this stage).
2. **Domains → Add Domain** → enter `playbuilderpro.com` (or a subdomain
   like `mail.playbuilderpro.com` if you'd rather keep sending fully
   separate from the root domain — either works).
3. Resend shows a handful of DNS records (SPF `TXT`, DKIM `CNAME`s, and a
   recommended `DMARC` record). Add each one at whatever DNS provider hosts
   `playbuilderpro.com`'s records (Netlify DNS if that's where the domain's
   nameservers point, otherwise your registrar). This does **not** touch
   Zoho's existing MX records for `support@playbuilderpro.com` — SPF/DKIM
   are separate DNS record types from mail routing, so receiving mail at
   Zoho keeps working unchanged.
4. Wait for Resend to show the domain as **Verified** (usually minutes,
   occasionally longer depending on DNS propagation).
5. **API Keys → Create API Key** — copy it (`re_...`). Treat it like a
   password; it goes into Supabase's dashboard in the next step, never into
   this repo.

## 2. Point Supabase at Resend's SMTP

⚠ **2026-08-28: verification emails were landing in junk.** DNS shows Resend
was verified against the subdomain `send.playbuilderpro.com` (SPF/DKIM/MX all
live there — `dig TXT send.playbuilderpro.com` shows an SPF include for
`amazonses.com`), but Supabase's configured sender address was
`noreply@playbuilderpro.com` — the **root** domain, which has no SPF record
at all (`dig TXT playbuilderpro.com` returns only a Zoho domain-verification
string). Sending "from" a domain that isn't the one actually authorized to
send is exactly what SPF/DKIM alignment is checking for, and receiving
mail servers treat the mismatch as a signal to junk it. The `send.`
subdomain's own SPF record was *also* malformed — two terminating `~all`
mechanisms in one record (`... ~all include:zohomail.com ~all`), which is
invalid SPF syntax and can itself cause a permanent SPF error. **Fixed by
sending from the subdomain that's actually verified, not the root.**

1. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
   (sometimes listed under Auth → Settings → "Enable Custom SMTP").
2. Toggle **Enable Custom SMTP** on, then fill in:
   - **Sender email:** `noreply@send.playbuilderpro.com` — **not**
     `noreply@playbuilderpro.com`. This must match the domain Resend actually
     verified (check the Resend dashboard's Domains page for the exact
     domain/subdomain marked **Verified** if this ever changes again).
   - **Sender name:** `Playbuilder Pro`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend` (literally that string, not your email)
   - **Password:** the API key from step 1
3. **Fix the malformed SPF record** on `send.playbuilderpro.com` at whatever
   DNS provider hosts it (nameservers are `*.p06.nsone.net` — NS1, not
   Netlify DNS) — replace the current TXT value with a single valid record:
   ```
   v=spf1 include:amazonses.com ~all
   ```
   (Drop `include:zohomail.com` and the second `~all` — Zoho doesn't send
   from this subdomain, only Resend/SES does; that Zoho include was almost
   certainly copy-pasted from what was intended for the root domain.)
4. In the Resend dashboard, re-check the Domains page for `send.playbuilderpro.com`
   and confirm DKIM shows **Verified** too, not just SPF — copy the exact
   DKIM CNAME record(s) shown there if any are still pending; they weren't
   findable by guessing common selector names from outside the dashboard.
5. Save, then use Supabase's "Send test email" button if it offers one —
   confirm it actually lands in an inbox before moving on. Once real mail is
   flowing, check the message headers (Gmail: **Show original**) for
   `spf=pass`, `dkim=pass`, `dmarc=pass` against `send.playbuilderpro.com` —
   don't just trust that it landed in the inbox once.

## 3. Turn on "Confirm email"

1. Supabase Dashboard → **Authentication → Sign In / Providers → Email**.
2. Toggle **Confirm email** on. Save.
3. **Authentication → URL Configuration** — confirm **Site URL** is
   `https://playbuilderpro.com` (this is where Supabase sends users after
   they click the confirmation link, since `AuthPage.tsx`'s `signUp()` call
   doesn't pass an explicit `emailRedirectTo`). Also confirm
   `https://playbuilderpro.com/**` is in the **Redirect URLs** allowlist —
   Supabase rejects redirects to URLs not on that list.

## 4. Paste in the branded templates

Supabase Dashboard → **Authentication → Emails → Templates**. Two templates
to update, HTML is in this repo so it's versioned and reviewable:

- **Confirm signup** — subject `Confirm your Playbuilder Pro account`,
  body from [`supabase/email-templates/confirm-signup.html`](email-templates/confirm-signup.html).
  Personalizes with the signup username (`{{ .Data.username }}`, which
  `AuthPage.tsx` already passes at signup) when present.
- **Reset Password** — subject `Reset your Playbuilder Pro password`,
  body from [`supabase/email-templates/reset-password.html`](email-templates/reset-password.html).

Paste each file's contents into the matching template's HTML body field in
the dashboard editor (there's no API/CLI path for this — it's dashboard-only).
Magic Link / Invite / Change Email templates are unused by the app today
(password auth only, no invite flow) — leave them on Supabase's default
unless that changes.

## 5. Test checklist

- [ ] Sign up with a real, reachable email address you control.
- [ ] Confirmation email arrives within a minute or two, from
      `noreply@playbuilderpro.com`, with Playbuilder Pro branding (not the
      generic Supabase template) and — if you set a username at signup —
      addressed to you by name.
- [ ] Clicking **Confirm my account** lands back on `playbuilderpro.com`
      signed in.
- [ ] Signing up again with the **same** email before confirming shows the
      same "check your email" message as a fresh signup (this is
      intentional — `AuthPage.tsx` deliberately doesn't reveal that the
      email is already registered, to avoid account enumeration).
- [ ] An **unconfirmed** account cannot sign in yet (Supabase blocks it
      until the email is confirmed) — confirm this shows a clear error,
      not a confusing one.
- [ ] **Forgot your password?** flow sends the branded Reset Password
      email and the link lands on `/auth/reset-password` working correctly.
- [ ] Sign up ~5 times in a row (throwaway addresses) to sanity-check
      you're nowhere near Resend's rate limits at expected signup volume.

## 6. Feedback digest (separate from everything above)

> **Status 2026-08-19:** the function is **deployed** — `POST` to
> `/functions/v1/feedback-notify` returns `401` (deployed, failing closed on a
> missing secret) rather than `404`. Steps 1–2 below are done.
> **Not confirmed:** whether `feedback_notify.sql`'s cron block was re-run with
> its two placeholders filled in. It was originally run *before* the function
> existed, so unless it was re-run, `cron.job` still POSTs nightly to a literal
> `<PROJECT-REF>` host and no digest is ever sent. Check with
> `SELECT command FROM cron.job WHERE jobname = 'feedback-digest';` — a literal
> `<` in the output means it's still broken. Re-running the file is safe; it
> unschedules first.


Steps 1–5 configure Resend as Supabase **Auth's** SMTP provider — signup
confirmations and password resets, sent by Supabase itself. The feedback digest
is a different path: the `feedback-notify` Edge Function calls **Resend's HTTP
API** directly, because app code can't reach Supabase's SMTP config.

That means it needs an **API key**, not the SMTP credential. Same Resend
account, same verified `send.playbuilderpro.com` subdomain, same
`noreply@send.playbuilderpro.com` sender (via the shared `FEEDBACK_FROM`
constant in `supabase/functions/_shared/email.ts`) — just a second key.

1. **Resend → API Keys → Create API Key.** Sending permission is enough.
2. Set the three secrets and deploy:
   ```sh
   openssl rand -hex 32                       # → FEEDBACK_NOTIFY_SECRET
   supabase secrets set FEEDBACK_NOTIFY_SECRET=<that value>
   supabase secrets set RESEND_API_KEY=<re_...>
   supabase secrets set FEEDBACK_DIGEST_TO=<your admin address>
   supabase functions deploy feedback-notify --no-verify-jwt
   ```
3. Run [`feedback_notify.sql`](feedback_notify.sql) — it adds
   `feedback.notified_at` and schedules the daily `pg_cron` job. Read the
   prerequisites at the top of that file first; `pg_cron` and `pg_net` have to
   be enabled in the dashboard, and two placeholders need filling in.
4. Smoke-test it by hand before trusting the schedule:
   ```sh
   curl -s -X POST -H "x-notify-secret: $FEEDBACK_NOTIFY_SECRET" \
     "https://<project-ref>.supabase.co/functions/v1/feedback-notify"
   # → {"sent":true,"count":N,"marked":true}   email should arrive
   # → run it again immediately: {"sent":false,"count":0}, no second email
   # → with a wrong/absent secret: 401
   ```

The digest **does** include the submitter's email address. That's the opposite
of the `feedback-triage` function, which withholds it deliberately — triage
output lands in public PRs, this goes to one admin inbox and the whole point is
knowing who to follow up with.

## 7. Reply notification (separate from the digest above)

When an admin replies to a piece of feedback in `/admin`, the submitter gets a
branded email — `feedback-reply-notify`, called directly from
`FeedbackManagement.tsx` right after the reply saves (only on a genuinely new
reply, not an edit or a clear). No new secret to set: it reuses
`RESEND_API_KEY` from step 6, and auth is the caller's own JWT (checked
against `is_admin()`) rather than a shared secret, since the caller is an
admin's browser session, not `pg_cron`.

Deploy it **with** JWT verification on (the default — no `--no-verify-jwt`,
unlike `feedback-notify`):
```sh
supabase functions deploy feedback-reply-notify
```

Smoke-test:
```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://<project-ref>.supabase.co/functions/v1/feedback-reply-notify" \
  -H 'Content-Type: application/json' -d '{}'
# → 401 with no Authorization header (JWT verification rejects it first)
```
A signed-in non-admin JWT gets **403** from the in-function `is_admin()`
check instead of 401 — see `supabase/SECRETS.md`'s verification table.

## Follow-up: tighten DMARC once the sender fix is confirmed

`_dmarc.playbuilderpro.com` is currently `v=DMARC1; p=none;` — monitor-only,
takes no enforcement action either way. Not the cause of the junk-folder
issue by itself, but a `p=none` policy also doesn't help inbox placement at
providers (like Gmail) that favor senders with a real, aligned DMARC policy.
**Don't tighten this yet** — do it only after confirming real signups are
landing in the inbox with SPF/DKIM/DMARC all passing (see step 5 above).
Move to `p=quarantine` first (mail that fails alignment goes to spam instead
of being delivered normally, but nothing bounces), watch for a while, then
consider `p=reject` once confident nothing legitimate is failing alignment.
Jumping straight to `p=reject` before confirming alignment is solid risks
real signup/reset emails being silently dropped by receiving servers instead
of just landing in spam — a worse failure mode than the one being fixed here.

## Notes / design decisions

- Supabase's built-in email sender is explicitly documented as
  testing-only — this is why custom SMTP is step 1, not optional polish.
- The confirm-signup template uses `{{ .Data.username }}` for a personal
  greeting since `AuthPage.tsx` already collects a username at signup and
  passes it as `options.data.username` — no code change needed to make
  that variable available to the template.
- Colors used in both templates come from `tailwind.config.js`'s actual
  current brand tokens (`primary` turf green `#1FA75D`/`#178B4D`, `board`
  navy `#101D2E`/`#16283D`, `chalk` `#F8F6F1`) — **not** the orange
  `#FF5722` `CLAUDE.md` currently (incorrectly) describes as `primary`;
  that line is stale and worth fixing separately.
- Templates use inline styles and a table-based layout deliberately —
  email clients (especially Outlook desktop) strip `<style>` blocks and
  don't reliably support modern CSS, so this is the safe baseline rather
  than reusing the app's Tailwind classes directly.
- No hosted logo image — the wordmark is styled text (matching the in-app
  `Wordmark` component's own approach: navy "PLAYBUILDER" + green "PRO").
  Many email clients block images by default until the user clicks "show
  images," so a text wordmark stays visible immediately; an image-based
  logo could be added later (export a PNG from `public/brand-icon.svg`)
  without changing this decision, just adding to it.
