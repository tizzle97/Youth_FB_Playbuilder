import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Save, Download, Layout, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DesignerToolbar } from './DesignerToolbar';
import { ExportModal } from './ExportModal';
import { Canvas } from './Canvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabase';
import { PlayMetadata } from '../../types/play';
import { SavePlayModal } from './SavePlayModal';
import { BookOpen } from 'lucide-react';

interface PlayData {
  metadata: PlayMetadata;
  canvasDataURL: string;
}

export function PlayDesigner() {
  const [searchParams] = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [drawingMode, setDrawingMode] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ letter: string; color: string; isSquare?: boolean } | null>(null);
  const [playType, setPlayType] = useState<'offense' | 'defense' | 'special_teams'>('offense');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [capturedThumbnail, setCapturedThumbnail] = useState<string>('');
  const [user, setUser] = useState(null);
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [isEditingExistingPlay, setIsEditingExistingPlay] = useState(false);
  const navigate = useNavigate();

  const [currentPlayMetadata, setCurrentPlayMetadata] = useState<PlayMetadata>({
    playName: 'New Play',
    gameType: '11v11',
    playType: 'pass',
    formation: '',
    difficulty: 'intermediate',
    tags: [],
    description: '',
    situation: '',
    yardage: '',
    createdBy: '',
    createdDate: new Date().toISOString(),
    personnel: ''
  });

  const [savedPlays, setSavedPlays] = useState<PlayData[]>([]);

  const getAllPlays = (): PlayData[] => {
    if (savedPlays.length > 0) {
      return savedPlays;
    }
    
    const canvas = document.getElementById('play-canvas') as HTMLCanvasElement;
    if (canvas && currentPlayMetadata.playName) {
      const canvasDataURL = canvas.toDataURL('image/png', 1.0);
      return [{
        metadata: currentPlayMetadata,
        canvasDataURL
      }];
    }
    
    return [];
  };

  const loadSavedPlays = async () => {
  if (!user) return;
  
  try {
    console.log('🔄 Loading saved plays for user:', user.id);
    
    const { data: plays, error } = await supabase
      .from('plays')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading plays:', error);
      throw error;
    }

    console.log('📊 Loaded plays count:', plays?.length || 0);
    console.log('📋 Play IDs:', plays?.map(p => ({ id: p.id, name: p.name })) || []);

    // Also check playbook links
    const { data: playbookLinks, error: linkError } = await supabase
      .from('playbook_plays')
      .select(`
        *,
        plays!inner(*),
        playbooks!inner(*)
      `)
      .eq('playbooks.user_id', user.id);

    if (linkError) {
      console.error('❌ Error loading playbook links:', linkError);
    } else {
      console.log('🔗 Playbook links count:', playbookLinks?.length || 0);
      console.log('📚 Linked plays:', playbookLinks?.map(link => ({
        playbook: link.playbooks.name,
        play: link.plays.name,
        playId: link.play_id,
        playbookId: link.playbook_id
      })) || []);
    }

    const playData: PlayData[] = plays.map(play => ({
      metadata: {
        playName: play.name,
        formation: play.metadata?.formation || '',
        situation: play.metadata?.situation || '',
        yardage: play.metadata?.yardage || '',
        description: play.description || play.metadata?.description || '',
        tags: play.metadata?.tags || [],
        createdBy: user.email || 'Coach',
        createdDate: play.created_at,
        difficulty: play.metadata?.difficulty || 'Intermediate',
        playType: play.metadata?.playType || 'Pass',
        personnel: play.metadata?.personnel || ''
      },
      canvasDataURL: play.thumbnail || ''
    }));

    setSavedPlays(playData);
    console.log('✅ Successfully loaded and set saved plays');
    
  } catch (error) {
    console.error('❌ Error in loadSavedPlays:', error);
  }
};

  useEffect(() => {
    const playId = searchParams.get('play');
    if (playId && user) {
      loadExistingPlay(playId);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (user) {
      loadSavedPlays();
      setCurrentPlayMetadata(prev => ({
        ...prev,
        createdBy: user.email || 'Coach'
      }));
    }
  }, [user]);

  const loadExistingPlay = async (playId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: play, error: playError } = await supabase
        .from('plays')
        .select('*')
        .eq('id', playId)
        .eq('user_id', user.id)
        .single();

      if (playError) throw playError;

      setPlayType(play.type);
      setCurrentPlayId(play.id);
      setIsEditingExistingPlay(true);

      setCurrentPlayMetadata({
        playName: play.name,
        formation: play.metadata?.formation || '',
        situation: play.metadata?.situation || '',
        yardage: play.metadata?.yardage || '',
        description: play.description || play.metadata?.description || '',
        tags: play.metadata?.tags || [],
        createdBy: user.email || 'Coach',
        createdDate: play.created_at,
        difficulty: play.metadata?.difficulty || 'Intermediate',
        playType: play.metadata?.playType || 'Pass',
        personnel: play.metadata?.personnel || ''
      });

      if (play.canvas_data) {
        const canvasData = JSON.parse(play.canvas_data);
        if (canvasRef.current) {
          canvasRef.current.loadState(canvasData);
        }
      }

    } catch (err) {
      console.error('Error loading play:', err);
      setError('Failed to load play. Play may not exist or you may not have permission to edit it.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const updateCanvasSize = () => {
      const containerWidth = canvasContainerRef.current?.offsetWidth ?? 0;
      setCanvasSize({
        width: containerWidth,
        height: containerWidth * 0.75
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const handleUndo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (canvasRef.current) {
      canvasRef.current.redo();
    }
  };

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
  };

  const handleClearRoutes = () => {
    if (canvasRef.current) {
      canvasRef.current.clearRoutes();
    }
  };

  const captureCanvasThumbnail = useCallback((): Promise<string> => {
  return new Promise((resolve) => {
    console.log('📷 Starting canvas thumbnail capture...');
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        // Try multiple canvas selectors
        let canvas = document.querySelector('#play-canvas') as HTMLCanvasElement;
        
        if (!canvas) {
          // Try alternative selector
          canvas = document.querySelector('canvas') as HTMLCanvasElement;
        }
        
        if (!canvas) {
          // Try getting canvas from ref
          canvas = canvasRef.current?.canvasRef?.current;
        }
        
        if (!canvas) {
          console.error('❌ Canvas element not found with any method');
          console.log('Available canvas elements:', document.querySelectorAll('canvas'));
          resolve('');
          return;
        }

        try {
          console.log('🖼️ Canvas found:', {
            width: canvas.width,
            height: canvas.height,
            hasContext: !!canvas.getContext('2d'),
            id: canvas.id,
            selector: canvas.id ? `#${canvas.id}` : 'no id'
          });

          const thumbnailCanvas = document.createElement('canvas');
          const thumbnailCtx = thumbnailCanvas.getContext('2d');
          
          if (!thumbnailCtx) {
            console.error('❌ Could not get thumbnail context');
            resolve('');
            return;
          }

          const thumbnailWidth = 400;
          const thumbnailHeight = 300;
          thumbnailCanvas.width = thumbnailWidth;
          thumbnailCanvas.height = thumbnailHeight;

          thumbnailCtx.fillStyle = '#FFFFFF';
          thumbnailCtx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);

          thumbnailCtx.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            0, 0, thumbnailWidth, thumbnailHeight
          );

          const dataUrl = thumbnailCanvas.toDataURL('image/png', 0.9);
          
          console.log('📊 Thumbnail stats:', {
            dataUrlLength: dataUrl.length,
            sizeKB: Math.round(dataUrl.length * 0.75 / 1024),
            startsWithPNG: dataUrl.startsWith('data:image/png')
          });

          if (dataUrl.startsWith('data:image/') && dataUrl.length > 1000) {
            console.log('✅ Thumbnail captured successfully');
            resolve(dataUrl);
          } else {
            console.error('❌ Thumbnail appears invalid or too small');
            resolve('');
          }

        } catch (error) {
          console.error('❌ Canvas capture error:', error);
          resolve('');
        }
      }, 100);
    });
  });
}, []);

  const handleSave = async () => {
    console.log('🎯 Save button clicked - capturing thumbnail...');
    
    if (!user) {
      navigate('/auth');
      return;
    }

    const thumbnail = await captureCanvasThumbnail();
    
    if (thumbnail && thumbnail.length > 1000) {
      console.log('✅ Thumbnail captured successfully:', thumbnail.length, 'chars');
      setCapturedThumbnail(thumbnail);
    } else {
      console.warn('⚠️ Thumbnail capture failed, proceeding without thumbnail');
      setCapturedThumbnail('');
    }
    
    setShowSaveModal(true);
  };

  // Replace the handleSaveWithMetadata function in PlayDesigner.tsx with this fixed version:

