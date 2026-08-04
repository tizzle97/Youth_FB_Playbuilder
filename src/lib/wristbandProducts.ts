export const WRISTBAND_PRODUCT_NAME = 'Wristband Interactive Y23 Football Wristbands';
export const WRISTBAND_PRODUCT_URL = 'https://www.amazon.com/dp/B07QGH4NM5';
export const WRISTBAND_WINDOW_SIZE = '4.5" x 2.2"';

// No Associates tag yet. Once approved, set this and the link + disclosure
// below activate automatically — no other code needs to change.
const AMAZON_ASSOCIATES_TAG = '';

export function wristbandProductLink(): string {
  if (!AMAZON_ASSOCIATES_TAG) return WRISTBAND_PRODUCT_URL;
  const sep = WRISTBAND_PRODUCT_URL.includes('?') ? '&' : '?';
  return `${WRISTBAND_PRODUCT_URL}${sep}tag=${AMAZON_ASSOCIATES_TAG}`;
}

export const SHOW_AFFILIATE_DISCLOSURE = Boolean(AMAZON_ASSOCIATES_TAG);
