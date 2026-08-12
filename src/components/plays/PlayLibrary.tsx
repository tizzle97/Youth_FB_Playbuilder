import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Play as PlayIcon, Search, Filter, Wand2 } from 'lucide-react';
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
  metadata: { gameType?: string; difficulty?: string; formation?: string } | null;
  user_id: string;
  author?: { username: string | null };
};

const TYPE_FILTERS = ['all', 'offense', 'defense', 'special_teams'] as const;
const GAME_TYPE_FILTERS = ['all', '5v5', '6v6', '7v7', '11v11'] as const;

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
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [gameTypeFilter, setGameTypeFilter] = useState<(typeof GAME_TYPE_FILTERS)[number]>('all');
  const [formationFilter, setFormationFilter] = useState('all');
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

        // Author names + the current user's votes, fetched in parallel (both
        // only depend on `rows`/`currentUser`, not on each other).
        const authorIds = Array.from(new Set(rows.map((p) => p.user_id)));
        const [authorsResult, votesResult] = await Promise.all([
          authorIds.length > 0
            ? supabase.rpc('get_community_authors', { target_ids: authorIds })
            : Promise.resolve({ data: null }),
          currentUser && rows.length > 0
            ? supabase
                .from('play_votes')
                .select('play_id')
                .eq('user_id', currentUser.id)
                .in('play_id', rows.map((p) => p.id))
            : Promise.resolve({ data: null }),
        ]);

        const byId = Object.fromEntries((authorsResult.data || []).map((a: any) => [a.id, a]));
        rows.forEach((p) => { p.author = byId[p.user_id]; });

        if (!cancelled) {
          setVotedPlayIds(new Set((votesResult.data || []).map((v: any) => v.play_id)));
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

  // Opens this play in the Designer without editingPlayId set, so Save
  // creates a new play instead of updating this one (PlayDesigner.tsx's
  // load effect) — an editable alternative to the instant handleCopy above.
  const handleUseAsTemplate = (play: PublicPlay) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/designer?template=${play.id}`);
  };

  const gameFormatLabel = (p: PublicPlay) => p.metadata?.gameType || null;

  // Formation is free text a coach typed in, not an enum — offer whatever
  // distinct values actually exist rather than a fixed list, so every
  // option is guaranteed to return at least one play. Derived from the
  // full unfiltered set (not the other active filters) so the dropdown's
  // options stay stable while type/game format are toggled.
  const availableFormations = useMemo(() => {
    const values = new Set<string>();
    plays.forEach((p) => {
      const f = p.metadata?.formation?.trim();
      if (f) values.add(f);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [plays]);

  const filtered = plays.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (gameTypeFilter !== 'all' && p.metadata?.gameType !== gameTypeFilter) return false;
    if (formationFilter !== 'all' && p.metadata?.formation !== formationFilter) return false;
    return true;
  });
  const filtersActive = typeFilter !== 'all' || gameTypeFilter !== 'all' || formationFilter !== 'all';

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-chalk/50" />
        <input
          type="text"
          placeholder="Search plays..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-board border border-chalk/20 rounded-lg text-chalk placeholder-chalk/50 focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-chalk/50 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                  typeFilter === type
                    ? 'bg-primary text-white'
                    : 'bg-board text-chalk/70 hover:text-chalk border border-chalk/10'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {GAME_TYPE_FILTERS.map((gt) => (
            <button
              key={gt}
              onClick={() => setGameTypeFilter(gt)}
              className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                gameTypeFilter === gt
                  ? 'bg-primary text-white'
                  : 'bg-board text-chalk/70 hover:text-chalk border border-chalk/10'
              }`}
            >
              {gt === 'all' ? 'All formats' : gt}
            </button>
          ))}
        </div>

        {availableFormations.length > 0 && (
          <select
            value={formationFilter}
            onChange={(e) => setFormationFilter(e.target.value)}
            className="px-3 py-1 text-sm rounded-md bg-board text-chalk/70 border border-chalk/10 focus:outline-none focus:border-primary/50 hover:text-chalk"
          >
            <option value="all">All formations</option>
            {availableFormations.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
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
            {search || filtersActive ? 'No plays match those filters' : 'No public plays yet'}
          </h3>
          <p className="text-chalk/70">
            {search || filtersActive
              ? 'Try a different search or clear a filter.'
              : 'Publish one of your own plays to get the library started.'}
          </p>
          {filtersActive && (
            <button
              onClick={() => { setTypeFilter('all'); setGameTypeFilter('all'); setFormationFilter('all'); }}
              className="mt-4 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
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
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <PlayVoteButton
                    playId={play.id}
                    upvotes={play.upvotes ?? 0}
                    voted={votedPlayIds.has(play.id)}
                    userId={user?.id}
                    onError={setError}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUseAsTemplate(play)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-chalk/70 hover:text-chalk bg-board-light hover:bg-board border border-chalk/10 rounded-lg transition-colors"
                      title={user ? 'Open in the Designer to edit and save as a new play' : 'Sign in to use this play as a template'}
                    >
                      <Wand2 className="h-4 w-4" />
                    </button>
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
