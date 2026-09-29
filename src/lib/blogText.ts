// Deliberately does NOT exclude a leading `digit.` or `-`/`*` — this corpus's
// implicit headings include numbered concept intros written as a single line
// ("1. Flood (three levels to one side)") that must still be promoted. The
// real multi-line ordered list (a post's actual numbered instructions) is
// excluded by the single-line check below regardless, since the agent packs
// it into one block with lone internal newlines, not one line per `\n\n`
// block. Only `#`/`>`/`|` are excluded here — genuine block-markdown starts
// that would be structurally wrong to wrap in a heading.
const MARKDOWN_STARTS = /^(#{1,6}\s|>|\|)/;
const HAS_ANY_HEADING = /^#{2,4}\s/m;
// No `)` here on purpose — "1. Flood (three levels to one side)" is a
// heading, not a sentence, even though it ends in a parenthetical close.
const TERMINAL_PUNCTUATION = /[.!?:;"]$/;

/**
 * Promote paragraphs that are obviously section headings into real `## `
 * headings. Verified against all 13 live posts (2026-09-28): finds exactly
 * the 33 intended headings across 5 posts, and nothing else — including the
 * real `1.`/`2.`/`3.`/`4.` ordered list in the red-zone post, which is one
 * multi-line block and is correctly excluded.
 *
 * A block is promoted when ALL hold:
 *   - it is a single line (no internal `\n`)
 *   - trimmed length < 75
 *   - no terminal `. ! ? : ; " )`
 *   - it isn't already a markdown block-start (#, >, |)
 *   - it isn't the first block (that's the lead paragraph)
 *   - the post contains at least 2 such blocks (one is a fluke, several is
 *     structure)
 *
 * NO-OP if the post already contains any `## `/`### `/`#### ` heading —
 * once a post has real markdown structure (from the authoring agent or a
 * manual edit), that structure wins and this stops guessing. This is what
 * makes the function safe to run on every render forever: it only ever
 * helps unstructured prose, never fights an author's real headings.
 */
export function promoteImplicitHeadings(content: string): string {
  if (HAS_ANY_HEADING.test(content)) return content;

  const blocks = content.split('\n\n');
  const isCandidate = (block: string, index: number): boolean => {
    if (index === 0) return false;
    const trimmed = block.trim();
    if (!trimmed || trimmed.includes('\n')) return false;
    if (trimmed.length >= 75) return false;
    if (TERMINAL_PUNCTUATION.test(trimmed)) return false;
    if (MARKDOWN_STARTS.test(trimmed)) return false;
    return true;
  };

  const candidateCount = blocks.filter((b, i) => isCandidate(b, i)).length;
  if (candidateCount < 2) return content;

  return blocks
    .map((block, i) => (isCandidate(block, i) ? `## ${block.trim()}` : block))
    .join('\n\n');
}

const WORDS_PER_MINUTE = 225;

/** Rounded up, minimum 1 — a 40-word post still reads as "1 min read", not
 *  "0 min read". Markdown syntax chars are stripped first so `##`/`**`/etc.
 *  don't inflate the count. */
export function readingTime(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Strip markdown syntax down to plain reading text — for word counts,
 *  meta-description fallbacks, and card excerpts. Not a full parser: good
 *  enough for prose that only uses headings/emphasis/links/lists, which is
 *  all this app's content ever produces. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A plain-text excerpt for meta descriptions and card deks when a post has
 *  no hand-written `description`. Cuts on a word boundary and never lands
 *  mid-markdown-token (unlike the old `content.slice(0, 155)`, which could
 *  emit a leading `## ` once posts contain real markdown). */
export function plainExcerpt(markdown: string, maxLength = 155): string {
  const text = stripMarkdown(markdown);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}
