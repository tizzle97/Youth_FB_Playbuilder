// Google Analytics 4 integration.
// Activates only when VITE_GA_MEASUREMENT_ID is set (e.g. G-XXXXXXXXXX),
// so local development stays out of your traffic reports.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export const analyticsEnabled = Boolean(MEASUREMENT_ID);

/** Inject the gtag.js script and initialize GA4. Call once at app startup. */
export function initAnalytics() {
  if (!MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // send_page_view false — page views are sent explicitly on route changes
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

/** Report a page view (called on every route change). */
export function trackPageView(path: string) {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Report a custom event, e.g. trackEvent('play_saved', { play_type: 'pass' }). */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', name, params);
}
