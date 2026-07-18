import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Play as PlayIcon, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { PlayVoteButton } from './PlayVoteButton';
import { UpgradePrompt } from '../UpgradePrompt';

type PublicPlay = {
  id: string;
  name: string;
  description: string | null;
  type: 'offense' | 'defense' | 'special_teams';
  thumbnail: string | null;
  upvotes: number;
  metadata: { gameType?: string; difficulty?: string } | null;
  user_id: string;
  author?: { username: string | null };
};

/**
 * Browsable grid of every public play (B-30) — the community "Play
 * Library". Signed-in users can copy any play into their own account as a
 * private play; the server-side free-tier trigger (PBP01) caps free users
 * at 15 plays and surfaces as the standard upgrade prompt.
 */
export function PlayLibrary() {
  const navigate = useNavigate();
  const [plays, setPlays] = useState<PublicPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [votedPlayIds, setVotedPlayIds] = useState<Set<string>>(new Set());
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (cancelled) return;
        setUser(currentUser);

        const { data, error: fetchError } = await supabase
          .from('plays')
          .select('id, name, description, type, thumbnail, upvotes, metadata, user_id')
          .eq('is_public', true)
          .order('upvotes', { ascending: false })
          .order('created_at', { ascending: false });
        if (fetchError) throw fetchError;
        const rows = (data || []) as PublicPlay[];

        // Author names in one batched call (same pattern as the forum)
        const authorIds = Array.from(new Set(rows.map((p) => p.user_id)));
        if (authorIds.length > 0) {
          const { data: authors } = await supabase.rpc('get_community_authors', {
            target_ids: authorIds,
          });
          const byId = Object.fromEntries((authors || []).map((a: any) => [a.id, a]));
          rows.forEach((p) => { p.author = byId[p.user_id]; });
        }

        // Which plays has the current user already voted for?
        if (currentUser && rows.length > 0) {
          const { data: votes } = await supabase
            .from('play_votes')
            .select('play_id')
            .eq('user_id', currentUser.id)
            .in('play_id', rows.map((p) => p.id));
          if (!cancelled) setVotedPlayIds(new Set((votes || []).map((v: any) => v.play_id)));
        }

        if (!cancelled) setPlays(rows);
      } catch (err) {
        if (!cancelled) setError(getSafeErrorMessage(err, 'Failed to load the play library'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async (play: PublicPlay) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      setCopyingId(play.id);
      setError(null);

      // canvas_data is heavy, so the list query skips it — fetch at copy time.
      const { data: full, error: fetchError } = await supabase
        .from('plays')
        .select('canvas_data, formation_id')
        .eq('id', play.id)
        .single();
      if (fetchError) throw fetchError;

      const { error: insertError } = await supabase.from('plays').insert({
        user_id: user.id,
        name: play.name,
        description: play.description,
        type: play.type,
        canvas_data: full.canvas_data,
        formation_id: full.formation_id,
        thumbnail: play.thumbnail,
        metadata: play.metadata,
        is_public: false,
      });
      if (insertError) throw insertError;

      setCopiedIds((prev) => new Set(prev).add(play.id));
    } catch (err: any) {
      // Free-tier cap (PBP01) gets the upgrade prompt, not an error banner
      if (err?.code === 'PBP01') {
        setShowUpgradePrompt(true);
      } else {
        setError(getSafeErrorMessage(err, 'Failed to copy this play'));
      }
    } finally {
      setCopyingId(null);
    }
  };

  const gameFormatLabel = (p: PublicPlay) => p.metadata?.gameType || null;
  const filtered = search
    ? plays.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : plays;

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-chalk/50" />
        <input
          type="text"
          placeholder="Search plays..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-board border border-chalk/20 rounded-lg text-chalk placeholder-chalk/50 focus:outline-none focus:border-primary/50"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-board-light rounded-lg border border-chalk/10 overflow-hidden animate-pulse">
              <div className="aspect-video bg-chalk/10"></div>
              <div className="p-4">
                <div className="h-5 bg-chalk/10 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-chalk/10 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <PlayIcon className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-chalk mb-2">
            {search ? 'No plays match that search' : 'No public plays yet'}
          </h3>
          <p className="text-chalk/70">
            {search
              ? 'Try a different name.'
              : 'Publish one of your own plays to get the library started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((play) => (
            <div
              key={play.id}
              className="bg-board-light rounded-lg border border-chalk/10 hover:border-primary/30 transition-colors overflow-hidden flex flex-col"
            >
              <div className="aspect-video bg-white border-b border-chalk/10">
                {play.thumbnail ? (
                  <img
                    src={play.thumbnail}
                    alt={play.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-board/30">
                    <PlayIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-chalk">{play.name}</h3>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs capitalize shrink-0">
                    {play.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-chalk/50 mb-3">
                  {play.author?.username ? `by ${play.author.username}` : ''}
                  {gameFormatLabel(play) ? ` · ${gameFormatLabel(play)}` : ''}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <PlayVoteButton
                    playId={play.id}
                    upvotes={play.upvotes ?? 0}
                    voted={votedPlayIds.has(play.id)}
                    userId={user?.id}
                    onError={setError}
                  />
                  {copiedIds.has(play.id) ? (
                    <button
                      onClick={() => navigate('/plays')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg"
                      title="View in My Plays"
                    >
                      <Check className="h-4 w-4" />
                      Copied — view
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCopy(play)}
                      disabled={copyingId === play.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50"
                      title={user ? 'Copy this play into My Plays' : 'Sign in to copy this play'}
                    >
                      <Copy className="h-4 w-4" />
                      {copyingId === play.id ? 'Copying…' : user ? 'Copy to My Plays' : 'Sign in to copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="More plays"
        description="Free accounts hold 15 plays. Upgrade to Pro ($39/yr) for unlimited plays and playbooks, then copy as many library plays as you like."
      />
    </div>
  );
}
