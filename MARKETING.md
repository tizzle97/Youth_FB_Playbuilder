# Marketing Strategy — Initial (drafted 2026-07-21)

Goal: drive free signups and activation (first play saved) ahead of the fall
season. Monetization is intentionally NOT the near-term goal — Stripe live
mode (B-18) is gated on attorney review, so every visitor we win now is a
free-tier user who converts later when Pro is purchasable. Traffic → signup →
first play saved is the whole funnel for now.

## Why now (the window is open for ~6 weeks)

- Fall youth football practices start early August; flag league registration
  runs June–August. Search volume for "flag football plays" peaks Aug–Sep.
  Every week of delay costs disproportionate traffic.
- Flag football is the fastest-growing youth sport in the country: girls HS
  flag participation grew ~388% since the pandemic-era baseline (68,847
  athletes across 2,736 schools in 2024-25), 17 states sanction it as of
  spring 2026 with 6 more voting by mid-year, and women's flag debuts at the
  2028 LA Olympics. A wave of brand-new, never-coached-before volunteer
  coaches is arriving every season — people with no existing playbook tool
  loyalty.
- Second seasonal window: spring flag (Feb–April). Whatever we build now
  (content, library, community presence) compounds into that one.

## Who we're for (in priority order)

1. **Volunteer parent-coaches of 5v5/7v7 flag** (NFL FLAG, i9, YMCA, local
   leagues). Zero coaching background, drafted at signup night, terrified of
   looking unprepared. Highest volume, weakest incumbent loyalty, most
   mobile-first (we now have pinch-zoom + mobile designer — a real edge).
2. **Girls HS flag coaches** — the growth segment. Many programs are 1-2
   years old; coaches are often teachers assigned the job. Underserved.
3. **Youth tackle 11v11 assistants/HCs** — smaller, but our block notation
   (B-25), special teams (B-27), and formation templates serve them.

## Positioning

**"The free play designer built for flag & youth football — draw a play on
your phone in two minutes, print wristbands for game day."**

The competitive math writes the pitch for us:
- FirstDown PlayBook (market leader): $200–250/yr single user, $700–750/yr
  team. Powerful but priced and built for programs, not parents.
- Flag Football Playmaker X: solid app, but app-store install friction and
  per-device history; we're a URL.
- GamePlanBuilder / flagfootballplaydesigner.com: the free browser
  competitors — our real rivals for the "free play maker" search click. We
  beat them on product depth (community library, playbooks, defense + zones,
  blocking, special teams, mobile zoom) and need to beat them on SEO.

Free = 15 plays/2 playbooks is generous enough to genuinely coach a season.
Pro at $39/yr will land as "1/5th the price of FirstDown" when it goes live.
Never trash competitors by name in public posts; let price/simplicity talk.

## Channels, in priority order

### P0 — this month (pre-season window)

**1. SEO content engine (mostly already built — finish and publish it).**
The blog agent (Mondays) + play library are the machine; it needs inventory.
- Publish the B-31 pilot 6 plays (Jeremy review pending) and greenlight the
  remaining ~29. Every public play page is a long-tail landing page.
- Blog titles to target (write for humans, match search intent):
  "5 best 5v5 flag football plays for 7-8 year olds", "How to coach flag
  football with zero experience (first practice plan)", "Free printable flag
  football playbook (PDF)", "Girls flag football plays for new HS programs",
  "7v7 flag football defense explained". B-32 (Play of the Week rider)
  interlinks blog ↔ library — prioritize it once B-31 publishes.
- Lead magnet: a free downloadable "Starter Playbook" PDF (ties to B-33
  packs) promoted on the homepage and every blog post. Gate behind signup —
  that's the traffic → signup conversion mechanism.

**2. Community seeding (highest-leverage free distribution, but earn it).**
Where these coaches actually are: r/flagfootball, r/youthfootball,
r/footballstrategy; Facebook groups ("Flag Football Coaches", "Youth
Football Coaches Corner", NFL FLAG league-specific groups — FB is where
parent-coaches live); Discords attached to bigger flag orgs.
- Rule: give value first, 9:1 ratio. Post an actual free play diagram or a
  "first practice plan" answer, not a link drop. The "Made with
  playbuilderpro.com" footer on free-tier PDFs does the marketing when the
  content is good enough to save/share.
