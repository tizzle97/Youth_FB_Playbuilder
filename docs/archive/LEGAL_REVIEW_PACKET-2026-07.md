# Playbuilder Pro — legal review packet

Compiled 2026-07-29 for the attorney review tracked as **BACKLOG.md item B-21**
(gating item B-18, the Stripe live-mode swap). This document collects the
**complete, verbatim text** of every page/component on playbuilderpro.com
that a lawyer would need to review — nothing paraphrased or summarized,
except where noted. Each section names its source file so any edits made
after review can be traced back to the code.

**What to focus on, if short on time:** Terms of Service (esp. §4 billing,
§9–10 disclaimers/liability, §13 governing law) and Privacy Policy are the
two pages already written for this review (effective date July 15, 2026,
below). Everything after that in this packet is supporting context — the
copy that surrounds those two pages — plus one **new item since the last
draft** flagged at the end: the wristband-product affiliate-link copy
added 2026-07-29.

---

## 1. Terms of Service
**Source:** `src/components/legal/TermsOfService.tsx` · Route: `/terms` ·
Effective date shown on page: **July 15, 2026**

> These Terms of Service ("Terms") are a contract between you and Playbuilder Pro
> ("we," "us") governing your use of playbuilderpro.com (the "Service"). By
> creating an account or using the Service, you agree to these Terms and to
> our Privacy Policy. If you do not agree, do not use the Service.

**2. Eligibility**
> You must be at least 13 years old (16 in the European Economic Area) to use
> the Service. If you use the Service on behalf of a team or organization,
> you represent that you have authority to accept these Terms for it.

**3. Your account**
> You are responsible for your account credentials and for activity under
> your account. Keep your password secure and notify us at
> support@playbuilderpro.com of any unauthorized use. We may suspend or
> terminate accounts that violate these Terms.

**4. Plans, subscriptions, and billing**
- **Free plan.** Includes the Play Designer, up to 15 saved plays, 2 playbooks, single-play PDF export, and community access. Limits may change with notice.
- **Pro plan.** $39 per year (plus any applicable taxes). Pro includes unlimited plays and playbooks, full-playbook PDF export, wristband export, and clean print output.
- **Automatic renewal.** Pro subscriptions renew automatically every 12 months and your payment method is charged at the then-current price until you cancel. We will notify you before the price of an existing subscription increases.
- **Cancellation.** Cancel anytime via *Manage billing* in Account Settings. Cancellation takes effect at the end of the current billing period; you keep Pro access until then.
- **Refunds.** Except where required by law, payments are non-refundable and we do not provide credits for partial subscription periods.
- **Founding Members.** Accounts created before paid plans launched receive Pro features at no charge ("Founding Member" status). This is a courtesy benefit tied to the original account holder; it is non-transferable and applies to the feature set we designate for Founding Members.
- **Payment processing.** Payments are processed by Stripe. Your card details are provided directly to Stripe and are subject to Stripe's terms and privacy policy.

**5. Your content**
> You own the plays, playbooks, posts, comments, images, and other content you
> create or upload ("User Content"). So that we can operate the Service, you
> grant us a worldwide, non-exclusive, royalty-free license to host, store,
> display, reproduce, and (for content you make public) distribute your User
> Content within the Service. Content you mark public — public plays and
> community posts — may be viewed by other users, who may view and use those
> plays for coaching their own teams. This license ends when you delete the
> content or your account, except for content others have already copied or
> that we must retain for legal reasons.
>
> You are responsible for your User Content and must have the rights to
> anything you upload.

**6. Acceptable use**
> You agree not to:
- Upload content that is unlawful, infringing, harassing, hateful, sexually explicit, or inappropriate for a community that includes youth sports coaches;
- Impersonate others or misrepresent your affiliation;
- Attempt to access other users' private data, probe or circumvent security measures, or interfere with the Service;
- Scrape, resell, or redistribute the Service or its content except as the Service intends;
- Use the Service to send spam or unsolicited promotion.

