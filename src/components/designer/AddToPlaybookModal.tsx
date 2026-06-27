import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, FolderPlus, Plus } from 'lucide-react';
import type { Play } from '../../types/play';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { getSafeErrorMessage } from '../../lib/errors';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface Playbook {
  id: string;
  name: string;
  description: string;
}

interface AddToPlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
  play: Play;
  user: User | null;
}

export const AddToPlaybookModal: React.FC<AddToPlaybookModalProps> = ({ 
  isOpen, 
  onClose, 
  play, 
  user 
}: AddToPlaybookModalProps) => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchPlaybooks();
    }
  }, [isOpen, user]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setPlaybooks(data || []);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to load playbooks'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaybook = async () => {
    if (!selectedPlaybook) return;

    try {
      setSaving(true);
      setError(null);

      // First, create a copy of the play for the user
      const { data: copiedPlay, error: copyError } = await supabase
        .from('plays')
        .insert([
          {
            name: `${play.name} (Copy)`,
            type: play.type,
            canvas_data: play.canvas_data,
            thumbnail: play.thumbnail,
            metadata: play.metadata,
            user_id: user.id,
            is_public: false, // Private copy
            original_play_id: play.id // Track the original
          }
        ])
        .select()
        .single();

      if (copyError) throw copyError;

      // Get the current highest order position in the playbook
      const { data: maxOrderData, error: orderError } = await supabase
        .from('playbook_plays')
        .select('order_position')
        .eq('playbook_id', selectedPlaybook)
        .order('order_position', { ascending: false })
        .limit(1);

      if (orderError && !orderError.message.includes('JSON object requested')) {
        throw orderError;
      }

      const nextOrder = maxOrderData && maxOrderData.length > 0 
        ? maxOrderData[0].order_position + 1 
        : 1;

      // Add the copied play to the selected playbook
      const { error: linkError } = await supabase
        .from('playbook_plays')
        .insert([
          {
            playbook_id: selectedPlaybook,
            play_id: copiedPlay.id,
            order_position: nextOrder
          }
        ]);

      if (linkError) throw linkError;

      onClose();
      
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to add play to playbook'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-md overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-xl font-bold text-chalk">Add to Playbook</h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <h4 className="text-lg font-medium text-chalk mb-2">{play.name}</h4>
              <p className="text-sm text-chalk/70">
                This will create a copy of this play in your selected playbook.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-chalk/10 rounded animate-pulse" />
                ))}
              </div>
            ) : playbooks.length === 0 ? (
              <div className="text-center py-8">
                <FolderPlus className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
                <p className="text-chalk/70 mb-4">
                  You don't have any playbooks yet.
                </p>
                <button
                  onClick={onClose}
                  className="text-primary hover:text-primary-dark"
                >
                  Create a playbook first
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-chalk mb-2">
                    Select Playbook
                  </label>
                  <select
                    value={selectedPlaybook}
                    onChange={(e) => setSelectedPlaybook(e.target.value)}
                    className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Choose a playbook...</option>
                    {playbooks.map((playbook) => (
                      <option key={playbook.id} value={playbook.id}>
                        {playbook.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToPlaybook}
                    disabled={!selectedPlaybook || saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding...' : 'Add to Playbook'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}