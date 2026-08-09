import DOMPurify from 'dompurify';

// The full set of tags the Community post rich-text editor can produce
// (RichTextEditor.tsx's restricted Tiptap schema: paragraph, bold, underline,
// bullet list). Kept in lockstep with that schema — anything the editor
// can't produce shouldn't survive sanitization either.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'u', 'ul', 'li'];

/**
 * The actual security boundary for rendering a post's `content` as HTML.
 *
 * `posts` RLS only checks `auth.uid() = user_id`, not the shape of
 * `content` — a client could PATCH arbitrary HTML into a post directly,
 * bypassing RichTextEditor entirely. So every render path must re-sanitize
 * regardless of what produced the stored string; this must wrap any
 * `dangerouslySetInnerHTML` of post content, no exceptions.
 *
 * ALLOWED_ATTR: [] strips every attribute (style/class/href/onerror/...),
 * which also cleans up Word's inline `mso-*` paste styling for free.
 */
export function sanitizePostContent(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}