- Answer every "what app do you use for plays?" thread — these recur weekly
  in season and rank in Google themselves.
- House rules apply: no fabricated stories, no sockpuppets, disclose being
  the builder ("I built this, feedback welcome" posts do well on Reddit).

**3. Product viral loop (small fixes, compounding return).**
- Free-tier PDF footer credit already exists — every printed play handed to
  a team parent is an impression. Keep it tasteful, keep it on.
- Community play pages + "Copy to My Plays" (B-30) is a signup loop for
  shared links — a coach shares their play with an assistant, assistant
  needs an account to copy it.

### P1 — once P0 is running (Sept+)

**4. Short-form video.** 30–60s screen-recordings: draw one play in the app
while explaining when to call it ("This play beats man coverage every time
in 5v5"). Post to TikTok/Reels/Shorts; same asset, three channels. Whiteboard
football content demonstrably performs; ours ends with a working app instead
of a whiteboard. 2/week is enough. This also produces the app-demo footage
the homepage currently lacks.

**5. League & org outreach.** Local league commissioners and NFL FLAG
operators: free Pro for league admins, offer a "league starter playbook"
they can distribute to every volunteer coach at their preseason coaches
meeting (with our footer on it). One league = 20–100 coach signups at once.
In-person: a one-page flyer + QR at preseason coach clinics.

### P2 — after Stripe goes live (B-18)

- Testimonials (B-12) from real free users → homepage + pricing page.
- Referral hook ("give a month of Pro, get a month").
- Reassess paid ads only once LTV is known. Do NOT buy ads before then.

## Technical enablers (repo work — candidates for BACKLOG.md)

- **M-1 · Social/meta prerendering.** The app is a client-rendered SPA: every
  page shares one hardcoded og:image/title from index.html. A shared play or
  blog post currently unfurls in iMessage/FB/Slack as the generic homepage
  card. Per-page og tags (Netlify prerendering, edge function, or vite-ssg
  for the blog + public play pages) directly multiplies channels 2 and 3.
  Highest-impact technical item on this list.
- **M-2 · GA events + UTM discipline.** Define signup, first-play-saved, and
  first-PDF-export as GA4 events; use UTMs on every seeded link so we know
  which community/post actually converts. Without this the whole strategy
  flies blind.
- **M-3 · Lead-magnet download flow.** "Get the free starter playbook (PDF)"
  CTA on homepage + blog posts, gated on account creation. Depends on B-31
  publishing.
- **M-4 · Logged-out play pages.** Verify public play pages render fully and
  fast for logged-out visitors + crawlers (they're the SEO surface).

## Cadence (sustainable for one person + agents)

- Mon: blog post (agent, already live) — retarget titles to the list above.
- Tue/Thu: one community answer/post each (human, 15 min each).
- Weekly: review GA sources → double down on whichever community converted.
- Later (P1): 2 shorts/week, batch-recorded monthly.

## Explicitly not doing yet

- Paid search/social (no purchasable Pro, no known LTV — burning money).
- Instagram/X brand-presence posting into the void (only short-form video
  with distribution mechanics, and only in P1).
- Influencer/sponsorship spends.
- Anything that fabricates social proof (testimonials, fake reviews — house
  rule, and the FTC cares).

## Measurement (weekly, 10 minutes)

North star: **weekly activated signups** (created account AND saved ≥1 play).
Supporting: sessions by source/UTM, signup rate, activation rate, D7 return.
GA4 is already installed (consent-gated); M-2 makes this real.

## First 30 days, concretely

1. Week 1: Jeremy reviews/publishes B-31 pilot → greenlight remaining ~29
   plays. Ship M-2 (GA events). Draft the 5 blog titles above into the blog
   agent's queue.
2. Week 2: Ship M-1 (og tags for blog + play pages). First two community
   posts (one Reddit "I built this", one FB group value post). Lead-magnet
   PDF assembled from published library plays (M-3).
3. Week 3: League outreach emails to 5 local leagues + NFL FLAG operator
   contacts. Community cadence continues.
4. Week 4: Review GA: which source produced activated signups? Double the
   winner, kill the loser. Decide whether P1 video starts now or Sept.
