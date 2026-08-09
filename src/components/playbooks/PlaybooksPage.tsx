// PlaybooksPage.tsx - Enhanced with PDF Export Feature

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  Watch,
  GripVertical
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { FREE_LIMITS, isNearFreeLimit, rowIsPro } from '../../lib/entitlements';
import { UpgradePrompt } from '../UpgradePrompt';
import { UsageWarningBanner } from '../UsageWarningBanner';
import { getUserPreferences, paperPageSize, teamBrandHTML, type UserPreferences } from '../../lib/userPreferences';
import { usePageMeta } from '../../lib/seo';
import { PlaybookPackLibrary } from './PlaybookPackLibrary';
import { WRISTBAND_PRODUCT_NAME, WRISTBAND_PRODUCT_URL, WRISTBAND_WINDOW_SIZE, wristbandProductLink, SHOW_AFFILIATE_DISCLOSURE } from '../../lib/wristbandProducts';

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
  usePageMeta({ title: 'My Playbooks', description: 'Organize plays into playbooks and export game-day PDFs.', path: '/playbooks' });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab=packs shows the public starter playbook packs (B-33); default is your
  // own playbooks. Mirrors PlaysPage.tsx's ?tab=community pattern.
  const tab: 'mine' | 'packs' = searchParams.get('tab') === 'packs' ? 'packs' : 'mine';
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [playsInPlaybook, setPlaysInPlaybook] = useState<PlayInPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // Layout for the plays-inside-a-playbook panel specifically — separate
  // from the unrelated `viewMode` toggle above, which only affects the
  // left playbooks-list panel.
  const [playsLayout, setPlaysLayout] = useState<'grid' | 'list'>('grid');
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [newPlaybookName, setNewPlaybookName] = useState('');
  const [newPlaybookDescription, setNewPlaybookDescription] = useState('');
  const [createPlaybookError, setCreatePlaybookError] = useState<string | null>(null);

  // Single getUser() call on mount (B-23) — this used to be getSession() +
  // an onAuthStateChange subscription, plus a separate useEntitlement()
  // call below (its own getUser() + onAuthStateChange). Those concurrent
  // gotrue-js auth calls could deadlock gotrue's internal session lock —
  // the same class of bug as the B-4 note in BACKLOG.md, reproduced
  // consistently under React 18 StrictMode's dev-mode double-invoke. Now
  // matches PlaysPage.tsx's single-getUser()-call pattern.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // Pro status for the free-tier usage nudge (B-22) and export gating,
  // queried directly off `subscriptions` instead of via useEntitlement() —
  // see the mount effect's comment above.
  useEffect(() => {
    if (!user) { setIsPro(false); setEntitlementLoading(false); return; }
    let cancelled = false;
    supabase
      .from('subscriptions')
      .select('plan, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) { setIsPro(rowIsPro(data)); setEntitlementLoading(false); } });
    return () => { cancelled = true; };
  }, [user]);

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

      // playbook_plays(count) is PostgREST's aggregate-embed syntax: it always
      // returns a ONE-element array wrapping the aggregate object — e.g.
      // [{ count: 7 }] — never one element per play. `.length` was therefore
      // always 1 for any playbook with at least one play, regardless of how
      // many it actually had. See PlaybookPackLibrary.tsx for the same
      // pattern read correctly.
      const playbooksWithCount = playbooks.map(playbook => ({
        ...playbook,
        play_count: playbook.playbook_plays?.[0]?.count ?? 0
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

  // Remove one play from the currently selected playbook. Only deletes the
  // playbook_plays link row — the play itself stays in the user's library.
  const removePlayFromPlaybook = async (play: PlayInPlaybook) => {
    if (!selectedPlaybook) return;
    if (!confirm(`Remove "${play.name}" from "${selectedPlaybook.name}"? The play itself won't be deleted.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('playbook_plays')
        .delete()
        .eq('playbook_id', selectedPlaybook.id)
        .eq('play_id', play.id);

      if (error) throw error;

      setPlaysInPlaybook((prev) => prev.filter((p) => p.id !== play.id));
      setPlaybooks((prev) =>
        prev.map((pb) =>
          pb.id === selectedPlaybook.id ? { ...pb, play_count: Math.max(0, pb.play_count - 1) } : pb
        )
      );
    } catch (error) {
      console.error('Error removing play from playbook:', error);
      alert('Failed to remove play from playbook. Please try again.');
    }
  };

  // Writes `finalPositionOf(item)` to every item in `affected`, going through
  // a temporary-negative phase first so mid-permutation writes never collide
  // with another affected row's current order_position (UNIQUE(playbook_id,
  // order_position)). The temp values are unique per call (epoch-seconds
  // based), not small fixed numbers — see handleReorderPlays for why that
  // matters. Seconds, not Date.now()'s milliseconds: order_position is a
  // Postgres `integer` (max ~2.147e9) and epoch milliseconds (~1.8e12
  // today) overflows it instantly (22003 "out of range for type integer") —
  // epoch seconds (~1.8e9 today) comfortably fits until year 2038.
  const writeOrderPositions = async (
    affected: { play: PlayInPlaybook; position: number }[],
    playbookId: string,
    finalPositionOf: (item: { play: PlayInPlaybook; position: number }) => number
  ) => {
    const tempBase = -Math.floor(Date.now() / 1000);
    for (let i = 0; i < affected.length; i++) {
      const { error } = await supabase
        .from('playbook_plays')
        .update({ order_position: tempBase - i })
        .eq('playbook_id', playbookId)
        .eq('play_id', affected[i].play.id);
      if (error) throw error;
    }
    for (const item of affected) {
      const { error } = await supabase
        .from('playbook_plays')
        .update({ order_position: finalPositionOf(item) })
        .eq('playbook_id', playbookId)
        .eq('play_id', item.play.id);
      if (error) throw error;
    }
  };

  // Reorder plays within the selected playbook (List view drag-and-drop).
  const handleReorderPlays = async (oldIndex: number, newIndex: number) => {
    if (!selectedPlaybook || oldIndex === newIndex) return;

    const previous = playsInPlaybook;
    const reordered = arrayMove(previous, oldIndex, newIndex);
    setPlaysInPlaybook(reordered);

    const lo = Math.min(oldIndex, newIndex);
    const hi = Math.max(oldIndex, newIndex);
    // Reuse the same set of order_position values the affected slice already
    // held (just permuted onto different rows) so unaffected rows are never
    // touched and never collide with this write. `play` objects are shared
    // references with `previous`, so `play.order_position` still reads as
    // each row's own pre-drag value even after arrayMove — used below to
    // revert if the write fails partway.
    const targetPositions = previous.slice(lo, hi + 1).map((p) => p.order_position);
    const affected = reordered.slice(lo, hi + 1).map((play, i) => ({ play, position: targetPositions[i] }));

    try {
      await writeOrderPositions(affected, selectedPlaybook.id, (item) => item.position);
      // Sync each affected play's own order_position field to what's now in
      // the database. `reordered`/`previous` share object references (arrayMove
      // doesn't clone), so without this, every row's field stays frozen at its
      // pre-drag value forever — the NEXT reorder would then compute target
      // positions off stale data that no longer matches the database, easily
      // colliding with whatever row actually holds that value now.
      const newPositionByPlayId = new Map(affected.map((item) => [item.play.id, item.position]));
      setPlaysInPlaybook((current) =>
        current.map((play) => {
          const newPosition = newPositionByPlayId.get(play.id);
          return newPosition === undefined ? play : { ...play, order_position: newPosition };
        })
      );
    } catch (error) {
      console.error('Error reordering plays:', error);
      setPlaysInPlaybook(previous);
      // A failure here can leave rows sitting on their temporary negative
      // position (e.g. the final-position write is what failed) — every
      // later reorder attempt in this playbook would then collide with that
      // stranded row and fail immediately, even though its Phase A used a
      // fresh Date.now()-based temp value. Best-effort compensate by writing
      // each affected row back to its own original position.
      try {
        await writeOrderPositions(affected, selectedPlaybook.id, (item) => item.play.order_position);
      } catch (revertError) {
        console.error(
          'Failed to roll back playbook_plays after a failed reorder — a play may be stuck at an invalid ' +
            'position. Run supabase/fix_playbook_plays_positions.sql to repair it.',
          revertError
        );
      }
      alert('Failed to reorder plays. Please try again.');
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
    // 4.5in x 2.2in matches the play window on Wristband Interactive Y23-style
    // QB wristbands, which hold 3 cut inserts arranged as a 4x2 grid of
    // numbered plays (8 per insert) — same layout as the printed inserts
    // that ship with those wristbands.
    const PLAYS_PER_INSERT = 8;
    const INSERTS_PER_BAND = 3;

    const insertGroups: PlayInPlaybook[][] = [];
    for (let i = 0; i < plays.length; i += PLAYS_PER_INSERT) {
      insertGroups.push(plays.slice(i, i + PLAYS_PER_INSERT));
    }

    const inserts = insertGroups.map((group, groupIndex) => {
      const cells = group.map((play, i) => {
        const playNumber = groupIndex * PLAYS_PER_INSERT + i + 1;
        return `
        <div class="wb-cell">
          <div class="wb-cell-header">
            <div class="wb-number">${playNumber}</div>
            <div class="wb-name">${play.name}</div>
          </div>
          <div class="wb-thumb">
            ${play.thumbnail ?
              `<img src="${play.thumbnail}" alt="" />` :
              `<div class="no-image">&mdash;</div>`
            }
          </div>
        </div>`;
      }).join('');

      const bandNumber = Math.floor(groupIndex / INSERTS_PER_BAND) + 1;
      const slotNumber = (groupIndex % INSERTS_PER_BAND) + 1;

      return `
      <div class="wb-insert">
        <div class="wb-insert-label">Wristband ${bandNumber} &middot; Insert ${slotNumber} of ${INSERTS_PER_BAND}</div>
        <div class="wb-cells">${cells}</div>
      </div>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${playbookName} - Wristband Inserts</title>
  <style>
    @page {
      size: ${(prefs?.paper_size ?? 'letter') === 'a4' ? 'A4 landscape' : '11in 8.5in'};
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

    .header {
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

    .no-image {
      color: #9ca3af;
      font-size: 7pt;
    }

    .footer {
      margin-top: 0.15in;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 0.08in;
    }

    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .wb-insert { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${teamBrandHTML(prefs)}
    <div class="playbook-title">${playbookName}</div>
    <div class="playbook-subtitle">Wristband Inserts &mdash; sized for a 4.5" &times; 2.2" wristband window &mdash; cut along dashed lines</div>
    <div class="wb-compat">Compatible with ${WRISTBAND_PRODUCT_NAME} (${WRISTBAND_PRODUCT_URL}) and any wristband with a ${WRISTBAND_WINDOW_SIZE} play window.${SHOW_AFFILIATE_DISCLOSURE ? ' As an Amazon Associate we earn from qualifying purchases.' : ''}</div>
  </div>

  <div class="wb-grid">
    ${inserts}
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

  // My Playbooks requires sign-in; Starter Packs is public to browse (cloning
  // still requires sign-in + Pro, handled inside PlaybookPackLibrary).
  if (!user && tab === 'mine') {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-chalk mb-4">Sign In Required</h2>
          <p className="text-chalk/70 mb-6">Please sign in to view your playbooks.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Sign In
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'packs' }, { replace: true })}
              className="px-6 py-3 border border-chalk/20 text-chalk hover:bg-board rounded-lg transition-colors"
            >
              Browse Starter Packs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-chalk flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                {tab === 'packs' ? 'Starter Playbook Packs' : 'My Playbooks'}
              </h1>
              <p className="text-chalk/70 mt-2">
                {tab === 'packs'
                  ? 'Curated playbooks you can clone into your own account in one tap.'
                  : 'Organize and manage your football plays'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 border border-chalk/15 rounded-lg p-1">
                <button
                  onClick={() => setSearchParams({}, { replace: true })}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === 'mine' ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
                  }`}
                >
                  My Playbooks
                </button>
                <button
                  onClick={() => setSearchParams({ tab: 'packs' }, { replace: true })}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === 'packs' ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
                  }`}
                >
                  Starter Packs
                </button>
              </div>
              {tab === 'mine' && (
                <>
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
                </>
              )}
            </div>
          </div>
          {tab === 'mine' && !entitlementLoading && !isPro && isNearFreeLimit(playbooks.length, FREE_LIMITS.playbooks) && (
            <div className="mt-4">
              <UsageWarningBanner used={playbooks.length} limit={FREE_LIMITS.playbooks} label="playbooks" />
            </div>
          )}
        </div>

        {tab === 'packs' ? (
          <PlaybookPackLibrary user={user} isPro={isPro} />
        ) : (
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
                      {playsInPlaybook.length > 0 && (
                        <div className="flex items-center bg-board rounded-lg border border-chalk/10 p-0.5">
                          <button
                            onClick={() => setPlaysLayout('grid')}
                            title="Grid view"
                            aria-pressed={playsLayout === 'grid'}
                            className={`p-1.5 rounded-md transition-colors ${
                              playsLayout === 'grid' ? 'bg-primary/20 text-primary' : 'text-chalk/50 hover:text-chalk'
                            }`}
                          >
                            <Grid className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPlaysLayout('list')}
                            title="List view — drag to reorder"
                            aria-pressed={playsLayout === 'list'}
                            className={`p-1.5 rounded-md transition-colors ${
                              playsLayout === 'list' ? 'bg-primary/20 text-primary' : 'text-chalk/50 hover:text-chalk'
                            }`}
                          >
                            <List className="h-4 w-4" />
                          </button>
                        </div>
                      )}
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
                                    <div className="text-xs text-chalk/70">Sized for a 4.5"x2.2" QB wristband insert, cut and slide in</div>
                                  </div>
                                </button>
                                <div className="px-4 pt-1 pb-2" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-[10px] text-chalk/50 leading-snug">
                                    Compatible with{' '}
                                    <a
                                      href={wristbandProductLink()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:text-chalk/70"
                                    >
                                      {WRISTBAND_PRODUCT_NAME}
                                    </a>{' '}
                                    and any wristband with a {WRISTBAND_WINDOW_SIZE} play window.
                                    {SHOW_AFFILIATE_DISCLOSURE && ' As an Amazon Associate we earn from qualifying purchases.'}
                                  </p>
                                </div>
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
                  ) : playsLayout === 'grid' ? (
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
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-chalk/30">
                                <Play className="h-8 w-8" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditPlay(play.id)}
                                className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium"
                              >
                                Edit Play
                              </button>
                              <button
                                onClick={() => removePlayFromPlaybook(play)}
                                title="Remove from this playbook"
                                className="p-2 bg-white text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
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
                  ) : (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;
                        const oldIndex = playsInPlaybook.findIndex((p) => p.id === active.id);
                        const newIndex = playsInPlaybook.findIndex((p) => p.id === over.id);
                        if (oldIndex === -1 || newIndex === -1) return;
                        handleReorderPlays(oldIndex, newIndex);
                      }}
                    >
                      <SortableContext items={playsInPlaybook.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {playsInPlaybook.map((play) => (
                            <SortablePlayRow
                              key={play.id}
                              play={play}
                              onEdit={handleEditPlay}
                              onRemove={removePlayFromPlaybook}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
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
        )}

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

// One draggable row in the plays-in-playbook List view. Only the grip handle
// carries the drag listeners, so the Edit/Remove buttons never fight the
// drag sensor for a click. `touch-none` on the handle stops a touch-drag
// from also scrolling the page (same reason Canvas.tsx uses it).
function SortablePlayRow({
  play,
  onEdit,
  onRemove
}: {
  play: PlayInPlaybook;
  onEdit: (playId: string) => void;
  onRemove: (play: PlayInPlaybook) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: play.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-board rounded-lg border border-chalk/10 p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-1 text-chalk/40 hover:text-chalk cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
        aria-label={`Drag to reorder ${play.name}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="w-16 h-12 shrink-0 bg-white rounded border border-chalk/10 overflow-hidden">
        {play.thumbnail ? (
          <img
            src={play.thumbnail}
            alt={play.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-chalk/30">
            <Play className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-chalk truncate">{play.name}</h3>
        <p className="text-xs text-chalk/50 capitalize">{play.type.replace('_', ' ')}</p>
      </div>

      <button
        onClick={() => onEdit(play.id)}
        className="shrink-0 px-3 py-1.5 text-sm font-medium bg-board-light hover:bg-white/10 text-chalk border border-chalk/20 rounded-lg transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => onRemove(play)}
        title="Remove from this playbook"
        className="shrink-0 p-2 text-chalk/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