const handleSaveWithMetadata = async (playData: {
  name: string;
  metadata: PlayMetadata;
  isPublic: boolean;
  playbookId?: string;
}) => {
  try {
    setSaving(true);
    setError(null);

    console.log('💾 Saving play with metadata...');
    console.log('🎯 Selected playbook ID:', playData.playbookId); // Debug log

    // Get current canvas state
    const canvasData = JSON.stringify({
      paths: canvasRef.current?.getPaths() || [],
      icons: canvasRef.current?.getIcons() || []
    });

    const playPayload = {
      name: playData.name,
      type: playType,
      canvas_data: canvasData,
      thumbnail: capturedThumbnail || null,
      metadata: playData.metadata,
      description: playData.metadata.description,
      user_id: user.id,
      is_public: playData.isPublic,
      updated_at: new Date().toISOString()
    };

    let savedPlay;

    if (isEditingExistingPlay && currentPlayId) {
      // Update existing play
      console.log('📝 Updating existing play:', currentPlayId);
      const { data: play, error: playError } = await supabase
        .from('plays')
        .update(playPayload)
        .eq('id', currentPlayId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (playError) {
        console.error('❌ Error updating play:', playError);
        throw playError;
      }
      savedPlay = play;
      console.log('✅ Play updated successfully:', play.id);
      
    } else {
      // Create new play
      console.log('➕ Creating new play...');
      const { data: play, error: playError } = await supabase
        .from('plays')
        .insert([{
          ...playPayload,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (playError) {
        console.error('❌ Error creating play:', playError);
        throw playError;
      }
      savedPlay = play;
      
      setCurrentPlayId(play.id);
      setIsEditingExistingPlay(true);
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('play', play.id);
      window.history.replaceState({}, '', newUrl.toString());
      
      console.log('✅ New play created:', play.id);
    }

    // 🎯 ENHANCED: Handle playbook addition with better error handling
    if (playData.playbookId && savedPlay) {
      console.log('📚 Adding play to playbook:', playData.playbookId);
      
      try {
        // First, verify the playbook exists and user owns it
        const { data: playbook, error: playbookError } = await supabase
          .from('playbooks')
          .select('id, name')
          .eq('id', playData.playbookId)
          .eq('user_id', user.id)
          .single();

        if (playbookError) {
          console.error('❌ Playbook verification failed:', playbookError);
          throw new Error('Playbook not found or access denied');
        }

        console.log('✅ Playbook verified:', playbook.name);

        // Check if play is already in this playbook
        const { data: existingLink, error: linkCheckError } = await supabase
          .from('playbook_plays')
          .select('id')
          .eq('playbook_id', playData.playbookId)
          .eq('play_id', savedPlay.id)
          .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

        if (linkCheckError) {
          console.error('❌ Error checking existing link:', linkCheckError);
          throw linkCheckError;
        }

        if (existingLink) {
          console.log('ℹ️ Play already in playbook, skipping link creation');
        } else {
          // Get the next order position
          const { data: maxOrderData, error: orderError } = await supabase
            .from('playbook_plays')
            .select('order_position')
            .eq('playbook_id', playData.playbookId)
            .order('order_position', { ascending: false })
            .limit(1);

          if (orderError && !orderError.message.includes('JSON object requested')) {
            console.error('❌ Error getting max order:', orderError);
            throw orderError;
          }

          const nextOrder = maxOrderData && maxOrderData.length > 0 
            ? maxOrderData[0].order_position + 1 
            : 1;

          console.log('📊 Next order position:', nextOrder);

          // Insert the playbook-play link
          const { data: linkData, error: linkError } = await supabase
            .from('playbook_plays')
            .insert([
              {
                playbook_id: playData.playbookId,
                play_id: savedPlay.id,
                order_position: nextOrder
              }
            ])
            .select()
            .single();

          if (linkError) {
            console.error('❌ Error creating playbook link:', linkError);
            console.error('Link data attempted:', {
              playbook_id: playData.playbookId,
              play_id: savedPlay.id,
              order_position: nextOrder
            });
            throw new Error(`Failed to add play to playbook: ${linkError.message}`);
          }

          console.log('✅ Play successfully linked to playbook:', linkData);
        }
      } catch (playbookError) {
        console.error('❌ Playbook linking failed:', playbookError);
        // Don't throw here - the play was saved successfully, just the playbook link failed
        setError(`Play saved but failed to add to playbook: ${playbookError.message}`);
      }
    }

    const successMessage = isEditingExistingPlay 
      ? `Play updated successfully${playData.playbookId ? ' and added to playbook' : ''}!`
      : `Play saved successfully${playData.playbookId ? ' and added to playbook' : ''}!`;
    
    setSuccess(successMessage);
    setTimeout(() => setSuccess(null), 3000);

    setCapturedThumbnail('');
    setShowSaveModal(false);
    
    // Reload saved plays to refresh the UI
    await loadSavedPlays();

  } catch (err) {
    console.error('❌ Save error:', err);
    setError(err instanceof Error ? err.message : 'Failed to save play');
  } finally {
    setSaving(false);
  }
};

  const handleNewPlay = () => {
    setCurrentPlayId(null);
    setIsEditingExistingPlay(false);
    setPlayType('offense');
    
    setCurrentPlayMetadata({
      playName: 'New Play',
      gameType: '11v11',
      playType: 'pass',
      formation: '',
      difficulty: 'intermediate',
      tags: [],
      description: '',
      situation: '',
      yardage: '',
      createdBy: user?.email || 'Coach',
      createdDate: new Date().toISOString(),
      personnel: ''
    });
    
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
    
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('play');
    window.history.replaceState({}, '', newUrl.toString());
    
    setSuccess('Started new play');
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleExportToPDF = async (format: 'single' | 'multiple' | 'wristband') => {
    try {
      const canvasElement = document.querySelector('#play-canvas') as HTMLCanvasElement;
      
      if (!canvasElement) {
        throw new Error('Canvas element not found');
      }

      const pdf = new jsPDF({
        orientation: format === 'wristband' ? 'landscape' : 'portrait',
        unit: 'mm',
      });
      
      const canvasImage = await html2canvas(canvasElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF'
      });
      
      const imgData = canvasImage.toDataURL('image/png');
      
      if (format === 'single') {
        pdf.setFontSize(20);
        pdf.text(currentPlayMetadata.playName || 'Untitled Play', 20, 20);
        pdf.addImage(imgData, 'PNG', 20, 30, 170, 170);
      } else if (format === 'multiple') {
        pdf.setFontSize(20);
        pdf.text(currentPlayMetadata.playName || 'Untitled Play', 20, 20);
        pdf.addImage(imgData, 'PNG', 20, 30, 170, 170);
      } else if (format === 'wristband') {
        pdf.setFontSize(10);
        pdf.text(currentPlayMetadata.playName || 'Untitled Play', 10, 10);
        pdf.addImage(imgData, 'PNG', 10, 15, 80, 80);
      }
      
      pdf.save(`${(currentPlayMetadata.playName || 'play').replace(/\s+/g, '_')}.pdf`);
      setShowExportModal(false);
      
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export play to PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <div className="text-chalk">Loading play...</div>
      </div>
    );
  return (
    <div className="min-h-screen bg-board flex items-center justify-center">
      <div className="text-chalk">Loading play...</div>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportToPDF}
        canvasRef={canvasRef}
        playMetadata={currentPlayMetadata}
        onUpdateMetadata={setCurrentPlayMetadata}
        userHasAccount={!!user}
        allPlays={savedPlays}
        onGetAllPlays={getAllPlays}
      />

      <SavePlayModal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setCapturedThumbnail('');
        }}
        onSave={handleSaveWithMetadata}
        user={user}
        previewThumbnail={capturedThumbnail}
        existingPlay={isEditingExistingPlay ? {
          id: currentPlayId!,
          name: '',
          type: playType,
          description: ''
        } : undefined}
      />
    </div>
  );
}