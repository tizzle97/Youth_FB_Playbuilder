import React, { useState, useEffect } from 'react';
import { X, Plus, FolderPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CreatePlaybookModal } from './CreatePlaybookModal';

interface Playbook {
  id: string;
  name: string;
  description: string;
}

interface PlaybookSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (playbookId: string) => void;
}

export function PlaybookSelectionModal({ isOpen, onClose, onSelect }: PlaybookSelectionModalProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPlaybooks = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('You must be signed in to view playbooks');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('playbooks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setPlaybooks(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load playbooks');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaybooks();
  }, [isOpen]);

  const handleCreatePlaybook = async (name: string, description: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to create a playbook');
        return;
      }

      const { data, error } = await supabase
        .from('playbooks')
        .insert([
          {
            name,
            description,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setPlaybooks(prev => [data, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playbook');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-md overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-2xl font-bold text-chalk">Select Playbook</h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-board animate-pulse rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            ) : playbooks.length === 0 ? (
              <div className="text-center py-8">
                <FolderPlus className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
                <p className="text-chalk/70 mb-4">
                  No playbooks found. Create one to get started!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Playbook
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-6">
                  {playbooks.map((playbook) => (
                    <button
                      key={playbook.id}
                      onClick={() => onSelect(playbook.id)}
                      className="w-full p-4 text-left bg-board hover:bg-board-light border border-chalk/10 rounded-lg transition-colors group"
                    >
                      <h4 className="text-chalk font-medium group-hover:text-primary transition-colors">
                        {playbook.name}
                      </h4>
                      <p className="text-sm text-chalk/70 line-clamp-2">
                        {playbook.description}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-chalk/10">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-primary hover:text-primary-dark transition-colors"
                  >
                    <Plus className="h-5 w-5 inline mr-1" />
                    Create New Playbook
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CreatePlaybookModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePlaybook}
      />
    </div>
  );
}