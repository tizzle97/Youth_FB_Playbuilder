import React, { useState } from 'react';
import { X, FileText, Printer, BookOpen, Grid3X3, Lock } from 'lucide-react';

// Import LocalPlayMetadata from the PlayDesigner component
import type { PlayMetadata } from '../../types/play';
import { useEntitlement } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';

const PRO_ONLY_FORMATS = new Set(['detailed-playbook', 'grid-playbook']);

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
  onGetAllPlays
}: ExportModalProps) {
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'single-play' | 'detailed-playbook' | 'grid-playbook'>('single-play');
  const [metadata, setMetadata] = useState<PlayMetadata>(playMetadata);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const { isPro, loading: entitlementLoading } = useEntitlement();

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
      size: 8.5in 11in;
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
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2563eb;
    }
    
    .play-title {
      font-size: 28pt;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 1px;
      flex: 1;
    }
    
    .play-info {
      text-align: right;
      font-size: 11pt;
      color: #64748b;
      max-width: 200px;
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
    <div class="header">
      <div class="play-title">${playData.metadata.playName || 'Untitled Play'}</div>
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
          <h2 class="play-name">${play.metadata.playName || 'Untitled Play'}</h2>
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
      size: 8.5in 11in;
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
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #d1d5db;
    }
    
    .play-name {
      font-size: 16pt;
      font-weight: bold;
      color: #1e40af;
    }
    
    .play-meta {
      font-size: 9pt;
      color: #6b7280;
    }
    
    .play-meta span {
      margin-left: 15px;
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
    <div class="playbook-title">Football Playbook</div>
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
        <div class="grid-play-name">${play.metadata.playName || 'Untitled'}</div>
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
      size: 8.5in 11in;
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
      font-size: 11pt;
      font-weight: bold;
      color: #1e40af;
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
    <div class="playbook-title">Football Playbook</div>
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

  const handleFormatClick = (formatId: string) => {
    if (PRO_ONLY_FORMATS.has(formatId) && !entitlementLoading && !isPro) {
      setShowUpgradePrompt(true);
      return;
    }
    setSelectedFormat(formatId as 'single-play' | 'detailed-playbook' | 'grid-playbook');
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
    }
  ];

  if (showMetadataEditor) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
          <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />
          <div className="inline-block w-full max-w-3xl overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
              <h3 className="text-xl font-bold text-chalk">
                {selectedFormat === 'single-play' && 'Single Play Sheet'}
                {selectedFormat === 'detailed-playbook' && 'Detailed Playbook'}
                {selectedFormat === 'grid-playbook' && 'Playbook Grid'}
              </h3>
              <button
                onClick={() => setShowMetadataEditor(false)}
                className="text-chalk/70 hover:text-chalk transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
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
              {(selectedFormat === 'detailed-playbook' || selectedFormat === 'grid-playbook') && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-primary mr-2" />
                    <div>
                      <p className="text-sm font-medium text-chalk">
                        {selectedFormat === 'detailed-playbook' ? 'Detailed Playbook' : 'Grid Playbook'}
                      </p>
                      <p className="text-xs text-chalk/70 mt-1">
                        {selectedFormat === 'detailed-playbook' 
                          ? 'This will print all plays in your playbook with detailed information'
                          : 'This will print all plays in a compact grid format on one page'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Print Actions */}
            <div className="px-6 py-4 border-t border-chalk/10 flex justify-end space-x-3">
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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />
        <div className="inline-block w-full max-w-md overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-xl font-bold text-chalk">Export Play</h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
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
