import { supabase } from './supabase';
import type { CustomRoster } from '../components/designer/rosters';

// Per-user settings from the `user_preferences` table (B-14 team identity,
// B-15 save/export defaults). One row per user; absent row = all defaults.
//
// The helpers take an explicit userId instead of resolving the user
// themselves — concurrent supabase.auth.getUser() calls can deadlock
// gotrue-js's session lock (see the B-4 note in BACKLOG.md), so the caller
// passes the user it already has.

export type GameFormat = '5v5' | '6v6' | '7v7' | '11v11';
export type PlayVisibility = 'private' | 'public';
export type DefaultPlayType = 'pass' | 'run' | 'option' | 'reverse' | 'screen' | 'trick';
export type PaperSize = 'letter' | 'a4';
export type ExportStyle = 'simple' | 'detailed' | 'grid';

export interface UserPreferences {
  team_name: string | null;
  team_logo_url: string | null;
  default_game_format: GameFormat;
  default_visibility: PlayVisibility;
  default_play_type: DefaultPlayType;
  paper_size: PaperSize;
  default_export_style: ExportStyle;
  /** Saved toolbar rosters, keyed by play type. null = built-in defaults.
   *  Structure validated on read — see designer/rosters.ts. */
  custom_roster: CustomRoster | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  team_name: null,
  team_logo_url: null,
  default_game_format: '5v5',
  default_visibility: 'private',
  default_play_type: 'pass',
  paper_size: 'letter',
  default_export_style: 'detailed',
  custom_roster: null,
};

const BASE_COLUMNS =
  'team_name, team_logo_url, default_game_format, default_visibility, default_play_type, paper_size, default_export_style';

/** Load the user's preferences, falling back to defaults for a missing row —
 *  and for the whole table if `user_preferences.sql` hasn't been run yet.
 *
 *  `custom_roster` is selected separately-tolerantly: naming a column that
 *  doesn't exist fails the ENTIRE select with 42703, so listing it before
 *  `custom_roster.sql` has been run would silently revert every *other*
 *  preference to its default for the whole window between deploy and SQL run.
 *  On that error we retry without it. */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select(`${BASE_COLUMNS}, custom_roster`)
    .eq('user_id', userId)
    .maybeSingle();

  if (!error) return { ...DEFAULT_PREFERENCES, ...(data ?? {}) };

  const { data: legacy } = await supabase
    .from('user_preferences')
    .select(BASE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  return { ...DEFAULT_PREFERENCES, ...(legacy ?? {}) };
}

/** Upsert a partial set of preference fields for the user. */
export async function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>,
): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
  if (error) throw error;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Team name + logo header snippet for the print/export HTML documents
 *  (single-play sheet, playbook PDFs). Empty string when the user has no
 *  team identity configured, so exports look exactly as before.
 *
 *  Styled as a small tracked-out caption (a "kicker" line) that sits above
 *  playTitleHTML()'s bigger headline below it — these two are meant to be
 *  read as one pairing, not two independent headers. Georgia is a system
 *  font available on every platform this prints from (macOS/Windows/iOS/
 *  Android); these are window.open()+print documents with no <link>/
 *  @font-face anywhere and nothing waiting on document.fonts.ready, so a
 *  real web font would be a real risk here, not just unnecessary. */
export function teamBrandHTML(prefs: Pick<UserPreferences, 'team_name' | 'team_logo_url'> | null): string {
  if (!prefs || (!prefs.team_name && !prefs.team_logo_url)) return '';
  const logo = prefs.team_logo_url
    ? `<img src="${escapeHtml(prefs.team_logo_url)}" alt="Team logo" style="height:42px;width:auto;" />`
    : '';
  const name = prefs.team_name
    ? `<div style="font-family: Georgia, 'Times New Roman', serif; font-size:10pt; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:#64748b;">${escapeHtml(prefs.team_name)}</div>`
    : '';
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">${logo}${name}</div>`;
}

/** A play's name as the centered headline in an export document, paired
 *  with teamBrandHTML() above it. Always centers itself regardless of what
 *  flex row it's dropped into — callers whose title used to share a
 *  `justify-content: space-between` row with metadata need to stack that
 *  metadata below instead, since a centered title can't share a row with
 *  right-aligned text the way the old left-aligned title could.
 *
 *  `fontSize` lets each export format keep its own existing relative
 *  hierarchy (a single-play sheet's title has always been bigger than a
 *  grid-view thumbnail's) instead of flattening every format to one size. */
export function playTitleHTML(name: string, fontSize = '26pt'): string {
  return `<div style="text-align:center; font-family: Georgia, 'Times New Roman', serif; font-size:${fontSize}; font-weight:700; color:#000; letter-spacing:0.5px;">${escapeHtml(name)}</div>`;
}

/** CSS @page size value for the user's paper preference (B-15). */
export function paperPageSize(paper: PaperSize): string {
  return paper === 'a4' ? 'A4' : '8.5in 11in';
}
