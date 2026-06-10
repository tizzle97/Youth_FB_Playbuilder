// Google Analytics 4 integration.
// The gtag.js snippet is loaded statically in index.html (per Google's
// installation instructions). Initial page views and SPA route changes are
// tracked automatically by GA4's enhanced measurement.
// This module just exposes a helper for custom events.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Report a custom event, e.g. trackEvent('play_saved', { play_type: 'pass' }). */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}
