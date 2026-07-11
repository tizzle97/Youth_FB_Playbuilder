import React, { useEffect, useState } from 'react';
import { Trophy, ThumbsUp, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TopPlay = {
  id: string;
  name: string;
  description: string | null;
  type: 'offense' | 'defense' | 'special_teams';
  upvotes: number;
  metadata: { difficulty?: string } | null;
};

/**
 * Homepage "Top Ranked Plays" backed by real community votes (B-10/B-11).
 * Deliberately renders nothing until at least one public play has an
 * upvote — no placeholder/fabricated content (house rule), and it also
 * keeps the homepage intact if the play_votes migration hasn't run yet
 * (the query errors and the section stays hidden).
 */
export function TopPlays() {
  const [plays, setPlays] = useState<TopPlay[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('plays')
        .select('id, name, description, type, upvotes, metadata')
        .eq('is_public', true)
        .gt('upvotes', 0)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3);
      if (!cancelled && !error && data) setPlays(data as TopPlay[]);
    })();
    return () => { cancelled = true; };
  }, []);

  if (plays.length === 0) return null;

  const difficultyLabel = (play: TopPlay) =>
    play.metadata?.difficulty || play.type.replace('_', ' ');

  return (
    <div className="py-16 bg-board">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-chalk font-bold text-chalk flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              Top Ranked Plays
            </h2>
            <p className="mt-2 text-lg text-chalk/70">
              The community's most upvoted plays
            </p>
          </div>
          <a
            href="/plays"
            className="hidden sm:flex items-center text-primary hover:text-primary-dark transition-colors"
          >
            View all plays
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {plays.map((play) => (
            <div
              key={play.id}
              className="bg-board-light rounded-xl p-6 border border-chalk/10 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4 gap-3">
                <h3 className="text-xl font-bold text-chalk">{play.name}</h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize shrink-0">
                  {difficultyLabel(play)}
                </span>
              </div>

              <p className="text-chalk/70 mb-6">
                {play.description || 'A community-shared play.'}
              </p>

              <div className="flex items-center text-sm text-chalk/70">
                <ThumbsUp className="h-4 w-4 mr-2 text-primary" />
                {play.upvotes} {play.upvotes === 1 ? 'upvote' : 'upvotes'}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <a
            href="/plays"
            className="inline-flex items-center text-primary hover:text-primary-dark transition-colors"
          >
            View all plays
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
