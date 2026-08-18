// Complete SavePlayModal.tsx with all missing functions and state
import React, { useState, useEffect } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { PlayMetadata } from '../../types/play';
import { PlayMetadataForm } from './PlayMetadataForm';
import { supabase } from '../../lib/supabase';
import type { UserPreferences } from '../../lib/userPreferences';
import { FREE_LIMITS, isNearFreeLimit, rowIsPro } from '../../lib/entitlements';
import { UsageWarningBanner } from '../UsageWarningBanner';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Playbook {
  id: string;
  name: string;
  description: string;
}

interface SavePlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playData: {
    name: string;
    metadata: PlayMetadata;
    isPublic: boolean;
    playbookId?: string;
  }) => void;
  user: any;
  previewThumbnail?: string; // Optional thumbnail preview
  /** Save defaults from account settings (B-14/B-15); null when signed out. */
  preferences?: UserPreferences | null;
  /** True when saving updates an existing play in place — doesn't consume a
   *  new free-tier play slot, so the usage nudge (B-22) doesn't apply. */
  isEditingExistingPlay?: boolean;
  /** Stable id of the play `existingPlay` was loaded from — set for both an
   *  in-place edit (?play=) and a "Use as Template" load (?template=), so
   *  either one prefills the form. Used only as an effect dependency — see
   *  the prefill effect below — never rendered. */
  prefillKey?: string | null;
  /** The play's current saved values, when editing one in place. Prefills
   *  the form with reality instead of blank fields + account defaults. */
  existingPlay?: { name: string; metadata: PlayMetadata; isPublic: boolean };
}

