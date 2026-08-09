/**
 * Where to land after a successful sign-in, from a `next` query param.
 *
 * Accepts same-origin paths only. `//evil.com` and `https://evil.com` are both
 * valid arguments to react-router's navigate() and would turn `?next=` into an
 * open redirect — a phishing primitive that's especially nasty on an auth page,
 * since the user has just typed their password.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  // Protocol-relative: `//evil.com` navigates off-site.
  if (next.startsWith('//')) return '/';
  // Some browsers normalize backslashes to forward slashes, making `/\evil.com`
  // another spelling of the above.
  if (next.startsWith('/\\')) return '/';
  return next;
}
