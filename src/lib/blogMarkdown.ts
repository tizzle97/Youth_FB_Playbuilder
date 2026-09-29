import { marked, type Token } from 'marked';
import DOMPurify from 'dompurify';

// GFM on: the agent already writes `1.`/`2.` lists and it's worth autolinking
// bare URLs for free. `breaks: false` is deliberate — the agent wraps prose
// with lone newlines inside one paragraph block, and a lone newline must
// collapse to a space (CommonMark's default), not become a <br>.
marked.use({ gfm: true, breaks: false });

/**
 * This is the actual security boundary for rendering a post's `content` as
 * HTML — mandatory, not belt-and-braces. `marked` passes raw HTML through by
 * default, and while `blog_posts` writes are admin-only (the
 * `enforce_admin_blog_posts` trigger), the *content author* is an unattended
 * external agent nobody reviews before publish.
 *
 * Deliberately separate from `sanitizePostContent` in `sanitizeHtml.ts` — that
 * one is locked to the Community rich-text editor's restricted Tiptap schema
 * (`ALLOWED_ATTR: []`, which strips `href`, so it cannot render blog links).
 * Do not merge these two: they enforce different schemas for different
 * trust boundaries.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'em', 'del', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
];
// href/title only — target/rel are added post-sanitization so content can't
// forge them (see attachBlogLinkBehavior in BlogArticle.tsx).
const ALLOWED_ATTR = ['href', 'title'];

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?!\/))/i,
  });
}

export type Section = {
  /** Heading text, or null for the lead-in before the first heading. */
  heading: string | null;
  /** Stable slug for #anchor + TOC, deduped with a -2 suffix on collision. */
  id: string | null;
  /** Ready-to-inject sanitized HTML for this section's body (including its
   *  own heading tag, demoted to h2/h3/h4 as marked emitted it). */
  html: string;
};

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/** Demote a body h1 to h2 — the page's own <h1> is the post title, and there
 *  must be exactly one per page. */
function demoteH1(tokens: Token[]): void {
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1) {
      token.depth = 2;
    }
  }
}

/** Split markdown into sections at every depth<=2 heading, sanitize each
 *  section's rendered HTML independently, and assign stable heading ids. */
export function parseSections(markdown: string): Section[] {
  const tokens: Token[] = marked.lexer(markdown);
  demoteH1(tokens);

  const sections: Section[] = [];
  const seenIds = new Map<string, number>();
  let current: Token[] = [];
  let currentHeading: string | null = null;
  let currentId: string | null = null;

  const flush = () => {
    if (current.length === 0 && currentHeading === null) return;
    const html = sanitizeBlogHtml(marked.parser(current));
    sections.push({ heading: currentHeading, id: currentId, html });
  };

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth <= 2) {
      flush();
      currentHeading = token.text;
      currentId = slugifyHeading(token.text, seenIds);
      current = [token];
    } else {
      current.push(token);
    }
  }
  flush();

  return sections;
}

/** Just the outline (id + text) for a table of contents — cheaper than a
 *  full parseSections() when the caller only needs the TOC. */
export function headingOutline(markdown: string): { id: string; text: string }[] {
  const tokens: Token[] = marked.lexer(markdown);
  const seenIds = new Map<string, number>();
  const outline: { id: string; text: string }[] = [];
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 2) {
      outline.push({ id: slugifyHeading(token.text, seenIds), text: token.text });
    }
  }
  return outline;
}
