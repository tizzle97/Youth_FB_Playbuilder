import React from 'react';
import { Trophy, Users, ArrowRight } from 'lucide-react';

const topPlays = [
  {
    name: "Quick Slant Option",
    description: "Perfect for developing QB decision-making skills",
    difficulty: "Intermediate",
    usageCount: 2547,
    rating: 4.9
  },
  {
    name: "Double Screen Pass",
    description: "Creates multiple options for young quarterbacks",
    difficulty: "Beginner",
    usageCount: 2341,
    rating: 4.8
  },
  {
    name: "Flag Sweep Special",
    description: "High-success rate play for youth teams",
    difficulty: "Beginner",
    usageCount: 2156,
    rating: 4.9
  }
];

export function TopPlays() {
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
              Most popular plays used by our community
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
          {topPlays.map((play, index) => (
            <div
              key={index}
              className="bg-board-light rounded-xl p-6 border border-chalk/10 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-chalk">{play.name}</h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                  {play.difficulty}
                </span>
              </div>
              
              <p className="text-chalk/70 mb-6">{play.description}</p>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-chalk/70">
                  <Users className="h-4 w-4 mr-2" />
                  {play.usageCount.toLocaleString()} uses
                </div>
                <div className="flex items-center">
                  <Trophy className="h-4 w-4 text-primary mr-1" />
                  <span className="text-chalk">{play.rating}</span>
                </div>
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