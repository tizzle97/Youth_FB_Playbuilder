import { useEffect } from 'react';

const SITE_NAME = 'Playbuilder Pro';
const SITE_URL = 'https://playbuilderpro.com';
const DEFAULT_DESCRIPTION =
  'Playbuilder Pro is the play designer for youth and flag football coaches — from 5v5 flag to 11v11. Draw routes on a real field, build playbooks, and print game-day sheets.';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

type PageMeta = {
  title?: string;
  description?: string;
  /** Path (e.g. /blog/my-post) used for the canonical URL and og:url. */
  path?: string;
  /** Optional JSON-LD structured data object (e.g. an Article). */
  jsonLd?: Record<string, unknown> | null;
};

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

const JSONLD_ID = 'pbp-jsonld';

/**
 * Sets the document title, meta description, canonical URL, Open Graph tags,
 * and optional JSON-LD for the current page. Values reset on unmount so
 * navigating away never leaves stale post-specific meta behind.
 */
export function usePageMeta({ title, description, path, jsonLd }: PageMeta) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Youth & Flag Football Play Designer`;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;

    document.title = fullTitle;
    setMetaTag('name', 'description', desc);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', desc);
    setMetaTag('property', 'og:url', url);
    setMetaTag('property', 'og:type', path?.startsWith('/blog/') ? 'article' : 'website');
    setMetaTag('property', 'og:site_name', SITE_NAME);
    setMetaTag('property', 'og:image', DEFAULT_OG_IMAGE);
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setCanonical(url);

    document.getElementById(JSONLD_ID)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = JSONLD_ID;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [title, description, path, jsonLd ? JSON.stringify(jsonLd) : null]);
}
