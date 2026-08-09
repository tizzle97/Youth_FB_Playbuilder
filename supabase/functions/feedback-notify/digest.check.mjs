// Checks for the pure digest helpers in ./digest.ts.
//
// The repo has no unit-test runner (`npm run smoke` is Playwright, and these
// are Deno-targeted files it can't reach), so this is a standalone script. It
// exercises the real module rather than a copy — bundle it first, from the
// repo root:
//
//   npx esbuild supabase/functions/feedback-notify/digest.ts \
//     --format=esm --outfile=/tmp/digest.mjs
//   node supabase/functions/feedback-notify/digest.check.mjs /tmp/digest.mjs
//
// Worth re-running after any change to the rendering or the secret compare —
// the escaping and fail-closed cases are the ones that matter.

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('usage: node digest.check.mjs <path to bundled digest.mjs>');
  process.exit(1);
}
const {
  MAX_EXCERPT, escapeHtml, recipients, renderDigest, secretMatches, subjectFor,
} = await import(pathToFileURL(target).href);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok', name); };

console.log('secretMatches');
t('accepts an exact match', () => assert.equal(secretMatches('abc123', 'abc123'), true));
t('rejects a mismatch', () => assert.equal(secretMatches('abc124', 'abc123'), false));
t('rejects a correct prefix', () => assert.equal(secretMatches('abc', 'abc123'), false));
t('rejects a longer superstring', () => assert.equal(secretMatches('abc1234', 'abc123'), false));
t('FAILS CLOSED when the secret is unset', () => {
  assert.equal(secretMatches('', ''), false);
  assert.equal(secretMatches('anything', ''), false);
});
t('handles multi-byte without throwing', () => assert.equal(secretMatches('café', 'café'), true));

console.log('escapeHtml');
t('neutralizes a script tag', () => {
  const out = escapeHtml('<script>alert("x")</script>');
  assert.ok(!out.includes('<script>'));
  assert.equal(out, '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
t('escapes ampersands first (no double-encoding artifacts)', () =>
  assert.equal(escapeHtml('&lt;'), '&amp;lt;'));

console.log('subjectFor / recipients');
t('singular at 1', () => assert.match(subjectFor(1), /^1 new piece of/));
t('plural otherwise', () => assert.match(subjectFor(3), /^3 new pieces of/));
t('splits and trims a recipient list', () =>
  assert.deepEqual(recipients(' a@x.com , b@x.com ,'), ['a@x.com', 'b@x.com']));

console.log('renderDigest');
const emails = new Map([['u1', 'coach@example.com']]);
const rows = [
  { id: 'r1', type: 'bug', content: 'Export cuts off the last play.', page_path: '/plays',
    created_at: '2026-08-07T00:00:00Z', user_id: 'u1' },
  { id: 'r2', type: 'general', content: '<img src=x onerror=alert(1)>', page_path: null,
    created_at: '2026-08-08T00:00:00Z', user_id: null },
];
const html = renderDigest(rows, emails);

t('includes the submitter email (unlike feedback-triage, by design)', () =>
  assert.ok(html.includes('coach@example.com')));
t('falls back for an anonymous row', () => assert.ok(html.includes('Unknown user')));
t('shows page_path when present, omits it when null', () => {
  assert.ok(html.includes('on /plays'));
  assert.equal((html.match(/ · on /g) ?? []).length, 1);
});
t('escapes hostile feedback content', () => {
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
t('links to the admin dashboard', () =>
  assert.ok(html.includes('https://playbuilderpro.com/admin')));
t('pluralizes the heading', () => assert.ok(html.includes('2 new pieces of feedback')));

const long = renderDigest(
  [{ ...rows[0], content: 'x'.repeat(MAX_EXCERPT + 200) }], emails);
t(`truncates content past ${MAX_EXCERPT} chars`, () => {
  assert.ok(long.includes('…'));
  assert.ok(!long.includes('x'.repeat(MAX_EXCERPT + 1)));
});

console.log(`\n${n} assertions passed`);