> We may remove content or suspend accounts that violate these rules.
> Community images can be reported in-app and are reviewed by moderators.

**7. Our intellectual property**
> The Service — including its software, design, logo, and name — is owned by
> us or our licensors and is protected by intellectual-property laws. These
> Terms do not grant you any right to use our branding.

**8. Copyright complaints (DMCA)**
> We respond to notices of alleged copyright infringement under the Digital
> Millennium Copyright Act. Send notices identifying the copyrighted work,
> the infringing material's location on the Service, your contact
> information, and the statements required by 17 U.S.C. § 512(c)(3) to
> support@playbuilderpro.com with the subject "DMCA Notice." We may remove
> content and terminate repeat infringers.

> ⚠ **Open item, not yet done (BACKLOG B-20):** the DMCA designated-agent
> registration at dmca.copyright.gov (service provider "Jeremy Knepp" /
> "Playbuilder Pro", agent email support@playbuilderpro.com) has not been
> filed yet. §512 safe-harbor protection depends on that registration
> existing, not just this clause.

**9. Disclaimers**
> THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
> KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
> PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the
> Service will be uninterrupted or error-free, or that content (including
> community plays) is accurate or suitable for your team. Coaching decisions
> — including player safety — are yours.

**10. Limitation of liability**
> TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY
> INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR
> LOST PROFITS, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ALL CLAIMS
> RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF $50 OR THE AMOUNT YOU
> PAID US IN THE 12 MONTHS BEFORE THE CLAIM AROSE. Some jurisdictions do not
> allow certain limitations, so parts of this section may not apply to you.

**11. Indemnification**
> You will defend and indemnify us against claims arising from your User
> Content or your violation of these Terms or of another party's rights.

**12. Termination**
> You may stop using the Service or delete your account at any time from
> Account Settings. We may suspend or terminate your access for violation of
> these Terms, with notice where practicable. Sections that by their nature
> should survive termination (including 5, 9, 10, 11, and 13) survive.

**13. Governing law**
> These Terms are governed by the laws of the State of Indiana, without
> regard to conflict-of-law rules. Any dispute that cannot be resolved
> informally will be brought exclusively in the state or federal courts
> located in Indiana, and you consent to their jurisdiction.

**14. Changes to these Terms**
> We may update these Terms from time to time. If we make material changes,
> we will update the effective date above and note the change on the site;
> for significant changes affecting paid subscriptions, we will provide
> advance notice. Continued use after changes take effect means you accept
> the updated Terms.

**15. Contact**
> Questions about these Terms: support@playbuilderpro.com

---

## 2. Privacy Policy
**Source:** `src/components/legal/PrivacyPolicy.tsx` · Route: `/privacy` ·
Effective date shown on page: **July 15, 2026**

**Who we are**
> Playbuilder Pro ("we," "us") operates playbuilderpro.com, a web application
> that lets youth and flag football coaches design plays, build playbooks,
> and share content with a community. Questions about this policy or your
> data: support@playbuilderpro.com.

**Information we collect**
- **Account information.** Email address, username, and password when you create an account. Passwords are hashed by our authentication provider; we never see or store them in plain text.
- **Profile and team content.** Optional profile pictures you upload or icons you select, and optional team settings such as a team name and logo used on your printed playbooks.
- **Content you create.** Plays, playbooks, community posts, comments, votes, and feedback you submit. Content you mark public (public plays, community posts) is visible to other users along with your username and avatar.
- **Subscription information.** If you upgrade to Pro, payment is processed by Stripe. Your card number never touches our servers. We store your subscription status and Stripe customer/subscription identifiers so we can provide Pro features.
- **Usage data.** We use Google Analytics 4, which sets cookies and collects information such as pages visited, approximate location, and device/browser type. See "Cookies and analytics" below.
- **Technical data.** A session token stored in your browser's local storage keeps you signed in.

