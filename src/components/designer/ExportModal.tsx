import React, { useState } from 'react';
import { X, FileText, Printer, BookOpen, Grid3X3, Lock, Watch } from 'lucide-react';

// Import LocalPlayMetadata from the PlayDesigner component
import type { PlayMetadata } from '../../types/play';
import { useEntitlement } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';
import { escapeHtml, paperPageSize, teamBrandHTML, playTitleHTML, type UserPreferences } from '../../lib/userPreferences';
import {
  EXPORT_ACCENT_RULE, EXPORT_INK, EXPORT_HAIRLINE, EXPORT_WASH, UNTITLED_PLAY,
  formatPlayType, exportFooterHTML, NOTES_BLOCK_CSS, notesBlockHTML, generateWristbandHTML,
} from '../../lib/exportStyles';
import { WRISTBAND_PRODUCT_NAME, WRISTBAND_WINDOW_SIZE, wristbandProductLink, SHOW_AFFILIATE_DISCLOSURE } from '../../lib/wristbandProducts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const PRO_ONLY_FORMATS = new Set(['detailed-playbook', 'grid-playbook', 'wristband-playbook']);

interface PlayData {
  metadata: PlayMetadata;
  canvasDataURL: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  <title>${escapeHtml(playData.metadata.playName || UNTITLED_PLAY)}</title>
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
      border-bottom: ${EXPORT_ACCENT_RULE};
    }

    .play-info {
      text-align: center;
      margin-top: 10px;
      font-size: 11pt;
      color: ${EXPORT_INK};
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
      border: 1px solid ${EXPORT_HAIRLINE};
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
    ${NOTES_BLOCK_CSS}

    .metadata-row {
      margin-bottom: 5px;
    }

    .metadata-label {
      font-weight: bold;
      color: ${EXPORT_INK};
    }

    .free-footer {
      margin-top: 15px;
      text-align: center;
      font-size: 8pt;
      color: #999;
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
      ${playTitleHTML(playData.metadata.playName || UNTITLED_PLAY, '28pt')}
      <div class="play-info">
        ${playData.metadata.formation ? `<div class="metadata-row"><span class="metadata-label">Formation:</span> ${escapeHtml(playData.metadata.formation)}</div>` : ''}
        ${playData.metadata.playType ? `<div class="metadata-row"><span class="metadata-label">Type:</span> ${escapeHtml(formatPlayType(playData.metadata.playType))}</div>` : ''}
        ${playData.metadata.situation ? `<div class="metadata-row"><span class="metadata-label">Situation:</span> ${escapeHtml(playData.metadata.situation)}</div>` : ''}
        ${playData.metadata.difficulty ? `<div class="metadata-row"><span class="metadata-label">Difficulty:</span> ${escapeHtml(formatPlayType(playData.metadata.difficulty))}</div>` : ''}
      </div>
    </div>

    <div class="main-content">
      <div class="canvas-container">
        <img src="${playData.canvasDataURL}" alt="Football Play Diagram" class="canvas-image" />
      </div>

      ${notesBlockHTML(playData.metadata.description, [
        { label: 'Personnel', value: playData.metadata.personnel },
        { label: 'Expected Yardage', value: playData.metadata.yardage },
        { label: 'Tags', value: playData.metadata.tags?.length ? playData.metadata.tags.join(', ') : null },
      ])}
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
          ${playTitleHTML(play.metadata.playName || UNTITLED_PLAY, '16pt')}
          <div class="play-meta">
            ${play.metadata.formation ? `<span>Formation: ${escapeHtml(play.metadata.formation)}</span>` : ''}
            ${play.metadata.playType ? `<span>Type: ${escapeHtml(formatPlayType(play.metadata.playType))}</span>` : ''}
          </div>
        </div>

        <div class="play-content">
          <div class="play-diagram">
            <img src="${play.canvasDataURL}" alt="${escapeHtml(play.metadata.playName || UNTITLED_PLAY)}" class="play-image" />
          </div>

          ${notesBlockHTML(play.metadata.description, [
            { label: 'Situation', value: play.metadata.situation },
            { label: 'Personnel', value: play.metadata.personnel },
          ])}
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
      color: ${EXPORT_INK};
      background: white;
    }

    .playbook-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: ${EXPORT_ACCENT_RULE};
    }

    .playbook-title {
      font-size: 24pt;
      font-weight: bold;
      color: ${EXPORT_INK};
      margin-bottom: 5px;
    }

    .playbook-subtitle {
      font-size: 12pt;
      color: #555;
    }

    .play-page {
      margin-bottom: 40px;
      page-break-inside: avoid;
      border: 1px solid ${EXPORT_HAIRLINE};
      border-radius: 8px;
      padding: 15px;
      background: ${EXPORT_WASH};
    }

    .play-header {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }

    .play-meta {
      text-align: center;
      margin-top: 6px;
      font-size: 9pt;
      color: #555;
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
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    ${NOTES_BLOCK_CSS}
    /* Notes sits beside the diagram in a grid column here, not stacked
       full-width below it — the shared block's top margin doesn't apply. */
    .play-content .pb-notes { margin-top: 0; }

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

  ${exportFooterHTML(plays.length, '30px')}
</body>
</html>`;
  };

  const generatePlaybookGridHTML = (plays: PlayData[]): string => {
    const playItems = plays.map(play => `
      <div class="grid-item">
        <div class="grid-play-name">${playTitleHTML(play.metadata.playName || UNTITLED_PLAY, '11pt')}</div>
        <div class="grid-play-image">
          <img src="${play.canvasDataURL}" alt="${escapeHtml(play.metadata.playName || UNTITLED_PLAY)}" />
        </div>
        <div class="grid-play-info">
          ${play.metadata.formation ? `<div>Formation: ${escapeHtml(play.metadata.formation)}</div>` : ''}
          ${play.metadata.playType ? `<div>Type: ${escapeHtml(formatPlayType(play.metadata.playType))}</div>` : ''}
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
      color: ${EXPORT_INK};
      background: white;
    }

    .playbook-header {
      text-align: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: ${EXPORT_ACCENT_RULE};
    }

    .playbook-title {
      font-size: 20pt;
      font-weight: bold;
      color: ${EXPORT_INK};
      margin-bottom: 5px;
    }

    .playbook-subtitle {
      font-size: 11pt;
      color: #555;
    }

    .plays-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .grid-item {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 10px;
      background: ${EXPORT_WASH};
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
      border: 1px solid ${EXPORT_HAIRLINE};
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
      color: #555;
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

  ${exportFooterHTML(plays.length, '20px')}
</body>
</html>`;
  };

  const generateWristbandPlaybookHTML = (plays: PlayData[], textOnly = false): string =>
    generateWristbandHTML({
      plays,
      getName: (play) => play.metadata.playName,
      getImage: (play) => play.canvasDataURL,
      title: preferences?.team_name ? `${preferences.team_name} Playbook` : 'Football Playbook',
      textOnly,
      preferences,
    });

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
