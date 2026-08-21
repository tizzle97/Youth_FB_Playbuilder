/** Should this webhook event be allowed to grant entitlements?
 *
 *  Stripe signs test-mode and live-mode events with different secrets, but a
 *  correctly-signed TEST event is still a valid request — nothing about
 *  signature verification distinguishes real money from a test card. Without
 *  this check, anyone who reaches a checkout backed by test keys and types
 *  Stripe's published test card (4242 4242 4242 4242) is granted full Pro,
 *  permanently, for nothing. That is not hypothetical: it happened on
 *  playbuilderpro.com in August 2026 while VITE_BILLING_ENABLED was true in
 *  Netlify and the keys were still the sandbox pair.
 *
 *  Pure and dependency-free so it can be exercised without Deno or a live
 *  Stripe — same pattern as feedback-notify's digest.ts.
 *
 *  @param livemode      `event.livemode` from the verified Stripe event.
 *  @param allowTestMode `STRIPE_ALLOW_TEST_MODE` — the deliberate escape hatch
 *                       for sandbox end-to-end testing (B-18 requires one).
 *                       Anything other than the exact string 'true' is off,
 *                       matching VITE_BILLING_ENABLED's convention.
 */
export function shouldProcessEvent(
  livemode: boolean,
  allowTestMode: string | undefined,
): { process: boolean; reason: string } {
  if (livemode) return { process: true, reason: 'live-mode event' };
  if (allowTestMode === 'true') {
    return { process: true, reason: 'test-mode event allowed by STRIPE_ALLOW_TEST_MODE' };
  }
  return {
    process: false,
    reason:
      'test-mode event ignored — set STRIPE_ALLOW_TEST_MODE=true to allow sandbox testing',
  };
}
