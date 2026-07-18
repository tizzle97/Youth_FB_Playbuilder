// Create this file: src/components/plays/AddToPlaybookButton.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Book, Plus, Check, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Tallest the dropdown gets (header + max-h-60 list, see the JSX below).
// Used to decide whether it fits below the button or needs to open upward.
const DROPDOWN_MAX_HEIGHT_PX = 320;

// Playbook interface
interface Playbook {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface AddToPlaybookButtonProps {
  playId: string;
  playName: string;
  onSuccess?: () => void;
}

export const AddToPlaybookButton: React.FC<AddToPlaybookButtonProps> = ({ 
  playId, 
  playName, 
  onSuccess 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playInPlaybooks, setPlayInPlaybooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch user's playbooks when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchPlaybooks();
    }
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      // Flip upward when there isn't room below (e.g. bottom-row cards in a
      // grid) — otherwise the dropdown renders past the viewport edge and
      // becomes unreachable.
      const spaceBelow = window.innerHeight - containerRef.current.getBoundingClientRect().bottom;
      setOpenUpward(spaceBelow < DROPDOWN_MAX_HEIGHT_PX);
    }
    setIsOpen((prev) => !prev);
  };

  const dropdownPositionClass = openUpward ? 'bottom-full left-0 mb-2' : 'top-full left-0 mt-2';

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's playbooks
      const { data: playbooksData, error: playbooksError } = await supabase
        .from('playbooks')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (playbooksError) throw playbooksError;

      // Fetch which playbooks already contain this play
      const { data: playInPlaybooksData, error: playInPlaybooksError } = await supabase
        .from('playbook_plays')
        .select('playbook_id')
        .eq('play_id', playId);

      if (playInPlaybooksError) throw playInPlaybooksError;

      setPlaybooks(playbooksData || []);
      setPlayInPlaybooks(new Set(playInPlaybooksData?.map(p => p.playbook_id) || []));
    } catch (error) {
      console.error('Error fetching playbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPlayToPlaybook = async (playbookId: string) => {
    try {
      setActionLoading(playbookId);

      // Get the current max order position for this playbook
      const { data: existingPlays, error: countError } = await supabase
        .from('playbook_plays')
        .select('order_position')
        .eq('playbook_id', playbookId)
        .order('order_position', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const nextOrderPosition = existingPlays && existingPlays.length > 0 
        ? (existingPlays[0].order_position || 0) + 1 
        : 1;

      const { error } = await supabase
        .from('playbook_plays')
        .insert({
          playbook_id: playbookId,
          play_id: playId,
          order_position: nextOrderPosition
        });

      if (error) throw error;

      // Update local state
      setPlayInPlaybooks(prev => new Set(prev).add(playbookId));
      setJustAdded(prev => new Set(prev).add(playbookId));

      // Call success callback
      onSuccess?.();

      // Auto-close after showing success
      setTimeout(() => {
        setIsOpen(false);
        setJustAdded(new Set());
      }, 1500);

    } catch (error) {
      console.error('Error adding play to playbook:', error);
      // You might want to show a toast notification here
    } finally {
      setActionLoading(null);
    }
  };

  const removePlayFromPlaybook = async (playbookId: string) => {
    try {
      setActionLoading(playbookId);

      const { error } = await supabase
        .from('playbook_plays')
        .delete()
        .eq('playbook_id', playbookId)
        .eq('play_id', playId);

      if (error) throw error;

      // Update local state
      setPlayInPlaybooks(prev => {
        const newSet = new Set(prev);
        newSet.delete(playbookId);
        return newSet;
      });

      onSuccess?.();

    } catch (error) {
      console.error('Error removing play from playbook:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (playbooks.length === 0 && !loading && isOpen) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={toggleOpen}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
          title="Add to Playbook"
        >
          <Book className="w-4 h-4" />
          Add to Playbook
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <div className={`absolute ${dropdownPositionClass} w-64 bg-board-light border border-chalk/20 rounded-lg shadow-xl z-50`}>
              <div className="p-4 text-center">
                <Book className="w-8 h-8 text-chalk/50 mx-auto mb-2" />
                <p className="text-chalk/70 text-sm mb-3">No playbooks found</p>
                <button
                  onClick={() => {
                    // Navigate to create playbook or handle creation
                    console.log('Create new playbook');
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm rounded-lg transition-colors"
                >
                  Create Playbook
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
        title="Add to Playbook"
      >
        <Book className="w-4 h-4" />
        Add to Playbook
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className={`absolute ${dropdownPositionClass} w-72 bg-board-light border border-chalk/20 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden`}>
            <div className="p-4 border-b border-chalk/10">
              <h3 className="font-medium text-chalk">Select Playbook</h3>
              <p className="text-sm text-chalk/60 mt-1">Add "{playName}" to a playbook</p>
            </div>
            
            {loading ? (
              <div className="p-4 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-chalk/70 text-sm">Loading playbooks...</span>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {playbooks.map((playbook) => {
                  const isInPlaybook = playInPlaybooks.has(playbook.id);
                  const isJustAdded = justAdded.has(playbook.id);
                  const isLoading = actionLoading === playbook.id;
                  
                  return (
                    <button
                      key={playbook.id}
                      onClick={() => {
                        if (isLoading) return;
                        if (isInPlaybook) {
                          removePlayFromPlaybook(playbook.id);
                        } else {
                          addPlayToPlaybook(playbook.id);
                        }
                      }}
                      disabled={isLoading}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-board transition-colors border-b border-chalk/5 last:border-b-0 ${
                        isJustAdded ? 'bg-green-500/10' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-chalk truncate">{playbook.name}</div>
                        {playbook.description && (
                          <div className="text-sm text-chalk/60 truncate mt-1">{playbook.description}</div>
                        )}
                      </div>
                      
                      <div className="ml-3 flex-shrink-0">
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : isJustAdded ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <Check className="w-4 h-4" />
                            <span className="text-xs">Added!</span>
                          </div>
                        ) : isInPlaybook ? (
                          <div className="flex items-center gap-1 text-primary">
                            <Check className="w-4 h-4" />
                            <span className="text-xs">In playbook</span>
                          </div>
                        ) : (
                          <Plus className="w-4 h-4 text-chalk/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};