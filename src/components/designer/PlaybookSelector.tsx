import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Book, Plus, Folder, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { CreatePlaybookModal } from './CreatePlaybookModal';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Playbook {
  id: string;
  name: string;
  description: string;
}

interface Play {
  id: string;
  name: string;
  type: 'offense' | 'defense';
  formation_id: string;
  canvas_data: string;
  description: string;
}

interface PlaybookSelectorProps {
  onPlaySelected: (play: Play) => void;
}

export function PlaybookSelector({ onPlaySelected }: PlaybookSelectorProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [plays, setPlays] = useState<Record<string, Play[]>>({});
  const [expandedPlaybooks, setExpandedPlaybooks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeletePlayConfirm, setShowDeletePlayConfirm] = useState<{playbookId: string; playId: string} | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      return null;
    }).catch(console.error);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPlaybooks = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('playbooks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        
        setPlaybooks(data || []);
        
        // Initialize expanded state
        const expanded: Record<string, boolean> = {};
        data?.forEach(playbook => {
          expanded[playbook.id] = false;
        });
        setExpandedPlaybooks(expanded);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load playbooks');
        console.error('Error loading playbooks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaybooks();
  }, [user]);

  const togglePlaybook = async (playbookId: string) => {
    const newExpandedState = !expandedPlaybooks[playbookId];
    
    setExpandedPlaybooks({
      ...expandedPlaybooks,
      [playbookId]: newExpandedState
    });
    
    if (newExpandedState && !plays[playbookId]) {
      try {
        const { data, error: fetchError } = await supabase
          .from('playbook_plays')
          .select('*, plays(*)')
          .eq('playbook_id', playbookId)
          .order('order_position', { ascending: true });

        if (fetchError) throw fetchError;
        
        // Map and type the response data
        const playData: Play[] = [];
        
        if (data) {
          data.forEach(item => {
            if (item.plays) {
              playData.push({
                id: item.plays.id,
                name: item.plays.name,
                type: item.plays.type,
                formation_id: item.plays.formation_id,
                canvas_data: item.plays.canvas_data,
                description: item.plays.description
              });
            }
          });
        }
        setPlays(prev => ({
          ...prev,
          [playbookId]: playData
        }));
      } catch (err) {
        console.error('Error loading plays:', err);
      }
    }
  };

  const handleCreatePlaybook = async (name: string, description: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('playbooks')
        .insert([
          {
            name,
            description,
            user_id: user.id
          }
        ])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPlaybooks([...playbooks, data[0]]);
        setExpandedPlaybooks({
          ...expandedPlaybooks,
          [data[0].id]: false
        });
      }
      
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating playbook:', err);
    }
  };

  const handleDeletePlaybook = async (playbookId: string) => {
    try {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', playbookId);

      if (error) throw error;

      setPlaybooks(playbooks.filter(p => p.id !== playbookId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting playbook:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete playbook');
    }
  };

  const handleDeletePlay = async (playbookId: string, playId: string) => {
    try {
      const { error } = await supabase
        .from('playbook_plays')
        .delete()
        .eq('playbook_id', playbookId)
        .eq('play_id', playId);

      if (error) throw error;

      // Update local state
      setPlays(prevPlays => ({
        ...prevPlays,
        [playbookId]: prevPlays[playbookId].filter(p => p.id !== playId)
      }));

      setShowDeletePlayConfirm(null);
    } catch (err) {
      console.error('Error deleting play:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete play');
    }
  };

  if (loading) {
    return (
      <div className="bg-board rounded-lg border border-chalk/10 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-chalk/10 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-chalk/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-board rounded-lg border border-chalk/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-chalk flex items-center gap-2">
          <Book className="h-5 w-5 text-primary" />
          My Playbooks
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-2 text-primary hover:text-primary-dark hover:bg-board-light rounded-md transition-colors"
          title="Create New Playbook"
          disabled={!user}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : !user ? (
        <p className="text-chalk/70 text-sm">Sign in to create and manage playbooks.</p>
      ) : playbooks.length === 0 ? (
        <p className="text-chalk/70 text-sm">No playbooks found. Create one to get started!</p>
      ) : (
        <div className="space-y-2">
          {playbooks.map((playbook) => (
            <div key={playbook.id} className="border border-chalk/10 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-board-light flex items-center justify-between">
                <button
                  onClick={() => togglePlaybook(playbook.id)}
                  className="flex items-center gap-2 text-chalk hover:text-chalk/80 transition-colors"
                >
                  <Folder className="h-4 w-4 text-primary" />
                  <span>{playbook.name}</span>
                  {expandedPlaybooks[playbook.id] ? (
                    <ChevronDown className="h-4 w-4 text-chalk/50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-chalk/50" />
                  )}
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirm(playbook.id)}
                  className="p-1 text-chalk/50 hover:text-red-500 transition-colors"
                  title="Delete Playbook"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              
              {expandedPlaybooks[playbook.id] && (
                <div className="bg-board p-2 space-y-1">
                  {plays[playbook.id]?.length > 0 ? (
                    plays[playbook.id].map((play) => (
                      <div key={play.id} className="flex items-center justify-between group">
                        <button
                          onClick={() => onPlaySelected(play)}
                          className="flex-1 px-3 py-2 text-left text-sm rounded-md text-chalk/70 hover:text-chalk hover:bg-board-light transition-colors"
                        >
                          {play.name}
                        </button>
                        <button
                          onClick={() => setShowDeletePlayConfirm({ playbookId: playbook.id, playId: play.id })}
                          className="p-1 opacity-0 group-hover:opacity-100 text-chalk/50 hover:text-red-500 transition-all"
                          title="Remove from Playbook"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-chalk/50 text-sm px-3 py-2">No plays in this playbook</p>
                  )}
                </div>
              )}

              {showDeleteConfirm === playbook.id && (
                <div className="p-4 bg-board border-t border-chalk/10">
                  <p className="text-chalk/70 text-sm mb-4">
                    Are you sure you want to delete "{playbook.name}"? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 text-sm text-chalk/70 hover:text-chalk transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeletePlaybook(playbook.id)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {showDeletePlayConfirm?.playbookId === playbook.id && (
                <div className="p-4 bg-board border-t border-chalk/10">
                  <p className="text-chalk/70 text-sm mb-4">
                    Remove this play from the playbook? The play will still be available in your library.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowDeletePlayConfirm(null)}
                      className="px-3 py-1 text-sm text-chalk/70 hover:text-chalk transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeletePlay(showDeletePlayConfirm.playbookId, showDeletePlayConfirm.playId)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreatePlaybookModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePlaybook}
      />
    </div>
  );
}