**How we use information**
- Provide and operate the service: accounts, saving and loading plays, printing, community features.
- Process subscriptions and provide Pro features.
- Send transactional email only — account confirmation, password resets, and similar. We do not send marketing email.
- Understand aggregate usage so we can improve the product (analytics).
- Enforce our Terms of Service and keep the community safe (e.g., reviewing reported images).

**Who we share information with**
> We do not sell your personal information. We share it only with the
> service providers that run the product:
- **Supabase** — database, authentication, and file storage (hosts your account data and uploaded content).
- **Stripe** — payment processing for Pro subscriptions.
- **Google Analytics** — aggregate usage analytics.
- **Netlify** — website hosting and delivery.

> We may also disclose information if required by law, or to protect the
> rights, safety, or property of Playbuilder Pro or its users.

> ⚠ **Not currently listed here:** Amazon (see item 6 below — new
> compatible-wristband-product links). No personal data is sent to Amazon
> today (it's an outbound link only, no tracking pixel/API call), so this
> list may still be accurate, but flagging so the attorney can confirm that
> reading holds and decide whether an affiliate-relationship disclosure
> belongs in this policy as well as in the on-page copy in item 6.

**Cookies and analytics**
> We use Google Analytics 4 to understand aggregate site usage, but only
> after you accept the cookie consent banner shown on your first visit. It
> sets cookies and may collect your IP-derived approximate location and
> device information. Declining means Google Analytics never loads and no
> analytics cookies are set; you can change your mind at any time by
> clearing your browser's local storage for this site, or opt out with the
> Google Analytics opt-out browser add-on. Apart from analytics, we use
> browser storage only for essential functions such as keeping you signed in.
>
> Some browsers send a "Do Not Track" signal. Like most sites, we do not
> currently respond to Do Not Track signals, but the opt-out above works
> regardless.

**Public content**
> Plays you mark public, and anything you post in the Community (posts,
> comments, votes), are visible to other users — along with your username
> and avatar. Think of the Community as a public space. Private plays and
> playbooks are visible only to you.

**Data retention and deletion**
> We keep your information for as long as your account exists. You can
> delete your account at any time from Account Settings — this permanently
> deletes your account and associated data. You can also email us at
> support@playbuilderpro.com to request access to, correction of, or
> deletion of your personal information.

**Your rights**
> Depending on where you live (for example, California or the European
> Economic Area), you may have rights to access, correct, delete, or receive
> a copy of your personal information, and to object to or restrict certain
> processing. We honor these requests for all users regardless of location:
> use the self-serve account deletion in Account Settings, or email us and
> we will respond within 30 days. We will never discriminate against you for
> exercising a privacy right.

**Children**
> Playbuilder Pro is built for coaches and is not directed at children under
> 13. You must be at least 13 years old (or 16 in the European Economic
> Area) to create an account. We do not knowingly collect personal
> information from children under 13; if you believe a child has created an
> account, contact us and we will delete it.

**Security**
> All traffic is encrypted in transit (HTTPS). Data access is enforced with
> row-level security so users can only read and write their own private
> content. Payments are handled entirely by Stripe. No method of
> transmission or storage is 100% secure, but we take reasonable measures
> appropriate to the data we handle.

**Changes to this policy**
> If we make material changes, we will update the effective date above and,
> for significant changes, note it on the site. Continued use of the service
> after changes take effect means you accept the updated policy.

**Contact**
> support@playbuilderpro.com

---

## 3. Cookie / analytics consent banner
**Source:** `src/components/ConsentBanner.tsx` · Shown site-wide on first
visit (hidden only on the full-screen `/designer` tool) until the visitor
chooses Accept or Decline.

> We use Google Analytics to understand how coaches use Playbuilder Pro. See
> our Privacy Policy.

Buttons: **Decline** / **Accept**. Declining stores the choice and Google
Analytics never loads; no analytics cookies are ever set (verified by
automated test, see `tests/smoke/designer.spec.ts`).

---

## 4. Pricing page (marketing copy for the same plans described in ToS §4)
**Source:** `src/components/Pricing.tsx` · Route: `/` (homepage section)

Headline: "Simple Pricing" — "Playbuilder Pro is free for youth coaches.
Create a free account to save your plays and playbooks — no credit card
required."

Free plan feature list shown to users:
- All Play Designer tools
- Up to 15 saved plays
- 2 playbooks
- Single-play PDF export
- Browse & publish community plays

Pro plan feature list shown to users ($39/year):
- Everything in Free
- Unlimited plays
- Unlimited playbooks
- Full playbook PDFs (detailed + grid)
- Wristband export
- Clean output (no footer credit)

Founding Member callout (shown only to those accounts):
> You're a Founding Member. Thanks for being here early — Pro will be free
> for your account, for life.

Note: the Pro card currently renders a disabled "Coming soon" button
(`BILLING_ENABLED` flag is off) — this is the flag gated behind the B-18
Stripe live-mode swap this whole packet exists for.

---

## 5. Site-wide footer
**Source:** `src/components/Footer.tsx` · Shown on every page except `/designer`

Legal/navigation links: Blog · Community · Privacy Policy · Terms of Service
· Contact

Copyright line: `© {current year} Playbuilder Pro. All rights reserved.`

---

## 6. Contact page
**Source:** `src/components/legal/ContactPage.tsx` · Route: `/contact`

> Questions, bug reports, billing help, privacy requests, or copyright
> notices — we read everything.

**Email us** — support@playbuilderpro.com
> Support, billing, privacy requests (access, correction, deletion), and
> DMCA notices. We aim to respond within 2 business days.

**In-app feedback**
> Signed in? The Give Feedback button in the corner of every page is the
> fastest way to report a bug or request a feature.

**Privacy & account deletion**
> You can delete your account yourself anytime from Account Settings — no
> email required. For anything else privacy-related, see our Privacy Policy.

---

## 7. NEW since the July 15 draft — wristband compatible-product link (2026-07-29)

Added this week: the wristband PDF export (both the Play Designer's export
modal and the Playbooks page export menu) now names a specific third-party
product by brand and links to its real Amazon listing, so coaches know
which physical wristband the printed insert fits.

**Sources:**
`src/lib/wristbandProducts.ts` (constants), `src/components/designer/ExportModal.tsx`,
`src/components/playbooks/PlaybooksPage.tsx` (rendered copy + same text
printed on the PDF itself).

Exact copy shown in-app and on the printed PDF:
> Compatible with **Wristband Interactive Y23 Football Wristbands**
> (https://www.amazon.com/dp/B07QGH4NM5) and any wristband with a 4.5" x
> 2.2" play window.

The link is currently a **plain, non-monetized Amazon URL** — there is no
Associates tracking tag yet, because one hasn't been set up. The code is
structured so that when a tag is added, this additional line activates
automatically wherever the link appears:
> As an Amazon Associate we earn from qualifying purchases.

**Questions for the attorney:**
1. Does naming a specific competitor/third-party branded product on our own
   paid product's export output raise any trademark/endorsement concern
   (nominative fair use, "compatible with X" framing)?
2. Once an Associates tag is added, is the "As an Amazon Associate…" line
   sufficient FTC material-connection disclosure given where it appears
   (small print under a PDF header, and in a collapsed export-options
   panel), or does it need to be more prominent?
3. Should the Privacy Policy's "who we share information with" list (item 2
   above) mention Amazon, even though today it's an outbound link only with
   no data shared?

---

## Open items tracked elsewhere (for context, not part of this review)
- **BACKLOG B-20**: DMCA designated-agent registration at dmca.copyright.gov
  — not filed yet (see the §8 callout above).
- **BACKLOG B-18**: Stripe live-mode swap — blocked on this review (B-21) by
  deliberate choice; will not proceed until this packet is signed off.
