// A signed-out coach's in-progress play, parked while they create an account.
//
// The designer lets anyone draw, but saving needs an account — and sending a
// coach to sign-up used to throw away the play they'd just drawn, which is
// exactly the moment they most wanted to keep it. So the designer stashes the
// scene here before routing to /auth and restores it when they come back.
//
// localStorage, not sessionStorage: with email confirmation on, the coach
// returns via the link in their inbox, which opens a new tab — sessionStorage
// is per-tab and would already be gone.

import type { PlayType } from '../components/designer/DesignerToolbar';
import type { PathItem, PlayerIcon, Zone, TextBox } from '../components/designer/Canvas';
import type { PlayMetadata } from '../types/play';

const STORAGE_KEY = 'pbp-pending-play';
// Long enough to cover "confirm the email tomorrow morning"; short enough that
// a forgotten draft doesn't ambush someone opening the designer weeks later.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingPlay {
  paths: PathItem[];
  playerIcons: PlayerIcon[];
  zones: Zone[];
  textBoxes: TextBox[];
  playType: PlayType;
  metadata: PlayMetadata;
}

interface StoredPendingPlay extends PendingPlay {
  savedAt: number;
}

/** Parks the scene. Storage can throw (Safari private mode) — then the draft
 *  is simply not kept, which is no worse than before this existed. */
export function stashPendingPlay(play: PendingPlay): void {
  try {
    const stored: StoredPendingPlay = { ...play, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

/** Returns the parked scene (if any, and not expired) and removes it, so a
 *  draft is restored at most once. */
export function takePendingPlay(): PendingPlay | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<StoredPendingPlay>;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.paths) || !Array.isArray(parsed.playerIcons)) return null;
    return {
      paths: parsed.paths,
      playerIcons: parsed.playerIcons,
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      textBoxes: Array.isArray(parsed.textBoxes) ? parsed.textBoxes : [],
      playType: parsed.playType === 'defense' || parsed.playType === 'special_teams' ? parsed.playType : 'offense',
      metadata: parsed.metadata as PlayMetadata,
    };
  } catch {
    return null;
  }
}
