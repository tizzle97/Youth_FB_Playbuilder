import type { Section } from './blogMarkdown';
import { PLAY_SCENES, type PlaySceneKey } from './blogPlayScenes';

type Placement = {
  scene: PlaySceneKey;
  /** Placed after the section whose heading contains this text
   *  (case-insensitive), or after the section at this array index if no
   *  heading matches. Silently dropped if neither resolves. */
  after: { heading: string } | { sectionIndex: number };
};

/** Tier 1 — curated, by slug. Authoritative: a curated post is never
 *  overridden by the tier-2 automatic matcher below. Hand-picked because a
 *  wrong diagram is worse than no diagram, and an automatic match can't be
 *  trusted to place multiple diagrams sensibly within one post. */
const CURATED: Record<string, Placement[]> = {
  'flag-football-plays-beat-zone-defense': [
    { scene: 'flood', after: { heading: 'Flood' } },
    { scene: 'curl', after: { heading: 'Curl-Flat' } },
    { scene: 'mesh', after: { heading: 'Mesh' } },
  ],
  '4-basic-routes-5v5-flag-football': [
    { scene: 'route-tree', after: { sectionIndex: 0 } },
  ],
  '1-3-1-zone-defense-5v5-flag-football': [
    { scene: '1-3-1-zone', after: { sectionIndex: 0 } },
  ],
};

const MAX_DIAGRAMS_PER_POST = 3;

/** Tier 2 — automatic, for any post nobody has curated (every future post,
 *  unless someone adds it above). Fires only on a strong signal: the
 *  concept word appears in a section heading, in the post title, or twice
 *  in the description — descriptions from the authoring agent reliably
 *  name concepts explicitly ("flood, curl-flat, seams, mesh, quick
 *  throws"), so this is a real signal, not a guess. At most one diagram,
 *  placed after its matching section (or the first section, if the concept
 *  only matched the title/description).
 *
 *  Nothing (post has no matching concept at all) is an acceptable outcome —
 *  the post still gets cover art and well-set type, already a large
 *  improvement over the plain-text original. */
function resolveAutomatic(
  post: { slug: string; title: string; description?: string | null },
  sections: Section[],
): Map<number, PlaySceneKey[]> {
  const result = new Map<number, PlaySceneKey[]>();
  const concepts = Object.keys(PLAY_SCENES) as PlaySceneKey[];

  for (const concept of concepts) {
    const word = concept.replace(/-/g, '[- ]');
    const pattern = new RegExp(`\\b${word}\\b`, 'i');

    const headingIndex = sections.findIndex((s) => s.heading && pattern.test(s.heading));
    if (headingIndex >= 0) {
      result.set(headingIndex, [concept]);
      return result;
    }

    const inTitle = pattern.test(post.title);
    const descHits = post.description ? (post.description.match(new RegExp(pattern.source, 'gi')) ?? []).length : 0;
    if (inTitle || descHits >= 2) {
      result.set(0, [concept]);
      return result;
    }
  }

  return result;
}

/** Resolves which PlayScene(s) to render after which section index, for a
 *  given post. Curated posts use their exact placements; everyone else
 *  gets the tier-2 automatic match (or nothing). */
export function resolveDiagrams(
  post: { slug: string; title: string; description?: string | null },
  sections: Section[],
): Map<number, PlaySceneKey[]> {
  const curated = CURATED[post.slug];
  return curated ? buildCuratedMap(curated, sections) : resolveAutomatic(post, sections);
}

function resolvePlacementIndex(after: Placement['after'], sections: Section[]): number {
  if ('heading' in after) {
    const needle = after.heading.toLowerCase();
    return sections.findIndex((s) => s.heading?.toLowerCase().includes(needle));
  }
  return after.sectionIndex;
}

function buildCuratedMap(placements: Placement[], sections: Section[]): Map<number, PlaySceneKey[]> {
  const result = new Map<number, PlaySceneKey[]>();
  let count = 0;
  for (const placement of placements) {
    if (count >= MAX_DIAGRAMS_PER_POST) break;
    const index = resolvePlacementIndex(placement.after, sections);
    if (index < 0 || index >= sections.length) continue; // unmatched — silently dropped
    const existing = result.get(index) ?? [];
    result.set(index, [...existing, placement.scene]);
    count += 1;
  }
  return result;
}
