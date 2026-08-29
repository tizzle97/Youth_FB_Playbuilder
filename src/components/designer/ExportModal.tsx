import React, { useState } from 'react';
import { X, FileText, Printer, BookOpen, Grid3X3, Lock, Watch } from 'lucide-react';

// Import LocalPlayMetadata from the PlayDesigner component
import type { PlayMetadata } from '../../types/play';
import { useEntitlement } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';
import { escapeHtml, paperPageSize, teamBrandHTML, playTitleHTML, type UserPreferences } from '../../lib/userPreferences';
import { WRISTBAND_PRODUCT_NAME, WRISTBAND_PRODUCT_URL, WRISTBAND_WINDOW_SIZE, wristbandProductLink, SHOW_AFFILIATE_DISCLOSURE } from '../../lib/wristbandProducts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const PRO_ONLY_FORMATS = new Set(['detailed-playbook', 'grid-playbook', 'wristband-playbook']);

interface PlayData {
  metadata: PlayMetadata;
  canvasDataURL: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport?: (format: 'single' | 'multiple' | 'wristband') => void;
  canvasRef?: React.RefObject<any>;
  playMetadata?: PlayMetadata;
  onUpdateMetadata?: (metadata: PlayMetadata) => void;
  userHasAccount?: boolean;
  allPlays?: PlayData[];
  onGetAllPlays?: () => PlayData[];
  /** Team identity + export defaults (B-14/B-15); null when signed out. */
  preferences?: UserPreferences | null;
}

