import React, { useState, useEffect } from 'react';
import { MessageSquare, Award, Search } from 'lucide-react';
import { TimeRangeSelector } from './TimeRangeSelector';
import { PostList } from './PostList';
import { TopContributors } from './TopContributors';
import { CreatePostButton } from './CreatePostButton';
import type { TimeRange } from '../../types/community';
import { getSafeErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { usePageMeta } from '../../lib/seo';

export function CommunityPage() {
  usePageMeta({ title: 'Community Plays & Forum', description: 'Share plays, ask questions, and learn from other youth and flag football coaches in the Playbuilder Pro community.', path: '/community' });
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
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
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        console.error('Supabase error:', supabaseError);
        throw supabaseError;
      }

      const postsData = data || [];

      // Author display info (username/avatar) isn't on the posts table —
      // look it up in one batched call via get_community_authors().
      const authorIds = Array.from(new Set(postsData.map((p: any) => p.user_id)));
      let authorsById: Record<string, { username: string; avatar_url: string | null }> = {};
      if (authorIds.length > 0) {
        const { data: authors, error: authorsError } = await supabase.rpc('get_community_authors', {
          target_ids: authorIds,
        });
        if (authorsError) {
          console.error('Error fetching post authors:', authorsError);
        } else {
          authorsById = Object.fromEntries((authors || []).map((a: any) => [a.id, a]));
        }
      }

      setPosts(postsData.map((p: any) => ({ ...p, author: authorsById[p.user_id] })));
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(getSafeErrorMessage(err, 'Failed to fetch posts. Please try again later.'));
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