import { escapeHtml, teamBrandHTML, type UserPreferences } from './userPreferences';

/**
 * Shared print-export design tokens — a classic black & white coach-sheet
 * look, replacing the ad-hoc blue theme (#2563eb/#1e40af) that had drifted
 * to a different shade in nearly every generator. Diagrams keep their own
 * colors; this only governs chrome: rules, titles, footers, notes boxes.
 * Every print/export HTML document in the app should import from here
 * rather than hand-rolling its own values, or the next format added will
 * drift again exactly like the last several did.
 */
export const EXPORT_INK = '#000';
export const EXPORT_MUTED = '#555';
export const EXPORT_HAIRLINE = '#999';
/** Notes/metadata box background — replaces #f8fafc, #fafafa, #fffbeb. */
export const EXPORT_WASH = '#f2f2f2';
export const EXPORT_ACCENT_RULE = `3px solid ${EXPORT_INK}`;

export const UNTITLED_PLAY = 'Untitled Play';

/** 'offense' | 'defense' | 'special_teams' -> 'Offense' | 'Defense' |
 *  'Special Teams'. The card UI already strips the underscore
 *  (PlaybooksPage's `{play.type.replace('_', ' ')}`); no export generator
 *  did, so "Special Teams" printed as "Special_teams" everywhere it appeared
 *  in exported HTML. */
