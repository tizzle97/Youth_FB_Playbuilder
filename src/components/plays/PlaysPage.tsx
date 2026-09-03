import React, { useState, useEffect } from 'react';
import { Book, Plus, Filter, Trash2, LogIn, Wand2, Shield } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AddToPlaybookButton } from './AddToPlaybookButton'; // Adjust path as needed
import { PlayVoteButton } from './PlayVoteButton';
import { PlayCard, PlayCardTitle } from './PlayCard';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';
import { PlayLibrary } from './PlayLibrary';
import { FREE_LIMITS, isNearFreeLimit, rowIsPro } from '../../lib/entitlements';
import { UsageWarningBanner } from '../UsageWarningBanner';

// Every action in a card footer is the same square pill, so the row's width is
// predictable and can't outgrow the card the way the old labelled+icon mix did.
const CARD_ACTION =
  'tap-target flex items-center justify-center h-9 w-9 rounded-lg border border-chalk/10 bg-board hover:bg-board-light text-chalk/70 hover:text-chalk transition-colors';

interface Play {
  id: string;
  name: string;
  type: 'offense' | 'defense' | 'special_teams';
  thumbnail?: string;
  is_public: boolean;
  upvotes?: number;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

export function PlaysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab=community shows the public Play Library; default is your own plays.
  const tab: 'mine' | 'community' = searchParams.get('tab') === 'community' ? 'community' : 'mine';
  usePageMeta(
    tab === 'community'
      ? { title: 'Community Play Library', description: 'Browse public plays shared by youth and flag football coaches — vote for favorites and copy any play into your own account.', path: '/plays' }
      : { title: 'My Plays', description: 'Your saved football plays in Playbuilder Pro.', path: '/plays' }
  );
  const [plays, setPlays] = useState<Play[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'offense' | 'defense' | 'special_teams' | 'all'>('all');
  const [votedPlayIds, setVotedPlayIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [totalPlayCount, setTotalPlayCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlays = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser) {
          // User is authenticated - show their plays

          // Total play count + Pro status for the free-tier usage nudge (B-22).
          // Queried directly (not via useEntitlement()) since that hook's own
          // auth.getUser() call would race this effect's — see the B-4 note.
          supabase
            .from('plays')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .then(({ count }) => setTotalPlayCount(count ?? 0));
          supabase
            .from('subscriptions')
            .select('plan, current_period_end')
            .eq('user_id', currentUser.id)
            .maybeSingle()
            .then(({ data }) => setIsPro(rowIsPro(data)));

          // The card grid only ever reads these columns — canvas_data (the
          // committed play JSON) and description/metadata are dead weight
          // here; PlayDesigner's own load is the one place that needs
          // canvas_data (see issue #120).
          let query = supabase
            .from('plays')
            .select('id, name, type, thumbnail, is_public, upvotes')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          if (filter !== 'all') {
            query = query.eq('type', filter);
          }

          const { data, error: fetchError } = await query;

          if (fetchError) throw fetchError;
          setPlays(data || []);

          // Which of these plays has the current user already voted for?
          // One query for the whole page. Vote data is additive (B-10) — if
          // the play_votes table isn't migrated yet this just leaves the set
          // empty rather than failing the page.
          const ids = (data || []).filter((p) => p.is_public).map((p) => p.id);
          if (ids.length > 0) {
            const { data: votes } = await supabase
              .from('play_votes')
              .select('play_id')
              .eq('user_id', currentUser.id)
              .in('play_id', ids);
            setVotedPlayIds(new Set((votes || []).map((v) => v.play_id)));
          } else {
            setVotedPlayIds(new Set());
          }
        }
        // Signed-out visitors browse public plays on the Community tab
        // (PlayLibrary); the old profiles(...) embed here 400'd anyway.
      } catch (err) {
        console.error('Error fetching plays:', err);
        setError(getSafeErrorMessage(err, 'Failed to load plays'));
      } finally {
        setLoading(false);
      }
    };

