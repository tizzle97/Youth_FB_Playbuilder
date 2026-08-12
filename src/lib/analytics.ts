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

/**
 * The visitor's stored consent choice, or null if they haven't decided yet.
 * localStorage access throws outright where storage is blocked (Safari private mode,
 * embedded contexts) — treat that as "undecided" rather than letting it take out the
 * ConsentBanner effect that calls this.
 */
export function getStoredConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Consent isn't only an analytics question — the banner is a ~130px fixed bar on
 * mobile, so anything else anchored to the bottom of the viewport has to know
 * whether it's currently on screen. Subscribers are notified on every choice so
 * they can move out of the way (and back) without polling localStorage.
 */
type ConsentListener = (choice: ConsentChoice) => void;
const consentListeners = new Set<ConsentListener>();

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(listener: ConsentListener): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

/** Persists the visitor's choice and loads GA immediately if they granted it. */
export function storeConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage blocked — honor the choice for this page view even if it can't persist.
  }
  if (choice === 'granted') loadGoogleAnalytics();
  consentListeners.forEach((listener) => listener(choice));
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
  // Must push the `arguments` object, NOT a rest-param array. gtag.js only treats a
  // dataLayer entry as a command (js/config/event) when it is [object Arguments]; a real
  // Array is read as a data push and silently ignored. Using `...args` here meant no
  // `config` ever registered, so GA recorded nothing at all — even for visitors who
  // accepted consent. That regression zeroed analytics from 2026-07-17 until it was
  // caught. Keep this as Google's canonical snippet.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
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
