import React from 'react';
import { X, Download, Printer, Layers } from 'lucide-react';
import { renderOverlayScene, EXPORT_WIDTH, EXPORT_HEIGHT, type SceneLayer } from '../../lib/renderPlayScene';
import { paperPageSize, escapeHtml } from '../../lib/userPreferences';
import { EXPORT_ACCENT_RULE, EXPORT_INK, EXPORT_HAIRLINE } from '../../lib/exportStyles';

// ---------------------------------------------
// Export options for the read-only "vs. defense" view (B-36 follow-up #1):
// a PNG or printable PDF of whatever matchup is currently on screen, plus a
// multi-page PDF of the offense against every defense in the coach's deck.
// Reuses renderOverlayScene() (already offscreen-context-agnostic) at the
// same EXPORT_WIDTH/EXPORT_HEIGHT fixed resolution as the designer's own
// exportImage(), so output matches the print quality of every other export
// surface in the app.
// ---------------------------------------------

type ExportDeckEntry = { id: string; name: string; scene: SceneLayer };

interface VsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  offenseName: string;
  offenseScene: SceneLayer;
  /** The defense currently on screen, honoring the same show/hide toggle as
   *  the live view — null when hidden or the deck is empty. */
  currentDefense: ExportDeckEntry | null;
  currentDefenseVisible: boolean;
  /** Full deck, for the "whole deck" sheet — independent of the show/hide
   *  toggle, since the point of that sheet is to cover every look. */
  deck: ExportDeckEntry[];
}

function sceneToDataURL(offense: SceneLayer, defense: SceneLayer | null): string {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  renderOverlayScene(ctx, EXPORT_WIDTH, EXPORT_HEIGHT, offense, defense);
  return canvas.toDataURL('image/png');
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'play';
}

function downloadDataURL(dataURL: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = filename;
  a.click();
}

function matchupPageHTML(dataURL: string, offenseName: string, defenseName: string | null): string {
  return `
    <div class="matchup-page">
      <div class="matchup-header">
        <div class="matchup-title">${escapeHtml(offenseName)}</div>
        ${defenseName ? `<div class="matchup-subtitle">vs. ${escapeHtml(defenseName)}</div>` : ''}
      </div>
      <div class="matchup-image"><img src="${dataURL}" alt="" /></div>
    </div>`;
}

function buildPrintHTML(pagesHTML: string, docTitle: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page { size: ${paperPageSize('letter')}; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: ${EXPORT_INK}; background: white; }
    .matchup-page {
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
      page-break-inside: avoid;
      page-break-after: always;
    }
    .matchup-page:last-child { page-break-after: auto; }
    .matchup-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: ${EXPORT_ACCENT_RULE};
    }
    .matchup-title {
      font-size: 22pt;
      font-weight: bold;
      color: ${EXPORT_INK};
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .matchup-subtitle { font-size: 13pt; color: #555; margin-top: 4px; }
    .matchup-image { flex: 1; display: flex; align-items: center; justify-content: center; }
    .matchup-image img {
      max-width: 100%;
      max-height: 100%;
      border: 1px solid ${EXPORT_HAIRLINE};
      border-radius: 8px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .matchup-page { page-break-inside: avoid; }
    }
  </style>
</head>
<body>${pagesHTML}</body>
</html>`;
}

function openPrintWindow(html: string) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site and try again.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
}

export function VsExportModal({
  isOpen,
  onClose,
  offenseName,
  offenseScene,
  currentDefense,
  currentDefenseVisible,
  deck,
}: VsExportModalProps) {
  if (!isOpen) return null;

  const activeDefenseScene = currentDefenseVisible ? currentDefense?.scene ?? null : null;
  const activeDefenseName = currentDefenseVisible ? currentDefense?.name ?? null : null;

  const handleDownloadPNG = () => {
    const dataURL = sceneToDataURL(offenseScene, activeDefenseScene);
    if (!dataURL) return;
    const suffix = activeDefenseName ? `-vs-${slugify(activeDefenseName)}` : '';
    downloadDataURL(dataURL, `${slugify(offenseName)}${suffix}.png`);
  };

  const handlePrintMatchup = () => {
    const dataURL = sceneToDataURL(offenseScene, activeDefenseScene);
    if (!dataURL) return;
    openPrintWindow(buildPrintHTML(matchupPageHTML(dataURL, offenseName, activeDefenseName), offenseName));
  };

  const handlePrintDeck = () => {
    const pagesHTML = deck
      .map((d) => matchupPageHTML(sceneToDataURL(offenseScene, d.scene), offenseName, d.name))
      .join('');
    openPrintWindow(buildPrintHTML(pagesHTML, `${offenseName} — Full Deck`));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-75" onClick={onClose} />
        <div className="inline-block w-full max-w-sm overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-xl font-bold text-chalk">Export Matchup</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="tap-target flex items-center justify-center text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-chalk/50 uppercase tracking-wide mb-2">This matchup</p>
              <div className="space-y-2">
                <button
                  onClick={handleDownloadPNG}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-board hover:bg-board-light border border-chalk/10 rounded-lg text-chalk transition-colors"
                >
                  <Download className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">Download PNG</span>
                </button>
                <button
                  onClick={handlePrintMatchup}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-board hover:bg-board-light border border-chalk/10 rounded-lg text-chalk transition-colors"
                >
                  <Printer className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">Print / Save as PDF</span>
                </button>
              </div>
            </div>
            {deck.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-chalk/50 uppercase tracking-wide mb-2">
                  Whole deck ({deck.length} defense{deck.length === 1 ? '' : 's'})
                </p>
                <button
                  onClick={handlePrintDeck}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-board hover:bg-board-light border border-chalk/10 rounded-lg text-chalk transition-colors"
                >
                  <Layers className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">Print full deck vs. this play</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