export function formatPlayType(type: string | undefined | null): string {
  if (!type) return '';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Escape, then turn newlines into <br>. The one notes/description pipeline
 *  for every export — previously every generator but one interpolated the
 *  coach's own text raw (no escaping, no line breaks), so multi-line notes
 *  printed as a single collapsed line. */
export function formatNotesHTML(text: string | undefined | null): string {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/** "Generated on <date> at <time> | Total Plays: N" — previously three
 *  independent inline-styled copies plus two generators with no footer at
 *  all. Does not include the free-plan "Made with playbuilderpro.com"
 *  credit; that one stays specific to the single-play sheet (it's the
 *  format's Pro/free distinction, not chrome to unify away). */
export function exportFooterHTML(totalPlays: number, marginTop = '20px'): string {
  const now = new Date();
  return `<div style="margin-top: ${marginTop}; text-align: center; font-size: 8pt; color: ${EXPORT_MUTED}; border-top: 1px solid ${EXPORT_HAIRLINE}; padding-top: 10px;">Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()} | Total Plays: ${totalPlays}</div>`;
}

/** One notes/description block shared by every format that has one (single
 *  play, detailed playbook — both surfaces). Previously each had its own
 *  bespoke styling: slate box, white card, and — the one place that even
 *  converted newlines — an amber box unlike anything else in the app. Emit
 *  this CSS once into a document's <style>, then call notesBlockHTML() for
 *  the markup. */
export const NOTES_BLOCK_CSS = `
    .pb-notes {
      margin-top: 20px;
      padding: 15px;
      background: white;
      border: 1px solid ${EXPORT_HAIRLINE};
      border-radius: 4px;
    }
    .pb-notes-title {
      font-weight: bold;
      font-size: 13pt;
      color: ${EXPORT_INK};
      margin-bottom: 8px;
    }
    .pb-notes-body {
      font-size: 10.5pt;
      line-height: 1.6;
      color: ${EXPORT_INK};
    }`;

export function notesBlockHTML(
  description: string | undefined | null,
  extras: Array<{ label: string; value: string | undefined | null }> = [],
): string {
  const body = formatNotesHTML(description) || 'No notes provided for this play.';
  const extrasHtml = extras
    .filter((e) => e.value)
    .map((e) => `<br><strong>${escapeHtml(e.label)}:</strong> ${escapeHtml(String(e.value))}`)
    .join('');
  return `<div class="pb-notes"><div class="pb-notes-title">Notes</div><div class="pb-notes-body">${body}${extrasHtml}</div></div>`;
}

type WristbandPrefs = (Pick<UserPreferences, 'team_name' | 'team_logo_url'> & { paper_size?: string }) | null;

/**
 * Wristband insert sheet — the ONE implementation shared by the Designer
 * (ExportModal.tsx) and Playbooks (PlaybooksPage.tsx) print surfaces. It
 * used to be ~300 lines duplicated verbatim in both files (a fix to one,
 * like the <colgroup> column-width commit, had to be hand-repeated in the
 * other); `getName`/`getImage` accessors are the only seam left, since the
 * two callers' play shapes differ (`canvasDataURL` vs `thumbnail`, `metadata
 * .playName` vs bare `name`).
 *
 * Text-only layout matches the reference coach-sheet supplied for this
 * change: black header bar ("Play #" / "Play"), bold outer border, thin
 * inner rules, alternating grey/white row shading, bold centered numbers
 * with a trailing period. Diagram-mode layout is unchanged except recolored
 * from blue to black.
 */
export function generateWristbandHTML<T>(opts: {
  plays: T[];
  getName: (play: T) => string;
  /** '' (or any falsy) renders the no-diagram placeholder — used by
   *  Playbooks plays that were saved before thumbnails existed. */
  getImage: (play: T) => string;
  title: string;
  textOnly: boolean;
  preferences: WristbandPrefs;
}): string {
  const { plays, getName, getImage, title, textOnly, preferences } = opts;

  // 4.5in x 2.2in matches the play window on Wristband Interactive Y23-style
  // QB wristbands, which hold 3 cut inserts arranged as a 4x2 grid of
  // numbered plays (8 per insert) — same layout as the printed inserts that
  // ship with those wristbands.
  const PLAYS_PER_INSERT = 8;
  const INSERTS_PER_BAND = 3;

  // Text-only mode is a fixed 4-column x 10-row template (columns 1-2 are
  // one #+name pair, columns 3-4 are the next 10 plays' #+name pair,
  // continuing the numbering) — always this exact shape regardless of how
  // many plays are populated, like a blank grid you fill in, not a list
  // that shrinks to fit. Confirmed against a photo of a real text-only
  // wristband insert, then refined to this precise spec.
  const ROWS_PER_INSERT_TEXT = 10;
  const PLAYS_PER_INSERT_TEXT = ROWS_PER_INSERT_TEXT * 2; // 20
  const perInsert = textOnly ? PLAYS_PER_INSERT_TEXT : PLAYS_PER_INSERT;

  const insertGroups: T[][] = [];
  for (let i = 0; i < plays.length; i += perInsert) {
    insertGroups.push(plays.slice(i, i + perInsert));
  }

  const inserts = insertGroups.map((group, groupIndex) => {
    const bandNumber = Math.floor(groupIndex / INSERTS_PER_BAND) + 1;
    const slotNumber = (groupIndex % INSERTS_PER_BAND) + 1;
    const insertLabel = `Wristband ${bandNumber} &middot; Insert ${slotNumber} of ${INSERTS_PER_BAND}`;

    if (textOnly) {
      // Always exactly ROWS_PER_INSERT_TEXT rows — blank cells (no number,
      // no name) when this insert has fewer than a full 20 plays, so the
      // template's shape never changes. Number renders with a trailing
      // period ("1.") only when the row is populated.
      const cell = (play: T | undefined, num: number | '') => `
            <td class="wb-num">${num === '' ? '' : `${num}.`}</td><td class="wb-play-name">${play ? escapeHtml(getName(play) || UNTITLED_PLAY) : ''}</td>`;
      const rowsHtml = Array.from({ length: ROWS_PER_INSERT_TEXT }, (_, r) => {
        const left = group[r];
        const right = group[r + ROWS_PER_INSERT_TEXT];
        const leftNum = left ? groupIndex * perInsert + r + 1 : '';
        const rightNum = right ? groupIndex * perInsert + r + ROWS_PER_INSERT_TEXT + 1 : '';
        return `
            <tr>${cell(left, leftNum)}${cell(right, rightNum)}</tr>`;
      }).join('');

      return `
      <div class="wb-insert wb-insert-text">
        <div class="wb-insert-label">${insertLabel}</div>
        <table class="wb-text-table">
          <colgroup>
            <col class="col-num" /><col class="col-name" /><col class="col-num" /><col class="col-name" />
          </colgroup>
          <thead>
            <tr><th class="wb-h-num">Play #</th><th class="wb-h-name">Play</th><th class="wb-h-num">Play #</th><th class="wb-h-name">Play</th></tr>
          </thead>
          <tbody>${rowsHtml}
        </tbody></table>
      </div>`;
    }

    const cells = group.map((play, i) => {
      const playNumber = groupIndex * perInsert + i + 1;
      const image = getImage(play);
      return `
        <div class="wb-cell">
          <div class="wb-cell-header">
            <div class="wb-number">${playNumber}</div>
            <div class="wb-name">${escapeHtml(getName(play) || UNTITLED_PLAY)}</div>
          </div>
          <div class="wb-thumb">${image ? `<img src="${image}" alt="" />` : '<div class="no-image">&mdash;</div>'}</div>
        </div>`;
    }).join('');

    return `
      <div class="wb-insert">
        <div class="wb-insert-label">${insertLabel}</div>
        <div class="wb-cells">${cells}</div>
      </div>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - Wristband Inserts</title>
  <style>
    @page {
      size: ${(preferences?.paper_size ?? 'letter') === 'a4' ? 'A4 landscape' : '11in 8.5in'};
      margin: 0.4in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      color: ${EXPORT_INK};
      background: white;
    }

    .playbook-header {
      text-align: center;
      margin-bottom: 0.15in;
      padding-bottom: 0.1in;
      border-bottom: ${EXPORT_ACCENT_RULE};
    }

    .playbook-title {
      font-size: 16pt;
      font-weight: bold;
      color: ${EXPORT_INK};
      margin-bottom: 2px;
    }

    .playbook-subtitle {
      font-size: 9pt;
      color: ${EXPORT_MUTED};
    }

    .wb-grid {
      display: grid;
      grid-template-columns: repeat(2, 4.5in);
      gap: 0.2in;
      justify-content: center;
    }

    .wb-insert {
      width: 4.5in;
      height: 2.2in;
      border: 1px dashed #999;
      border-radius: 4px;
      padding: 0.06in 0.1in;
      background: ${EXPORT_WASH};
      page-break-inside: avoid;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Text-only inserts: the table's own bold outer border is the cut line,
       so drop the dashed guide + grey wash used by the diagram variant. */
    .wb-insert-text {
      border: none;
      background: white;
      border-radius: 0;
      padding: 0;
    }

    .wb-insert-label {
      font-size: 6.5pt;
      color: ${EXPORT_MUTED};
      text-align: center;
      margin-bottom: 0.03in;
      flex-shrink: 0;
    }

    .wb-cells {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 0.04in;
      min-height: 0;
    }

    .wb-cell {
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      border: 1px solid #ccc;
      border-radius: 2px;
      overflow: hidden;
      background: white;
    }

    .wb-cell-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 1px 2px;
      background: #eee;
      min-width: 0;
    }

    .wb-number {
      flex-shrink: 0;
      width: 0.15in;
      height: 0.15in;
      border-radius: 50%;
      background: ${EXPORT_INK};
      color: white;
      font-weight: bold;
      font-size: 5.5pt;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wb-name {
      flex: 1;
      min-width: 0;
      font-weight: bold;
      color: ${EXPORT_INK};
      font-size: 5.5pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .wb-thumb {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      overflow: hidden;
    }

    .wb-thumb img {
      max-width: 100%;
      max-height: 100%;
    }

    .no-image {
      color: #999;
      font-size: 7pt;
    }

    /* Coach's-sheet look, matched to the supplied reference image: black
       header bar, bold outer border, thin inner rules, alternating
       grey/white row shading, bold centered numbers with a trailing
       period. */
    .wb-text-table {
      flex: 1;
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 3px solid ${EXPORT_INK};
    }

    .wb-text-table thead th {
      background: ${EXPORT_INK};
      color: #fff;
      font-weight: bold;
      font-size: 7.5pt;
      padding: 0.015in 0.03in;
      border: 1px solid ${EXPORT_INK};
    }

    .wb-h-num { text-align: center; }
    .wb-h-name { text-align: left; }

    /* 10 fixed data rows evenly fill whatever height the header leaves. */
    .wb-text-table tbody tr { height: calc(100% / 10); }

    .wb-text-table td {
      border: 1px solid ${EXPORT_MUTED};
      padding: 0.01in 0.03in;
      font-size: 8pt;
      line-height: 1.3;
    }

    /* Alternating shading, first data row shaded — matches the reference. */
    .wb-text-table tbody tr:nth-child(odd) td {
      background: #d9d9d9;
    }

    /* Column widths are set here, on <colgroup>'s <col> elements — the
       authoritative, unambiguous way to size a table-layout:fixed table.
       Setting width on the repeated .wb-num/.wb-play-name TD classes was
       unreliable (the name column rendered far too narrow and truncated
       aggressively — reported with a screenshot), since table-layout:fixed
       only reads the first row's cells to fix column widths, easy to get
       inconsistent results from cell-level CSS across 4 repeating columns. */
    .col-num {
      width: 10%;
    }

    .col-name {
      width: 40%;
    }

    .wb-num {
      font-weight: bold;
      color: ${EXPORT_INK};
      text-align: center;
    }

    .wb-play-name {
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 0; /* forces overflow/ellipsis to respect the table column width */
    }

    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .wb-insert { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="playbook-header">
    ${teamBrandHTML(preferences)}
    <div class="playbook-title">${escapeHtml(title)}</div>
    <div class="playbook-subtitle">Wristband Inserts &mdash; sized for a 4.5" &times; 2.2" wristband window &mdash; cut along dashed lines</div>
  </div>

  <div class="wb-grid">
    ${inserts}
  </div>

  ${exportFooterHTML(plays.length, '0.15in')}
</body>
</html>`;
}