    fetchPlays();
  }, [filter]);

  const handleDeletePlay = async (playId: string) => {
    if (!confirm('Are you sure you want to delete this play? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('plays')
        .delete()
        .eq('id', playId);

      if (deleteError) throw deleteError;

      setPlays(plays.filter(play => play.id !== playId));
      setTotalPlayCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to delete play'));
    }
  };

  const visiblePlays = plays;

  // My Plays requires sign-in; the Community tab is public.
  if (!loading && !user && tab === 'mine') {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center px-4">
        <div className="text-center">
          <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-chalk mb-4">Sign In Required</h2>
          <p className="text-chalk/70 mb-6">Please sign in to view Community Plays.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Sign In
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'community' }, { replace: true })}
              className="px-6 py-3 border border-chalk/20 text-chalk hover:bg-board rounded-lg transition-colors"
            >
              Browse Community Plays
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-board-light rounded-xl border border-chalk/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-chalk/10">
            {/* flex-wrap throughout: the panel is overflow-hidden, so a row
                that outgrows it is clipped rather than scrollable. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <h1 className="text-2xl font-bold text-chalk flex items-center gap-2">
                  <Book className="h-6 w-6 text-primary" />
                  Plays
                </h1>
                <div className="flex items-center gap-1 border border-chalk/15 rounded-lg p-1">
                  <button
                    onClick={() => setSearchParams({}, { replace: true })}
                    className={`tap-target px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      tab === 'mine' ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
                    }`}
                  >
                    My Plays
                  </button>
                  <button
                    onClick={() => setSearchParams({ tab: 'community' }, { replace: true })}
                    className={`tap-target px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      tab === 'community' ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk'
                    }`}
                  >
                    Community
                  </button>
                </div>
              </div>
              {user && tab === 'mine' && (
                <Link
                  to="/designer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Play
                </Link>
              )}
            </div>

            {tab === 'mine' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-chalk/50 shrink-0" />
              <div className="flex flex-wrap gap-2">
                {(['all', 'offense', 'defense', 'special_teams'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`tap-target px-3 py-1 text-sm rounded-md capitalize ${
                      filter === type
                        ? 'bg-primary text-white'
                        : 'text-chalk/70 hover:text-chalk hover:bg-board'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>

          <div className="p-6 relative">
            {tab === 'community' ? (
              <PlayLibrary />
            ) : (
            <>
            {!isPro && isNearFreeLimit(totalPlayCount, FREE_LIMITS.plays) && (
              <div className="mb-6">
                <UsageWarningBanner used={totalPlayCount} limit={FREE_LIMITS.plays} label="plays" />
              </div>
            )}
            {error ? (
              <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-board-light rounded-lg border border-chalk/10"
                  >
                    <div className="bg-board rounded-t-lg aspect-play"></div>
                    <div className="p-4">
                      <div className="h-4 bg-board rounded w-2/3 mb-3"></div>
                      <div className="h-9 bg-board rounded w-1/2 ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : plays.length === 0 ? (
              <div className="text-center py-12">
                <Book className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-chalk mb-2">
                  {user ? 'No plays found' : 'No public plays available'}
                </h3>
                <p className="text-chalk/70">
                  {user ? (
                    filter === 'all'
                      ? "You haven't created any plays yet"
                      : `No ${filter.replace('_', ' ')} plays found`
                  ) : (
                    'Check back later for community plays'
                  )}
                </p>
                {user && (
                  <Link
                    to="/designer"
                    className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Play
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Visible plays */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visiblePlays.map((play) => (
                    // clip={false}: the add-to-playbook dropdown is an
                    // absolutely-positioned child and overflow-hidden would
                    // erase it. Signed-out visitors get no edit link — they
                    // don't own these plays. `from=plays` sends the designer
                    // back here after an update rather than stranding the coach
                    // in the designer post-save.
                    <PlayCard
                      key={play.id}
                      play={play}
                      clip={false}
                      href={user ? `/designer?play=${play.id}&from=plays` : undefined}
                    >
                      <>
                        <PlayCardTitle name={play.name} type={play.type} />

                        {!user && play.profiles && (
                          <p className="text-xs text-chalk/40">
                            by {play.profiles.username || 'Anonymous'}
                          </p>
                        )}

                        {/* Vote left, actions right. ml-auto keeps the cluster
                            right-aligned on private plays, which have no vote
                            button — so the footer doesn't reflow card to card. */}
                        <div
                          className={`mt-auto flex items-center justify-between gap-2 flex-wrap ${
                            user || play.is_public ? 'pt-3' : ''
                          }`}
                        >
                          {play.is_public && (
                            <PlayVoteButton
                              playId={play.id}
                              upvotes={play.upvotes ?? 0}
                              voted={user ? votedPlayIds.has(play.id) : false}
                              userId={user?.id}
                              onError={setError}
                            />
                          )}

                          {user && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <AddToPlaybookButton
                                compact
                                playId={play.id}
                                playName={play.name}
                                onSuccess={() => {
                                  // Optional: Show success notification
                                  console.log(`"${play.name}" added to playbook successfully!`);
                                }}
                              />

                              {/* Opens this play in the Designer without
                                  editingPlayId set, so Save creates a new play
                                  instead of updating this one — see
                                  PlayDesigner.tsx's load effect. */}
                              <Link
                                to={`/designer?template=${play.id}`}
                                title="Use this play as a starting point for a new one"
                                className={CARD_ACTION}
                              >
                                <Wand2 className="h-4 w-4" />
                              </Link>

                              {/* Offense only — the vs. view draws this play
                                  under a defense, so pointing it at a defensive
                                  play would stack two defenses. */}
                              {play.type === 'offense' && (
                                <Link
                                  to={`/vs?play=${play.id}`}
                                  title="View this play against your defensive plays"
                                  className={CARD_ACTION}
                                >
                                  <Shield className="h-4 w-4" />
                                </Link>
                              )}

                              {/* This whole list is already scoped to the
                                  signed-in user's own plays (fetchPlays queries
                                  .eq('user_id', currentUser.id)) — Community
                                  plays render via the separate PlayLibrary
                                  component, never here. So every play card
                                  reaching this point is already owned by `user`;
                                  no admin/ownership gate is needed. */}
                              <button
                                onClick={() => handleDeletePlay(play.id)}
                                className={`${CARD_ACTION} border-transparent bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-400`}
                                title="Delete Play"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    </PlayCard>
                  ))}
                </div>

              </>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}