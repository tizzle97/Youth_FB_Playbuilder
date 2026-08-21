// Standalone check for livemode.ts. The repo has no unit runner and Playwright
// can't reach Deno-targeted files, so this is a plain script — same approach as
// feedback-notify/digest.check.mjs.
//
//   npx esbuild supabase/functions/stripe-webhook/livemode.ts \
//     --format=esm --outfile=/tmp/livemode.mjs
//   node supabase/functions/stripe-webhook/livemode.check.mjs /tmp/livemode.mjs

const mod = await import(process.argv[2] ?? '/tmp/livemode.mjs');
const { shouldProcessEvent } = mod;

let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : ` — got ${got}, want ${want}`}`);
};

// The whole point: a signed test-mode event must not grant anything.
check('test mode, flag unset → ignored', shouldProcessEvent(false, undefined).process, false);
check('test mode, flag empty → ignored', shouldProcessEvent(false, '').process, false);
check('live mode, flag unset → processed', shouldProcessEvent(true, undefined).process, true);

// The escape hatch, and its exact-match rule. 'TRUE' silently failing the
// === 'true' check is a mistake this repo has already made once with
// VITE_BILLING_ENABLED, so it is asserted rather than assumed.
check('test mode + STRIPE_ALLOW_TEST_MODE=true → processed', shouldProcessEvent(false, 'true').process, true);
check('test mode + TRUE (wrong case) → ignored', shouldProcessEvent(false, 'TRUE').process, false);
check('test mode + "1" → ignored', shouldProcessEvent(false, '1').process, false);
check('test mode + "yes" → ignored', shouldProcessEvent(false, 'yes').process, false);

// Live mode is never affected by the flag in either direction.
check('live mode + flag off → still processed', shouldProcessEvent(true, 'false').process, true);
check('live mode + flag on → still processed', shouldProcessEvent(true, 'true').process, true);

// Reasons are logged, so they must be non-empty.
check('ignored reason is explanatory', shouldProcessEvent(false, undefined).reason.includes('STRIPE_ALLOW_TEST_MODE'), true);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
