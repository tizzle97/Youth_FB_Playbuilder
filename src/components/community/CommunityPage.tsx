import React, { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, Award, Search } from 'lucide-react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { PostList } from './PostList';
import { TopContributors } from './TopContributors';
import { CreatePostButton } from './CreatePostButton';
import type { TimeRange } from '../../types/community';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function CommunityPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate Supabase configuration
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration is missing');
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles (
            id,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error: supabaseError } = await query;
      
      if (supabaseError) {
        console.error('Supabase error:', supabaseError);
        throw new Error(supabaseError.message);
      }
      
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, timeRange]);

  return (
    <div className="min-h-screen bg-board">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-board-light rounded-lg p-6 mb-8 border border-chalk/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-chalk font-bold text-chalk flex items-center gap-3">
                  <MessageSquare className="h-8 w-8 text-primary" />
                  Community Forum
                </h1>
                <CreatePostButton onPostCreated={fetchPosts} />
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-chalk/50" />
                  <input
                    type="text"
                    placeholder="Search discussions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-board border border-chalk/20 rounded-lg text-chalk placeholder-chalk/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            <PostList
              posts={posts}
              loading={loading}
              timeRange={timeRange}
              searchQuery={searchQuery}
            />
          </div>

          {/* Sidebar */}
          <div className="md:w-80 space-y-8">
            <div className="bg-board-light rounded-lg p-6 border border-chalk/10">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-chalk font-bold text-chalk">Trending Topics</h2>
              </div>
              <div className="space-y-2">
                {['Defensive Strategies', 'QB Development', 'Practice Drills', 'Game Planning'].map((topic) => (
                  <button
                    key={topic}
                    className="w-full text-left px-3 py-2 text-chalk/70 hover:text-chalk hover:bg-board rounded-md transition-colors"
                  >
                    #{topic.toLowerCase().replace(/\s+/g, '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-board-light rounded-lg p-6 border border-chalk/10">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-chalk font-bold text-chalk">Top Contributors</h2>
              </div>
              <TopContributors />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}