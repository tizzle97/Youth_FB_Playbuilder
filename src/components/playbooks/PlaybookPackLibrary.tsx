import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Copy, Check, Lock, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { UpgradePrompt } from '../UpgradePrompt';
import type { User } from '@supabase/supabase-js';

type PackPlaybook = {
  id: string;
  name: string;
  description: string | null;
  play_count: number;
};

interface PlaybookPackLibraryProps {
  user: User | null;
  isPro: boolean;
}

/**
 * Browsable grid of "starter packs" — public playbooks (curated bundles,
 * typically owned by the official account) that Pro users can clone in one
 * tap: a new playbook plus a private copy of every play in it, in order
 * (BACKLOG B-33). Free users see a Pro lock on the clone action; individual
 * plays already clone for free via the Play Library (B-30).
 */
export function PlaybookPackLibrary({ user, isPro }: PlaybookPackLibraryProps) {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<PackPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedIds, setClonedIds] = useState<Set<string>>(new Set());
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('playbooks')
          .select('id, name, description, playbook_plays(count)')
          .eq('is_public', true)
          .order('created_at', { ascending: false });
        if (fetchError) throw fetchError;
        if (!cancelled) {
          setPacks(
            (data || []).map((pb: any) => ({
              id: pb.id,
              name: pb.name,
              description: pb.description,
              play_count: pb.playbook_plays?.[0]?.count ?? 0,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(getSafeErrorMessage(err, 'Failed to load starter playbook packs'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClone = async (pack: PackPlaybook) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isPro) {
      setShowUpgradePrompt(true);
      return;
    }
    try {
      setCloningId(pack.id);
      setError(null);
      const { error: rpcError } = await supabase.rpc('clone_playbook_pack', {
        pack_playbook_id: pack.id,
      });
      if (rpcError) throw rpcError;
      setClonedIds((prev) => new Set(prev).add(pack.id));
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to clone this playbook'));
    } finally {
      setCloningId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-board rounded-lg border border-chalk/10 p-6 animate-pulse">
            <div className="h-5 bg-chalk/10 rounded w-2/3 mb-3"></div>
            <div className="h-4 bg-chalk/10 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-chalk mb-2">No starter packs yet</h3>
          <p className="text-chalk/70">Check back soon for curated starter playbooks.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="bg-board rounded-lg border border-chalk/10 hover:border-primary/30 transition-colors p-6 flex flex-col"
            >
              <h3 className="font-bold text-chalk mb-1">{pack.name}</h3>
              {pack.description && (
                <p className="text-sm text-chalk/70 mb-3 line-clamp-3">{pack.description}</p>
              )}
              <p className="text-xs text-chalk/50 mb-4 flex items-center gap-1 mt-auto">
                <Play className="h-3 w-3" />
                {pack.play_count} {pack.play_count === 1 ? 'play' : 'plays'}
              </p>
              {clonedIds.has(pack.id) ? (
                <button
                  onClick={() => navigate('/playbooks')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg"
                >
                  <Check className="h-4 w-4" />
                  Cloned — view in My Playbooks
                </button>
              ) : (
                <button
                  onClick={() => handleClone(pack)}
                  disabled={cloningId === pack.id}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50"
                  title={!user ? 'Sign in to clone this playbook' : !isPro ? 'Cloning starter packs is a Pro feature' : 'Clone this playbook into My Playbooks'}
                >
                  {!isPro && <Lock className="h-3.5 w-3.5" />}
                  <Copy className="h-4 w-4" />
                  {cloningId === pack.id ? 'Cloning…' : !user ? 'Sign in to clone' : 'Clone this playbook'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Starter playbook packs"
        description="Cloning a whole starter playbook in one tap is part of Playbuilder Pro ($39/yr). You can still copy individual plays for free from the Community Play Library."
      />
    </div>
  );
}
