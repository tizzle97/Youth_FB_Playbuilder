/**
 * Categories derived client-side from title/description/content, since
 * `blog_posts` has no category column and the authoring agent can't be
 * relied on to assign one. Six categories cover what's actually published
 * today; anything scoring below THRESHOLD falls back to the honest
 * "Coaching Tips" label rather than guessing — an admittedly generic label
 * beats a confidently wrong one.
 */

export type CategoryId = 'offense' | 'defense' | 'practice' | 'team' | 'rules' | 'gameday' | 'tips';

export type Category = { id: CategoryId; label: string };

type CategoryDef = Category & { patterns: RegExp[] };

const CATEGORIES: CategoryDef[] = [
  {
    id: 'offense',
    label: 'Offense',
    patterns: [
      /\broutes?\b/i, /\bpass(ing)?\b/i, /red zone/i, /\bflood\b/i, /curl[- ]flat/i,
      /\bmesh\b/i, /\bseams?\b/i, /beat (the )?(zone|man|blitz)/i, /\bconcepts?\b/i,
      /\bQB\b|quarterback/i,
    ],
  },
  {
    id: 'defense',
    label: 'Defense',
    patterns: [
      /\bdefense\b/i, /man[- ]to[- ]man/i, /\bzone coverage\b/i, /1-3-1/i,
      /\bblitz\b/i, /\bcoverage\b/i, /\bflag pull/i,
    ],
  },
  {
    id: 'practice',
    label: 'Practice & Drills',
    patterns: [/\bdrills?\b/i, /\bpractice\b/i, /\bwarm[- ]?up\b/i, /\binstall\b/i, /week one/i],
  },
  {
    id: 'team',
    label: 'Coaching the Team',
    patterns: [/playing time/i, /\brotation\b/i, /\bparents?\b/i, /\bsubstitut/i, /\broster\b/i],
  },
  {
    id: 'rules',
    label: 'Rules & Formats',
    patterns: [/\brules?\b/i, /5v5|7v7|6v6|11v11/i, /no[- ]run zone/i, /\bpenalt/i, /\bNFL FLAG\b/i],
  },
  {
    id: 'gameday',
    label: 'Game Day',
    patterns: [/\bwristband\b/i, /play[- ]calling/i, /\bsideline\b/i, /\bhuddle\b/i, /\bgame day\b/i],
  },
];

export const FALLBACK_CATEGORY: Category = { id: 'tips', label: 'Coaching Tips' };

const THRESHOLD = 4;
const TITLE_WEIGHT = 6;
const DESCRIPTION_WEIGHT = 3;
const BODY_WEIGHT = 0.25;
const BODY_MAX_HITS_PER_PATTERN = 2;

function countMatches(text: string, pattern: RegExp, cap?: number): number {
  const matches = text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  const count = matches?.length ?? 0;
  return cap !== undefined ? Math.min(count, cap) : count;
}

/**
 * Weighted category match — a title hit outweighs a stray body mention.
 * Deterministic; ties broken by CATEGORIES declaration order. `content` is
 * optional so callers scoring many posts at once (e.g. related-post
 * ranking) can skip pulling full post bodies and score on title+description
 * alone, which is reliable here — the authoring agent's descriptions
 * reliably name concepts explicitly ("flood, curl-flat, seams, mesh").
 */
export function categorize(post: { title: string; description?: string | null; content?: string }): Category {
  let bestScore = 0;
  let best: Category = FALLBACK_CATEGORY;

  for (const def of CATEGORIES) {
    let score = 0;
    for (const pattern of def.patterns) {
      score += countMatches(post.title, pattern) * TITLE_WEIGHT;
      if (post.description) score += countMatches(post.description, pattern) * DESCRIPTION_WEIGHT;
      if (post.content) score += countMatches(post.content, pattern, BODY_MAX_HITS_PER_PATTERN) * BODY_WEIGHT;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { id: def.id, label: def.label };
    }
  }

  return bestScore >= THRESHOLD ? best : FALLBACK_CATEGORY;
}

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'youth', 'flag', 'football', 'what', 'when',
  'plays', 'play', 'guide', 'basics', 'coaches', 'coaching', 'team', 'players',
]);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

/**
 * Related-post score: same derived category (+3), plus 1 per shared
 * "significant" title word (stopword-filtered, >=4 chars). No tags exist,
 * so category + word overlap is what orders otherwise-tied candidates
 * usefully. Recency is the caller's tiebreak (sort stably by published_at
 * after scoring).
 */
export function relatedScore(
  a: { title: string; description?: string | null; content?: string },
  b: { title: string; description?: string | null; content?: string },
): number {
  let score = categorize(a).id === categorize(b).id ? 3 : 0;
  const wordsA = significantWords(a.title);
  const wordsB = significantWords(b.title);
  for (const w of Array.from(wordsA)) if (wordsB.has(w)) score += 1;
  return score;
}