export function ExportModal({
  isOpen,
  onClose,
  canvasRef,
  playMetadata = {
    playName: 'Untitled Play',
    gameType: '11v11',
    playType: 'pass',
    formation: '',
    difficulty: 'beginner',
    tags: [],
    description: ''
  } as PlayMetadata,
  onUpdateMetadata,
  allPlays = [],
  onGetAllPlays,
  preferences = null
}: ExportModalProps) {
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'single-play' | 'detailed-playbook' | 'grid-playbook' | 'wristband-playbook'>('single-play');
  // Wristband-only option: a dense #+name table instead of image cells —
  // see generateWristbandPlaybookHTML's textOnly branch.
  const [wristbandTextOnly, setWristbandTextOnly] = useState(false);
  const [metadata, setMetadata] = useState<PlayMetadata>(playMetadata);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const { isPro, loading: entitlementLoading } = useEntitlement();

  // Escape mirrors the header's X button in each view: back out of the
  // metadata editor rather than closing the whole modal when it's open.
  useEscapeKey(isOpen, showMetadataEditor ? () => setShowMetadataEditor(false) : onClose);

  if (!isOpen) return null;

  const updateMetadata = (field: keyof PlayMetadata, value: any) => {
    const updated = { ...metadata, [field]: value };
    setMetadata(updated);
    onUpdateMetadata?.(updated);
  };

  const getCurrentCanvasData = (): string => {
    // Fixed-resolution render so prints are identical on every device
    const fixed = canvasRef?.current?.exportImage?.();
    if (fixed) return fixed;
    const canvas = document.getElementById('play-canvas') as HTMLCanvasElement;
    if (canvas) {
      return canvas.toDataURL('image/png', 1.0);
    }
    return '';
  };

  const generateSinglePlayHTML = (playData: PlayData): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${playData.metadata.playName || 'Football Play'}</title>
  <style>
    @page {
      size: ${paperPageSize(preferences?.paper_size ?? 'letter')};
      margin: 0.75in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      background: white;
    }
    
    .page {
      width: 100%;
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2563eb;
    }

    .play-info {
      text-align: center;
      margin-top: 10px;
      font-size: 11pt;
      color: #64748b;
    }
    
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .canvas-container {
      text-align: center;
      margin: 20px 0;
      padding: 20px;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .canvas-image {
      max-width: 100%;
      max-height: 400px;
      height: auto;
      border-radius: 4px;
    }
    
    .notes-section {
      margin-top: 20px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    
    .notes-title {
      font-weight: bold;
      font-size: 14pt;
      color: #1e293b;
      margin-bottom: 10px;
    }
    
    .notes-content {
      font-size: 11pt;
      line-height: 1.6;
      color: #374151;
    }
    
    .metadata-row {
      margin-bottom: 5px;
    }
    
    .metadata-label {
      font-weight: bold;
      color: #374151;
    }

    .free-footer {
      margin-top: 15px;
      text-align: center;
      font-size: 8pt;
      color: #9ca3af;
    }

    @media print {
      body { -webkit-print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${teamBrandHTML(preferences)}
    <div class="header">
      ${playTitleHTML(playData.metadata.playName || 'Untitled Play', '28pt')}
      <div class="play-info">
        ${playData.metadata.formation ? `<div class="metadata-row"><span class="metadata-label">Formation:</span> ${playData.metadata.formation}</div>` : ''}
        ${playData.metadata.playType ? `<div class="metadata-row"><span class="metadata-label">Type:</span> ${playData.metadata.playType}</div>` : ''}
        ${playData.metadata.situation ? `<div class="metadata-row"><span class="metadata-label">Situation:</span> ${playData.metadata.situation}</div>` : ''}
        ${playData.metadata.difficulty ? `<div class="metadata-row"><span class="metadata-label">Difficulty:</span> ${playData.metadata.difficulty}</div>` : ''}
      </div>
    </div>
    
    <div class="main-content">
      <div class="canvas-container">
        <img src="${playData.canvasDataURL}" alt="Football Play Diagram" class="canvas-image" />
      </div>
      
      <div class="notes-section">
        <div class="notes-title">Notes & Execution</div>
        <div class="notes-content">
          ${playData.metadata.description || 'No notes provided for this play.'}
          
          ${playData.metadata.personnel ? `<br><br><strong>Personnel:</strong> ${playData.metadata.personnel}` : ''}
          ${playData.metadata.yardage ? `<br><strong>Expected Yardage:</strong> ${playData.metadata.yardage}` : ''}
          ${playData.metadata.tags && playData.metadata.tags.length > 0 ? `<br><strong>Tags:</strong> ${playData.metadata.tags.join(', ')}` : ''}
        </div>
      </div>
    </div>
    ${!isPro ? '<div class="free-footer">Made with playbuilderpro.com</div>' : ''}
  </div>
</body>
</html>`;
  };

  const generatePlaybookDetailedHTML = (plays: PlayData[]): string => {
    const playPages = plays.map(play => `
      <div class="play-page">
        <div class="play-header">
          ${playTitleHTML(play.metadata.playName || 'Untitled Play', '16pt')}
          <div class="play-meta">
            ${play.metadata.formation ? `<span>Formation: ${play.metadata.formation}</span>` : ''}
            ${play.metadata.playType ? `<span>Type: ${play.metadata.playType}</span>` : ''}
          </div>
        </div>
        
        <div class="play-content">
          <div class="play-diagram">
            <img src="${play.canvasDataURL}" alt="${play.metadata.playName}" class="play-image" />
          </div>
          
          <div class="play-notes">
            <h4>Notes</h4>
            <p>${play.metadata.description || 'No notes provided.'}</p>
            ${play.metadata.situation ? `<p><strong>Situation:</strong> ${play.metadata.situation}</p>` : ''}
            ${play.metadata.personnel ? `<p><strong>Personnel:</strong> ${play.metadata.personnel}</p>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Playbook - Detailed View</title>
  <style>
    @page {
      size: ${paperPageSize(preferences?.paper_size ?? 'letter')};
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.3;
      color: #000;
      background: white;
    }
    
    .playbook-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 3px solid #2563eb;
    }
    
    .playbook-title {
      font-size: 24pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .playbook-subtitle {
      font-size: 12pt;
      color: #64748b;
    }
    
    .play-page {
      margin-bottom: 40px;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      background: #fafafa;
    }
    
    .play-header {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #d1d5db;
    }

    .play-meta {
      text-align: center;
      margin-top: 6px;
      font-size: 9pt;
      color: #6b7280;
    }

    .play-meta span {
      margin: 0 8px;
    }
    
    .play-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
    }
    
    .play-diagram {
      text-align: center;
    }
    
    .play-image {
      max-width: 100%;
      height: auto;
      max-height: 250px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
    }
    
    .play-notes {
      padding: 10px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    
    .play-notes h4 {
      font-size: 12pt;
      color: #374151;
      margin-bottom: 8px;
    }
    
    .play-notes p {
      margin-bottom: 8px;
      font-size: 9pt;
      line-height: 1.4;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .play-page { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="playbook-header">
    ${teamBrandHTML(preferences)}
    <div class="playbook-title">${preferences?.team_name ? `${escapeHtml(preferences.team_name)} Playbook` : 'Football Playbook'}</div>
    <div class="playbook-subtitle">Detailed Play Collection</div>
  </div>
  
  ${playPages}
  
  <div style="margin-top: 30px; text-align: center; font-size: 8pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px;">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Total Plays: ${plays.length}
  </div>
</body>
</html>`;
  };

  const generatePlaybookGridHTML = (plays: PlayData[]): string => {
    const playItems = plays.map(play => `
      <div class="grid-item">
        <div class="grid-play-name">${playTitleHTML(play.metadata.playName || 'Untitled', '11pt')}</div>
        <div class="grid-play-image">
          <img src="${play.canvasDataURL}" alt="${play.metadata.playName}" />
        </div>
        <div class="grid-play-info">
          ${play.metadata.formation ? `<div>Formation: ${play.metadata.formation}</div>` : ''}
          ${play.metadata.playType ? `<div>Type: ${play.metadata.playType}</div>` : ''}
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Playbook - Grid View</title>
  <style>
    @page {
      size: ${paperPageSize(preferences?.paper_size ?? 'letter')};
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.2;
      color: #000;
      background: white;
    }
    
    .playbook-header {
      text-align: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px solid #2563eb;
    }
    
    .playbook-title {
      font-size: 20pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .playbook-subtitle {
      font-size: 11pt;
      color: #64748b;
    }
    
    .plays-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .grid-item {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px;
      background: #fafafa;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .grid-play-name {
      margin-bottom: 8px;
      min-height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .grid-play-image {
      margin-bottom: 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 5px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .grid-play-image img {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      width: auto;
    }
    
    .grid-play-info {
      font-size: 8pt;
      color: #6b7280;
      line-height: 1.3;
    }
    
    .grid-play-info div {
      margin-bottom: 2px;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .grid-item { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="playbook-header">
    ${teamBrandHTML(preferences)}
    <div class="playbook-title">${preferences?.team_name ? `${escapeHtml(preferences.team_name)} Playbook` : 'Football Playbook'}</div>
    <div class="playbook-subtitle">Quick Reference Grid</div>
  </div>
  
  <div class="plays-grid">
    ${playItems}
  </div>
  
  <div style="margin-top: 20px; text-align: center; font-size: 8pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px;">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Total Plays: ${plays.length}
  </div>
</body>
</html>`;
  };

  const generateWristbandPlaybookHTML = (plays: PlayData[], textOnly = false): string => {
    // 4.5in x 2.2in matches the play window on Wristband Interactive Y23-style
    // QB wristbands, which hold 3 cut inserts arranged as a 4x2 grid of
    // numbered plays (8 per insert) — same layout as the printed inserts
    // that ship with those wristbands.
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

    const insertGroups: PlayData[][] = [];
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
        // template's shape never changes.
        const cell = (play: PlayData | undefined, num: number | '') => `
            <td class="wb-num">${num}</td><td class="wb-play-name">${play ? (play.metadata.playName || 'Untitled') : ''}</td>`;
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
          <tbody>${rowsHtml}
        </tbody></table>
      </div>`;
      }

      const cells = group.map((play, i) => {
        const playNumber = groupIndex * perInsert + i + 1;
        return `
        <div class="wb-cell">
          <div class="wb-cell-header">
            <div class="wb-number">${playNumber}</div>
            <div class="wb-name">${play.metadata.playName || 'Untitled'}</div>
          </div>
          <div class="wb-thumb"><img src="${play.canvasDataURL}" alt="" /></div>
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
  <title>Playbook - Wristband Inserts</title>
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
      color: #000;
      background: white;
    }

    .playbook-header {
      text-align: center;
      margin-bottom: 0.15in;
      padding-bottom: 0.1in;
      border-bottom: 3px solid #2563eb;
    }

    .playbook-title {
      font-size: 16pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 2px;
    }

    .playbook-subtitle {
      font-size: 9pt;
      color: #64748b;
    }

    .wb-compat {
      font-size: 6.5pt;
      color: #9ca3af;
      margin-top: 2px;
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
      border: 1px dashed #9ca3af;
      border-radius: 4px;
      padding: 0.06in 0.1in;
      background: #fafafa;
      page-break-inside: avoid;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .wb-insert-label {
      font-size: 6.5pt;
      color: #6b7280;
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
      border: 1px solid #e5e7eb;
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
      background: #eef2ff;
      min-width: 0;
    }

    .wb-number {
      flex-shrink: 0;
      width: 0.15in;
      height: 0.15in;
      border-radius: 50%;
      background: #1e40af;
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
      color: #1e40af;
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

    /* Fixed 4-column x 10-row grid, styled like an Excel table — full cell
       borders on every row including blank ones, so the template's shape
       reads the same whether it's fully populated or mostly empty. */
    .wb-text-table {
      flex: 1;
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .wb-text-table tr {
      height: 10%; /* 10 fixed rows, evenly filling the insert */
    }

    .wb-text-table td {
      border: 1px solid #9ca3af;
      padding: 0.01in 0.03in;
      font-size: 8pt;
      line-height: 1.3;
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
      color: #1e40af;
      text-align: right;
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
    <div class="playbook-title">${preferences?.team_name ? `${escapeHtml(preferences.team_name)} Playbook` : 'Football Playbook'}</div>
    <div class="playbook-subtitle">Wristband Inserts &mdash; sized for a 4.5" &times; 2.2" wristband window &mdash; cut along dashed lines</div>
    <div class="wb-compat">Compatible with ${WRISTBAND_PRODUCT_NAME} (${WRISTBAND_PRODUCT_URL}) and any wristband with a ${WRISTBAND_WINDOW_SIZE} play window.${SHOW_AFFILIATE_DISCLOSURE ? ' As an Amazon Associate we earn from qualifying purchases.' : ''}</div>
  </div>

  <div class="wb-grid">
    ${inserts}
  </div>

  <div style="margin-top: 0.15in; text-align: center; font-size: 8pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 0.08in;">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Total Plays: ${plays.length}
  </div>
</body>
</html>`;
  };

  const handleFormatClick = (formatId: string) => {
    if (PRO_ONLY_FORMATS.has(formatId) && !entitlementLoading && !isPro) {
      setShowUpgradePrompt(true);
      return;
    }
    setSelectedFormat(formatId as 'single-play' | 'detailed-playbook' | 'grid-playbook' | 'wristband-playbook');
    setShowMetadataEditor(true);
  };

  const handlePrintExport = async () => {
    try {
      let htmlContent = '';
      
      if (selectedFormat === 'single-play') {
        const canvasDataURL = getCurrentCanvasData();
        if (!canvasDataURL || canvasDataURL.length < 100) {
          alert('Canvas appears to be empty. Please draw a play first.');
          return;
        }
        
        const playData: PlayData = { metadata, canvasDataURL };
        htmlContent = generateSinglePlayHTML(playData);
      } else {
        let plays: PlayData[] = [];
        
        if (onGetAllPlays) {
          plays = onGetAllPlays();
        } else if (allPlays.length > 0) {
          plays = allPlays;
        } else {
          const canvasDataURL = getCurrentCanvasData();
          if (canvasDataURL && canvasDataURL.length > 100) {
            plays = [{ metadata, canvasDataURL }];
          }
        }
        
        if (plays.length === 0) {
          alert('No plays found in your playbook. Please create some plays first.');
          return;
        }
        
        if (selectedFormat === 'detailed-playbook') {
          htmlContent = generatePlaybookDetailedHTML(plays);
        } else if (selectedFormat === 'wristband-playbook') {
          htmlContent = generateWristbandPlaybookHTML(plays, wristbandTextOnly);
        } else {
          htmlContent = generatePlaybookGridHTML(plays);
        }
      }

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        alert('Popup blocked. Please allow popups for this site and try again.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };

      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      }, 1000);

    } catch (error) {
      console.error('Print export error:', error);
      alert('There was an error generating the print. Please try again.');
    }
  };

  // NEW: The main print format options that replace the old export options
  const printFormatOptions = [
    {
      id: 'single-play',
      name: 'Single Play Sheet',
      description: 'Play name in top right, notes beneath diagram',
      icon: FileText
    },
    {
      id: 'detailed-playbook',
      name: 'Detailed Playbook',
      description: 'All plays with diagrams and notes, one per page',
      icon: BookOpen
    },
    {
      id: 'grid-playbook',
      name: 'Playbook Grid',
      description: 'All plays in a compact grid layout on one page',
      icon: Grid3X3
    },
    {
      id: 'wristband-playbook',
      name: 'Wristband Sheet',
      description: 'Sized for a 4.5"x2.2" QB wristband insert, cut and slide in',
      icon: Watch
    }
  ];

  if (showMetadataEditor) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />
        <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden text-left bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10 flex-shrink-0">
            <h3 className="text-xl font-bold text-chalk">
              {selectedFormat === 'single-play' && 'Single Play Sheet'}
              {selectedFormat === 'detailed-playbook' && 'Detailed Playbook'}
              {selectedFormat === 'grid-playbook' && 'Playbook Grid'}
              {selectedFormat === 'wristband-playbook' && 'Wristband Sheet'}
            </h3>
            <button
              onClick={() => setShowMetadataEditor(false)}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Single Play Metadata */}
              {selectedFormat === 'single-play' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-chalk mb-2">
                      Play Name *
                    </label>
                    <input
                      type="text"
                      value={metadata.playName || ''}
                      onChange={(e) => updateMetadata('playName', e.target.value)}
                      placeholder="Enter play name..."
                      className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-chalk mb-2">
                        Formation
                      </label>
                      <input
                        type="text"
                        value={metadata.formation || ''}
                        onChange={(e) => updateMetadata('formation', e.target.value)}
                        placeholder="e.g., I-Formation"
                        className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-chalk mb-2">
                        Play Type
                      </label>
                      <select
                        value={metadata.playType || ''}
                        onChange={(e) => updateMetadata('playType', e.target.value)}
                        className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select type...</option>
                        <option value="Run">Run</option>
                        <option value="Pass">Pass</option>
                        <option value="Special">Special Teams</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-chalk mb-2">
                      Notes & Execution
                    </label>
                    <textarea
                      value={metadata.description || ''}
                      onChange={(e) => updateMetadata('description', e.target.value)}
                      placeholder="Describe the play execution, reads, coaching points..."
                      rows={4}
                      className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Playbook format info */}
              {(selectedFormat === 'detailed-playbook' || selectedFormat === 'grid-playbook' || selectedFormat === 'wristband-playbook') && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-primary mr-2" />
                    <div>
                      <p className="text-sm font-medium text-chalk">
                        {selectedFormat === 'detailed-playbook' && 'Detailed Playbook'}
                        {selectedFormat === 'grid-playbook' && 'Grid Playbook'}
                        {selectedFormat === 'wristband-playbook' && 'Wristband Sheet'}
                      </p>
                      <p className="text-xs text-chalk/70 mt-1">
                        {selectedFormat === 'detailed-playbook' && 'This will print all plays in your playbook with detailed information'}
                        {selectedFormat === 'grid-playbook' && 'This will print all plays in a compact grid format on one page'}
                        {selectedFormat === 'wristband-playbook' && 'This will print inserts sized 4.5" x 2.2" to cut and slide into a QB wristband'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedFormat === 'wristband-playbook' && (
                <label className="flex items-center gap-2 mb-3 text-sm text-chalk cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wristbandTextOnly}
                    onChange={(e) => setWristbandTextOnly(e.target.checked)}
                    className="rounded border-chalk/30"
                  />
                  Text only (no play diagrams) — fits more plays per insert
                </label>
              )}

              {selectedFormat === 'wristband-playbook' && (
                <div className="bg-board border border-chalk/10 rounded-lg p-3 text-xs text-chalk/60">
                  <p>
                    Compatible with{' '}
                    <a
                      href={wristbandProductLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                    >
                      {WRISTBAND_PRODUCT_NAME}
                    </a>{' '}
                    and any wristband with a {WRISTBAND_WINDOW_SIZE} play window.
                  </p>
                  {SHOW_AFFILIATE_DISCLOSURE && (
                    <p className="mt-1 text-chalk/40">
                      As an Amazon Associate we earn from qualifying purchases.
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Print Actions */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-chalk/10 flex justify-end space-x-3">
            <button
              onClick={() => setShowMetadataEditor(false)}
              className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
            >
              Back
            </button>

            <button
              onClick={handlePrintExport}
              disabled={selectedFormat === 'single-play' && !metadata.playName?.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print {selectedFormat === 'single-play' ? 'Play' : 'Playbook'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-md max-h-[90vh] overflow-hidden text-left bg-board-light rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10 flex-shrink-0">
          <h3 className="text-xl font-bold text-chalk">Export Play</h3>
          <button
            onClick={onClose}
            className="text-chalk/70 hover:text-chalk transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <p className="text-chalk/70 mb-4">
            Choose a print format:
          </p>
          <div className="space-y-3">
            {printFormatOptions.map((option) => {
              const locked = PRO_ONLY_FORMATS.has(option.id) && !entitlementLoading && !isPro;
              return (
                <button
                  key={option.id}
                  onClick={() => handleFormatClick(option.id)}
                  className="w-full flex items-center p-4 bg-board hover:bg-board-light border border-chalk/10 rounded-lg transition-colors"
                >
                  <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary">
                    <option.icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4 text-left">
                    <h4 className="text-lg font-medium text-chalk flex items-center gap-2">
                      {option.name}
                      {locked && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <Lock className="h-3 w-3" /> Pro
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-chalk/70">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Playbook PDF export"
        description="Detailed and grid playbook layouts are part of Playbuilder Pro ($39/yr). Single-play export stays free."
      />
    </div>
  );
}
