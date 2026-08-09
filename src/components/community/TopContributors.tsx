import React, { useEffect, useState } from 'react';
import { Trophy, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Contributor {
  id: string;
  username: string;
  avatar_url: string | null;
  reputation: number;
}

export function TopContributors() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('get_top_contributors', { result_limit: 3 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching top contributors:', error);
          setContributors([]);
        } else {
          setContributors(data || []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="animate-pulse h-24 bg-board rounded-lg" />;
  }

  if (contributors.length === 0) {
    return <p className="text-sm text-chalk/50">No contributors yet — be the first to post!</p>;
  }

  return (
    <div className="space-y-4">
      {contributors.map((contributor, i) => (
        <div
          key={contributor.id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-board transition-colors"
        >
          <div className="relative">
            {contributor.avatar_url ? (
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                className="h-10 w-10 rounded-full"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-board flex items-center justify-center text-chalk/40 text-sm font-medium">
                {contributor.username.charAt(0).toUpperCase()}
              </div>
            )}
            {i === 0 && (
              <Trophy className="h-4 w-4 text-primary absolute -top-1 -right-1" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-chalk">{contributor.username}</div>
            <div className="flex items-center gap-1 text-sm text-chalk/70">
              <Star className="h-4 w-4 text-primary" />
              <span>{contributor.reputation.toLocaleString()} reputation</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
