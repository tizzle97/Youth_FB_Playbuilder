import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import type { TimeRange } from '../../types/community';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface PostListProps {
  posts: any[];
  loading: boolean;
  timeRange: TimeRange;
  searchQuery: string;
}

export function PostList({ posts, loading, timeRange, searchQuery }: PostListProps) {
  const handleVote = async (postId: string, voteType: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('votes')
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            vote_type: voteType
          }
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-board-light rounded-lg p-6 border border-chalk/10 animate-pulse">
            <div className="h-4 bg-chalk/10 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-chalk/10 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-chalk mb-2">No posts found</h3>
        <p className="text-chalk/70">
          {searchQuery
            ? "No posts match your search criteria"
            : "Be the first to start a discussion!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="bg-board-light rounded-lg p-6 border border-chalk/10">
          <div className="flex gap-4">
            {/* Voting */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => handleVote(post.id, true)}
                className="p-1 text-chalk/70 hover:text-primary transition-colors"
              >
                <ArrowUp className="h-6 w-6" />
              </button>
              <span className="text-chalk font-bold">{post.upvotes - post.downvotes}</span>
              <button
                onClick={() => handleVote(post.id, false)}
                className="p-1 text-chalk/70 hover:text-primary transition-colors"
              >
                <ArrowDown className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-primary text-sm">
                      {post.author?.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <span className="text-chalk/70">Posted by</span>
                <span className="text-primary font-medium">
                  {post.author?.username || 'Anonymous'}
                </span>
                <span className="text-chalk/50">•</span>
                <span className="text-chalk/70">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>

              <h3 className="text-xl font-bold text-chalk mb-2">{post.title}</h3>
              <p className="text-chalk/70 mb-4">{post.content}</p>

              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-chalk/70 hover:text-chalk transition-colors">
                  <MessageSquare className="h-5 w-5" />
                  <span>{post.comment_count || 0} Comments</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}