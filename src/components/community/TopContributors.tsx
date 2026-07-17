import React from 'react';
import { Trophy, Star } from 'lucide-react';

// Temporary mock data
const contributors = [
  {
    username: 'CoachMike',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    reputation: 1250,
    rank: 1,
  },
  {
    username: 'DefensiveGuru',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    reputation: 980,
    rank: 2,
  },
  {
    username: 'PlayMaker',
    avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    reputation: 750,
    rank: 3,
  },
];

export function TopContributors() {
  return (
    <div className="space-y-4">
      {contributors.map((contributor) => (
        <div
          key={contributor.username}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-board transition-colors"
        >
          <div className="relative">
            <img
              src={contributor.avatar_url}
              alt={contributor.username}
              className="h-10 w-10 rounded-full"
              loading="lazy"
              decoding="async"
            />
            {contributor.rank === 1 && (
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