export function SavePlayModal({
  isOpen,
  onClose,
  onSave,
  user,
  previewThumbnail,
  preferences = null,
  isEditingExistingPlay = false,
  prefillKey = null,
  existingPlay,
}: SavePlayModalProps) {
  // ALL THE MISSING STATE VARIABLES
  const [step, setStep] = useState<'metadata' | 'playbook'>('metadata');
  const [playName, setPlayName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [metadata, setMetadata] = useState<PlayMetadata>({
    gameType: '5v5',
    playType: 'pass',
    formation: '',
    difficulty: 'beginner',
    tags: [],
    description: '',
    playName: ''
  });

  // Load playbooks when modal opens
  useEffect(() => {
    if (isOpen && user) {
      fetchPlaybooks();
    }
  }, [isOpen, user]);

  // Play count + Pro status for the free-tier usage nudge (B-22). Only
  // relevant for a new play — editing an existing one doesn't add a play.
  // Queried directly (not via useEntitlement()) since the `user` prop is
  // already resolved by the caller — see the B-4 gotrue deadlock note.
  useEffect(() => {
    if (isOpen && user && !isEditingExistingPlay) {
      supabase
        .from('plays')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => setPlayCount(count ?? 0));
      supabase
        .from('subscriptions')
        .select('plan, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setIsPro(rowIsPro(data)));
    }
  }, [isOpen, user, isEditingExistingPlay]);

  // Prefill from the play being edited or used as a template, once, when the
  // modal opens for it. Keyed on prefillKey (a stable id, only changes when
  // a *different* play loads) rather than the `existingPlay` object itself,
  // which is a fresh reference on every PlayDesigner render — depending on
  // that would re-run this effect on every keystroke elsewhere in the app
  // and silently blow away whatever the user has already typed into this
  // modal. This was a real bug: opening an existing play and hitting Update
  // reset Play Name to blank and Game Type/Play Type/etc. to generic
  // defaults, because nothing here ever read the play's actual saved values.
  useEffect(() => {
    if (isOpen && existingPlay) {
      setPlayName(existingPlay.name);
      setMetadata(existingPlay.metadata);
      setIsPublic(existingPlay.isPublic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefillKey]);

  // Prefill from account-settings defaults (B-14 game format; B-15 play
  // type + visibility) — new plays only. An existing play's own saved
  // values (above) always win; this must never overwrite them, including
  // if `preferences` itself resolves or changes while the modal is open.
  useEffect(() => {
    if (isOpen && preferences && !existingPlay) {
      setMetadata((prev) => ({
        ...prev,
        gameType: preferences.default_game_format,
        playType: preferences.default_play_type,
      }));
      setIsPublic(preferences.default_visibility === 'public');
    }
  }, [isOpen, preferences, existingPlay]);

  // MISSING FUNCTION: fetchPlaybooks
  const fetchPlaybooks = async () => {
    try {
      setLoadingPlaybooks(true);
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setPlaybooks(data || []);
    } catch (err) {
      console.error('Error loading playbooks:', err);
    } finally {
      setLoadingPlaybooks(false);
    }
  };

  // MISSING FUNCTION: handleNext
  const handleNext = () => {
    if (!playName.trim()) return;
    setStep('playbook');
  };

  // MISSING FUNCTION: handleSave
  const handleSave = () => {
    if (!playName.trim()) return;
    
    onSave({
      name: playName,
      metadata,
      isPublic,
      playbookId: selectedPlaybook || undefined
    });
    
    // Reset form
    setPlayName('');
    setMetadata({
      gameType: '5v5',
      playType: 'pass',
      formation: '',
      difficulty: 'beginner',
      tags: [],
      description: '',
      playName: ''
    });
    setIsPublic(false);
    setSelectedPlaybook('');
    setStep('metadata');
    onClose();
  };

  // MISSING FUNCTION: handleBack
  const handleBack = () => {
    setStep('metadata');
  };

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden text-left bg-board-light rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10 flex-shrink-0">
          <h3 className="text-2xl font-bold text-chalk">
            {step === 'metadata' ? 'Save Play' : 'Select Playbook'}
          </h3>
          <button
            onClick={onClose}
            className="text-chalk/70 hover:text-chalk transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {step === 'metadata' ? (
            // Step 1: Play metadata with thumbnail preview
            <div className="p-6 space-y-6">
              {!isEditingExistingPlay && !isPro && isNearFreeLimit(playCount, FREE_LIMITS.plays) && (
                <UsageWarningBanner used={playCount} limit={FREE_LIMITS.plays} label="plays" />
              )}
              {/* Thumbnail Preview */}
              {previewThumbnail && (
                <div className="border border-chalk/20 rounded-lg p-4 bg-board">
                  <label className="block text-sm font-medium text-chalk mb-2">
                    Play Preview
                  </label>
                  <div className="w-full max-w-xs mx-auto">
                    <img 
                      src={previewThumbnail} 
                      alt="Play preview" 
                      className="w-full h-auto rounded border border-chalk/10"
                      style={{ aspectRatio: '3/2' }}
                    />
                  </div>
                  <p className="text-xs text-chalk/60 text-center mt-2">
                    This is how your play will appear in the plays library
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-chalk mb-2">
                  Play Name *
                </label>
                <input
                  type="text"
                  value={playName}
                  onChange={(e) => setPlayName(e.target.value)}
                  placeholder="Enter play name..."
                  className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <PlayMetadataForm metadata={metadata} onChange={setMetadata} />

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-primary bg-board border-chalk/20 rounded focus:ring-primary"
                />
                <label htmlFor="isPublic" className="text-sm text-chalk">
                  Make this play public (visible on the community plays page)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-chalk/10">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={!playName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Choose Playbook
                </button>
              </div>
            </div>
          ) : (
            // Step 2: Playbook selection
            <div className="p-6">
              <div className="mb-4">
                <h4 className="text-lg font-medium text-chalk mb-2">{playName}</h4>
                <p className="text-sm text-chalk/70">
                  Choose a playbook to add this play to, or save without adding to a playbook.
                </p>
              </div>

              {loadingPlaybooks ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-chalk/10 rounded animate-pulse" />
                  ))}
                </div>
              ) : playbooks.length === 0 ? (
                <div className="text-center py-8">
                  <FolderPlus className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
                  <p className="text-chalk/70 mb-4">
                    You don't have any playbooks yet. You can still save the play and create playbooks later.
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-chalk mb-2">
                    Select Playbook (Optional)
                  </label>
                  <select
                    value={selectedPlaybook}
                    onChange={(e) => setSelectedPlaybook(e.target.value)}
                    className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Don't add to playbook now</option>
                    {playbooks.map((playbook) => (
                      <option key={playbook.id} value={playbook.id}>
                        {playbook.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-between space-x-3">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                  >
                    Save Play
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}