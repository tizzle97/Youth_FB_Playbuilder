// PlaybooksPage.tsx - Enhanced with PDF Export Feature

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Play,
  Edit3,
  Trash2,
  Search,
  Grid,
  List,
  Clock,
  Download,
  ChevronDown,
  FileText,
  LayoutGrid,
  Lock,
  Watch
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { useEntitlement } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';
import { getUserPreferences, paperPageSize, teamBrandHTML, type UserPreferences } from '../../lib/userPreferences';

interface Playbook {
  id: string;
  name: string;
  description: string;
  created_at: string;
  user_id: string;
  play_count: number;
}

interface PlayInPlaybook {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  created_at: string;
  type: 'offense' | 'defense' | 'special_teams';
  metadata: any;
  order_position: number;
}

export function PlaybooksPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [playsInPlaybook, setPlaysInPlaybook] = useState<PlayInPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const { isPro, loading: entitlementLoading } = useEntitlement();
  const [newPlaybookName, setNewPlaybookName] = useState('');
  const [newPlaybookDescription, setNewPlaybookDescription] = useState('');
  const [createPlaybookError, setCreatePlaybookError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Team identity / export defaults (B-14/B-15), stamped onto playbook PDFs
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  useEffect(() => {
    if (!user) { setPrefs(null); return; }
    let cancelled = false;
    getUserPreferences(user.id).then((p) => { if (!cancelled) setPrefs(p); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPlaybooks();
    }
  }, [user]);

  const loadPlaybooks = async () => {
    try {
      setLoading(true);
      
      const { data: playbooks, error } = await supabase
        .from('playbooks')
        .select(`
          *,
          playbook_plays(count)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const playbooksWithCount = playbooks.map(playbook => ({
        ...playbook,
        play_count: playbook.playbook_plays.length || 0
      }));

      setPlaybooks(playbooksWithCount);
    } catch (error) {
      console.error('Error loading playbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlaysInPlaybook = async (playbookId: string) => {
    try {
      const { data: plays, error } = await supabase
        .from('playbook_plays')
        .select(`
          order_position,
          plays!inner(*)
        `)
        .eq('playbook_id', playbookId)
        .order('order_position', { ascending: true });

      if (error) throw error;

      const formattedPlays = plays.map((item: any) => {
        const p = item.plays || {};
        return {
          id: p.id,
          name: p.name || '',
          description: p.description || '',
          thumbnail: p.thumbnail || '',
          created_at: p.created_at || '',
          type: (p.type as any) || 'offense',
          metadata: p.metadata || {},
          order_position: item.order_position
        } as PlayInPlaybook;
      });

      setPlaysInPlaybook(formattedPlays);
    } catch (error) {
      console.error('Error loading plays:', error);
    }
  };

  const createPlaybook = async () => {
    if (!newPlaybookName.trim()) return;

    try {
      setCreatePlaybookError(null);
      const { error } = await supabase
        .from('playbooks')
        .insert([
            {
            name: newPlaybookName,
            description: newPlaybookDescription,
            user_id: user!.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setNewPlaybookName('');
      setNewPlaybookDescription('');
      loadPlaybooks();
    } catch (error) {
      console.error('Error creating playbook:', error);
      setCreatePlaybookError(getSafeErrorMessage(error, 'Failed to create playbook'));
    }
  };

  const handlePlaybookSelect = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    loadPlaysInPlaybook(playbook.id);
  };

  const deletePlaybook = async (playbook: Playbook) => {
    if (!confirm(
      `Delete "${playbook.name}"? This removes the playbook and its play list. ` +
      `Your individual plays are not deleted and remain in your Plays library.`
    )) {
      return;
    }

    try {
      // playbook_plays rows cascade-delete with the playbook (ON DELETE CASCADE),
      // so the plays themselves are untouched
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', playbook.id);

      if (error) throw error;

      if (selectedPlaybook?.id === playbook.id) {
        setSelectedPlaybook(null);
        setPlaysInPlaybook([]);
      }
      setPlaybooks((prev) => prev.filter((p) => p.id !== playbook.id));
    } catch (error) {
      console.error('Error deleting playbook:', error);
      alert('Failed to delete playbook. Please try again.');
    }
  };

  const handleEditPlay = (playId: string) => {
    navigate(`/designer?play=${playId}`);
  };

  const handleNewPlay = () => {
    navigate('/designer');
  };

  // PDF Export Functions
  const generateSimplePlayHTML = (play: PlayInPlaybook): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${play.name}</title>
  <style>
    @page {
      size: ${paperPageSize(prefs?.paper_size ?? 'letter')};
      margin: 0.75in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      background: white;
      color: #000;
    }
    
    .page {
      width: 100%;
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    
    .play-title {
      font-size: 32pt;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 40px;
    }
    
    .diagram-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
    }
    
    .diagram-image {
      max-width: 100%;
      max-height: 600px;
      height: auto;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${teamBrandHTML(prefs)}
    <div class="play-title">${play.name}</div>
    <div class="diagram-container">
      ${play.thumbnail ? 
        `<img src="${play.thumbnail}" alt="${play.name}" class="diagram-image" />` :
        `<div style="width: 400px; height: 300px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #666;">No diagram available</div>`
      }
    </div>
  </div>
</body>
</html>`;
  };

  const generateDetailedPlayHTML = (play: PlayInPlaybook): string => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${play.name}</title>
  <style>
    @page {
      size: ${paperPageSize(prefs?.paper_size ?? 'letter')};
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
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    
    .play-title {
      font-size: 28pt;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    
    .play-type {
      font-size: 14pt;
      color: #64748b;
      text-transform: capitalize;
    }
    
    .content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    
    .diagram-section {
      text-align: center;
    }
    
    .diagram-image {
      max-width: 100%;
      height: auto;
      max-height: 350px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .metadata-section {
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    
    .metadata-title {
      font-size: 16pt;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 15px;
    }
    
    .metadata-item {
      margin-bottom: 12px;
    }
    
    .metadata-label {
      font-weight: bold;
      color: #475569;
      display: block;
      margin-bottom: 3px;
    }
    
    .metadata-value {
      color: #1e293b;
    }
    
    .description-section {
      margin-top: 30px;
      padding: 20px;
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      border-radius: 0 8px 8px 0;
    }
    
    .description-title {
      font-weight: bold;
      font-size: 14pt;
      color: #92400e;
      margin-bottom: 10px;
    }
    
    .description-text {
      color: #451a03;
      line-height: 1.6;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${teamBrandHTML(prefs)}
    <div class="header">
      <div class="play-title">${play.name}</div>
      <div class="play-type">${play.type} Play</div>
    </div>
    
    <div class="content">
      <div class="diagram-section">
        ${play.thumbnail ? 
          `<img src="${play.thumbnail}" alt="${play.name}" class="diagram-image" />` :
          `<div style="width: 100%; height: 300px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #666; background: #f9f9f9;">No diagram available</div>`
        }
      </div>
      
      <div class="metadata-section">
        <div class="metadata-title">Play Details</div>
        
        ${play.metadata?.formation ? `
          <div class="metadata-item">
            <span class="metadata-label">Formation:</span>
            <span class="metadata-value">${play.metadata.formation}</span>
          </div>
        ` : ''}
        
        ${play.metadata?.situation ? `
          <div class="metadata-item">
            <span class="metadata-label">Situation:</span>
            <span class="metadata-value">${play.metadata.situation}</span>
          </div>
        ` : ''}
        
        ${play.metadata?.yardage ? `
          <div class="metadata-item">
            <span class="metadata-label">Expected Yardage:</span>
            <span class="metadata-value">${play.metadata.yardage}</span>
          </div>
        ` : ''}
        
        ${play.metadata?.personnel ? `
          <div class="metadata-item">
            <span class="metadata-label">Personnel:</span>
            <span class="metadata-value">${play.metadata.personnel}</span>
          </div>
        ` : ''}
        
        ${play.metadata?.difficulty ? `
          <div class="metadata-item">
            <span class="metadata-label">Difficulty:</span>
            <span class="metadata-value">${play.metadata.difficulty}</span>
          </div>
        ` : ''}
        
        <div class="metadata-item">
          <span class="metadata-label">Created:</span>
          <span class="metadata-value">${new Date(play.created_at).toLocaleDateString()}</span>
        </div>
        
        ${play.metadata?.tags && play.metadata.tags.length > 0 ? `
          <div class="metadata-item">
            <span class="metadata-label">Tags:</span>
            <span class="metadata-value">${play.metadata.tags.join(', ')}</span>
          </div>
        ` : ''}
      </div>
    </div>
    
    ${play.description || play.metadata?.description ? `
      <div class="description-section">
        <div class="description-title">Description & Notes</div>
        <div class="description-text">${(play.description || play.metadata?.description || '').replace(/\n/g, '<br>')}</div>
      </div>
    ` : ''}
  </div>
</body>
</html>`;
  };

  const generateGridPlaybookHTML = (plays: PlayInPlaybook[], playbookName: string): string => {
    const playItems = plays.map(play => `
      <div class="grid-item">
        <div class="grid-play-name">${play.name}</div>
        <div class="grid-play-image">
          ${play.thumbnail ? 
            `<img src="${play.thumbnail}" alt="${play.name}" />` :
            `<div class="no-image">No Image</div>`
          }
        </div>
        <div class="grid-play-info">
          <div class="play-type">${play.type}</div>
          ${play.metadata?.formation ? `<div>Formation: ${play.metadata.formation}</div>` : ''}
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${playbookName} - Grid View</title>
  <style>
    @page {
      size: ${paperPageSize(prefs?.paper_size ?? 'letter')};
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
    
    .header {
      text-align: center;
      margin-bottom: 25px;
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
      text-align: center;
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
    
    .no-image {
      color: #9ca3af;
      font-size: 8pt;
    }
    
    .grid-play-info {
      font-size: 8pt;
      color: #6b7280;
      line-height: 1.3;
    }
    
    .grid-play-info div {
      margin-bottom: 2px;
    }
    
    .play-type {
      text-transform: capitalize;
      font-weight: 500;
    }
    
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .grid-item { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${teamBrandHTML(prefs)}
    <div class="playbook-title">${playbookName}</div>
    <div class="playbook-subtitle">Complete Playbook Grid</div>
  </div>
  
  <div class="plays-grid">
    ${playItems}
  </div>
  
  <div class="footer">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Total Plays: ${plays.length}
  </div>
</body>
</html>`;
  };

  const generateWristbandPlaybookHTML = (plays: PlayInPlaybook[], playbookName: string): string => {
    const cards = plays.map((play, index) => `
      <div class="wb-card">
        <div class="wb-number">${index + 1}</div>
        <div class="wb-body">
          <div class="wb-name">${play.name}</div>
          <div class="wb-image">
            ${play.thumbnail ?
              `<img src="${play.thumbnail}" alt="${play.name}" />` :
              `<div class="no-image">No Image</div>`
            }
          </div>
          <div class="wb-info">
            <span class="play-type">${play.type}</span>
            ${play.metadata?.formation ? ` &middot; ${play.metadata.formation}` : ''}
          </div>
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${playbookName} - Wristband Call Sheet</title>
  <style>
    @page {
      size: ${paperPageSize(prefs?.paper_size ?? 'letter')};
      margin: 0.4in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 8pt;
      line-height: 1.2;
      color: #000;
      background: white;
    }

    .header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 3px solid #2563eb;
    }

    .playbook-title {
      font-size: 18pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .playbook-subtitle {
      font-size: 10pt;
      color: #64748b;
    }

    .wb-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .wb-card {
      display: flex;
      border: 1px dashed #9ca3af;
      border-radius: 4px;
      padding: 6px;
      background: #fafafa;
      page-break-inside: avoid;
      align-items: center;
    }

    .wb-number {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1e40af;
      color: white;
      font-weight: bold;
      font-size: 10pt;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6px;
    }

    .wb-body {
      flex: 1;
      min-width: 0;
    }

    .wb-name {
      font-weight: bold;
      color: #1e40af;
      font-size: 8pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .wb-image {
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 3px;
      margin: 3px 0;
    }

    .wb-image img {
      max-width: 100%;
      max-height: 100%;
    }

    .no-image {
      color: #9ca3af;
      font-size: 7pt;
    }

    .wb-info {
      font-size: 7pt;
      color: #6b7280;
    }

    .play-type {
      text-transform: capitalize;
      font-weight: 500;
    }

    .footer {
      margin-top: 15px;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .wb-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${teamBrandHTML(prefs)}
    <div class="playbook-title">${playbookName}</div>
    <div class="playbook-subtitle">Wristband Call Sheet &mdash; cut along dashed lines</div>
  </div>

  <div class="wb-grid">
    ${cards}
  </div>

  <div class="footer">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Total Plays: ${plays.length}
  </div>
</body>
</html>`;
  };

  const handleExportPDF = async (format: 'simple' | 'detailed' | 'grid' | 'wristband') => {
    if (!selectedPlaybook || playsInPlaybook.length === 0) {
      alert('Please select a playbook with plays to export.');
      return;
    }

    if (!entitlementLoading && !isPro) {
      setShowExportMenu(false);
      setShowUpgradePrompt(true);
      return;
    }

    try {
      let htmlContent = '';

      if (format === 'wristband') {
        htmlContent = generateWristbandPlaybookHTML(playsInPlaybook, selectedPlaybook.name);
      } else if (format === 'grid') {
        htmlContent = generateGridPlaybookHTML(playsInPlaybook, selectedPlaybook.name);
      } else {
        // For simple and detailed, create multiple pages
        const pageContents = playsInPlaybook.map(play => 
          format === 'simple' ? generateSimplePlayHTML(play) : generateDetailedPlayHTML(play)
        );
        
        // Combine all pages into one document
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${selectedPlaybook.name}</title>
  <style>
    @page {
      size: ${paperPageSize(prefs?.paper_size ?? 'letter')};
      margin: 0.75in;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  ${pageContents.map((content, index) => {
    // Extract body content from each page
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : content;
    return index === 0 ? bodyContent : `<div class="page-break">${bodyContent}</div>`;
  }).join('')}
</body>
</html>`;
      }

      // Open print window
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

      setShowExportMenu(false);

    } catch (error) {
      console.error('Export error:', error);
      alert('There was an error generating the PDF. Please try again.');
    }
  };

  const filteredPlaybooks = playbooks.filter(playbook =>
    playbook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    playbook.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-chalk mb-4">Sign In Required</h2>
          <p className="text-chalk/70 mb-6">Please sign in to view your playbooks.</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-chalk flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                My Playbooks
              </h1>
              <p className="text-chalk/70 mt-2">
                Organize and manage your football plays
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleNewPlay}
                className="flex items-center gap-2 px-4 py-2 bg-board-light hover:bg-board text-chalk border border-chalk/20 rounded-lg transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                New Play
              </button>
              <button
                onClick={() => { setCreatePlaybookError(null); setShowCreateModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Playbook
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Playbooks List */}
          <div className="lg:col-span-1">
            <div className="bg-board-light rounded-xl border border-chalk/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-chalk">Playbooks</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-chalk/70 hover:text-chalk'}`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary text-white' : 'text-chalk/70 hover:text-chalk'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-chalk/50" />
                <input
                  type="text"
                  placeholder="Search playbooks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-board border border-chalk/20 rounded-lg text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Playbooks */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="text-chalk/70">Loading playbooks...</div>
                  </div>
                ) : filteredPlaybooks.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-chalk/30 mx-auto mb-3" />
                    <p className="text-chalk/70 mb-4">No playbooks found</p>
                    <button
                      onClick={() => { setCreatePlaybookError(null); setShowCreateModal(true); }}
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      Create your first playbook
                    </button>
                  </div>
                ) : (
                  filteredPlaybooks.map((playbook) => (
                    <div
                      key={playbook.id}
                      onClick={() => handlePlaybookSelect(playbook)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedPlaybook?.id === playbook.id
                          ? 'border-primary bg-primary/10'
                          : 'border-chalk/10 bg-board hover:bg-board-light'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-chalk">{playbook.name}</h3>
                          {playbook.description && (
                            <p className="text-sm text-chalk/70 mt-1 line-clamp-2">
                              {playbook.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-chalk/50">
                            <span className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {playbook.play_count} plays
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(playbook.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlaybook(playbook);
                          }}
                          className="shrink-0 p-2 text-chalk/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Delete playbook"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Plays in Selected Playbook */}
          <div className="lg:col-span-2">
            <div className="bg-board-light rounded-xl border border-chalk/10 p-6">
              {selectedPlaybook ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-chalk">
                        {selectedPlaybook.name}
                      </h2>
                      <p className="text-chalk/70 text-sm">
                        {playsInPlaybook.length} plays in this playbook
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Export Dropdown */}
                      {playsInPlaybook.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center gap-2 px-3 py-2 bg-board-light hover:bg-board text-chalk border border-chalk/20 rounded-lg text-sm transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Export PDF
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          
                          {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-board-light border border-chalk/20 rounded-lg shadow-xl z-10">
                              <div className="py-2">
                                {/* The user's default export style (B-15) sorts first */}
                                {[
                                  { style: 'simple' as const, icon: FileText, label: 'Simple (1 per page)', hint: 'Play name + diagram only' },
                                  { style: 'detailed' as const, icon: BookOpen, label: 'Detailed (1 per page)', hint: 'Full metadata + diagram' },
                                  { style: 'grid' as const, icon: LayoutGrid, label: 'Grid (all on one page)', hint: 'Compact grid layout' },
                                ]
                                  .sort((a, b) => Number(b.style === (prefs?.default_export_style ?? 'detailed')) - Number(a.style === (prefs?.default_export_style ?? 'detailed')))
                                  .map(({ style, icon: Icon, label, hint }) => (
                                    <button
                                      key={style}
                                      onClick={() => handleExportPDF(style)}
                                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-chalk hover:bg-board transition-colors"
                                    >
                                      <Icon className="h-4 w-4 text-primary" />
                                      <div className="flex-1">
                                        <div className="font-medium flex items-center gap-2">
                                          {label}
                                          {style === (prefs?.default_export_style ?? 'detailed') && (
                                            <span className="text-xs text-chalk/40">Default</span>
                                          )}
                                          {!entitlementLoading && !isPro && (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                              <Lock className="h-3 w-3" /> Pro
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-chalk/70">{hint}</div>
                                      </div>
                                    </button>
                                  ))}
                                <div className="my-1 border-t border-chalk/10" />
                                <button
                                  onClick={() => handleExportPDF('wristband')}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-chalk hover:bg-board transition-colors"
                                >
                                  <Watch className="h-4 w-4 text-primary" />
                                  <div className="flex-1">
                                    <div className="font-medium flex items-center gap-2">
                                      Wristband Sheet
                                      {!entitlementLoading && !isPro && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                          <Lock className="h-3 w-3" /> Pro
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-chalk/70">Numbered call sheet, cut for a wristband</div>
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleNewPlay}
                        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Play
                      </button>
                    </div>
                  </div>

                  {/* Plays Grid */}
                  {playsInPlaybook.length === 0 ? (
                    <div className="text-center py-12">
                      <Play className="h-16 w-16 text-chalk/30 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-chalk mb-2">
                        No plays in this playbook
                      </h3>
                      <p className="text-chalk/70 mb-6">
                        Start building your playbook by creating your first play
                      </p>
                      <button
                        onClick={handleNewPlay}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                      >
                        Create First Play
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {playsInPlaybook.map((play) => (
                        <div
                          key={play.id}
                          className="bg-board rounded-lg border border-chalk/10 overflow-hidden hover:border-chalk/20 transition-colors group"
                        >
                          {/* Play Thumbnail */}
                          <div className="aspect-video bg-white border-b border-chalk/10 relative">
                            {play.thumbnail ? (
                              <img
                                src={play.thumbnail}
                                alt={play.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-chalk/30">
                                <Play className="h-8 w-8" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={() => handleEditPlay(play.id)}
                                className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium"
                              >
                                Edit Play
                              </button>
                            </div>
                          </div>

                          {/* Play Info */}
                          <div className="p-4">
                            <h3 className="font-medium text-chalk mb-1 line-clamp-1">
                              {play.name}
                            </h3>
                            {play.description && (
                              <p className="text-sm text-chalk/70 line-clamp-2 mb-2">
                                {play.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-chalk/50">
                              <span className="capitalize">{play.type}</span>
                              <span>{new Date(play.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-chalk/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-chalk mb-2">
                    Select a playbook
                  </h3>
                  <p className="text-chalk/70">
                    Choose a playbook from the left to view its plays
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Playbook Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
              <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={() => setShowCreateModal(false)} />
              <div className="inline-block w-full max-w-md overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
                  <h3 className="text-lg font-bold text-chalk">Create New Playbook</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-chalk/70 hover:text-chalk transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {createPlaybookError && (
                    <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                      {createPlaybookError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-chalk mb-2">
                      Playbook Name *
                    </label>
                    <input
                      type="text"
                      value={newPlaybookName}
                      onChange={(e) => setNewPlaybookName(e.target.value)}
                      placeholder="e.g., Offense 2024, Red Zone Plays..."
                      className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-chalk mb-2">
                      Description
                    </label>
                    <textarea
                      value={newPlaybookDescription}
                      onChange={(e) => setNewPlaybookDescription(e.target.value)}
                      placeholder="Optional description for this playbook..."
                      rows={3}
                      className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-chalk/10 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createPlaybook}
                    disabled={!newPlaybookName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Playbook
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Click outside to close export menu */}
        {showExportMenu && (
          <div
            className="fixed inset-0 z-5"
            onClick={() => setShowExportMenu(false)}
          />
        )}
      </div>
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Playbook PDF export"
        description="Exporting a full playbook to PDF is part of Playbuilder Pro ($39/yr). You can still export any single play for free from the Play Designer."
      />
    </div>
  );
}
