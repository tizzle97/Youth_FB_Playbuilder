// Google Analytics 4 integration.
// GA only loads after the visitor accepts the cookie consent banner
// (<ConsentBanner />, BACKLOG B-19) — declining, or not yet deciding, means
// no gtag.js script and no analytics cookies. Once loaded, initial page
// views and SPA route changes are tracked automatically by GA4's enhanced
// measurement.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = 'G-LS75BRZG15';
const CONSENT_STORAGE_KEY = 'pbp-analytics-consent';

export type ConsentChoice = 'granted' | 'denied';

/** The visitor's stored consent choice, or null if they haven't decided yet. */
export function getStoredConsent(): ConsentChoice | null {
  const value = localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

/** Persists the visitor's choice and loads GA immediately if they granted it. */
export function storeConsent(choice: ConsentChoice): void {
  localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  if (choice === 'granted') loadGoogleAnalytics();
}

let gaLoaded = false;

/** Injects gtag.js and initializes GA4. Only call once consent is granted. */
export function loadGoogleAnalytics(): void {
  if (gaLoaded) return;
  gaLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}

/** Call once at app startup: resumes GA if the visitor already granted consent. */
export function initAnalyticsFromStoredConsent(): void {
  if (getStoredConsent() === 'granted') loadGoogleAnalytics();
}

/** Report a custom event, e.g. trackEvent('play_saved', { play_type: 'pass' }). */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}
