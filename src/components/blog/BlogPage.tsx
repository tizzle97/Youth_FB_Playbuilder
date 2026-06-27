import React, { useState, useEffect } from 'react';
import { Book, Tag, Calendar, User, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to load blog posts'));
    } finally {
      setLoading(false);
    }
  };

  const formatContent = (content: string) => {
    // Simple formatting: convert line breaks to paragraphs
    return content.split('\n\n').map((paragraph, index) => (
      <p key={index} className="mb-4 text-chalk/90 leading-relaxed">
        {paragraph}
      </p>
    ));
  };

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-board">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => setSelectedPost(null)}
            className="mb-6 text-primary hover:text-primary-dark transition-colors"
          >
            ← Back to Blog
          </button>

          <article className="bg-board-light rounded-lg p-8 border border-chalk/10">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-chalk mb-4">
                {selectedPost.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-chalk/70">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Published {formatDistanceToNow(new Date(selectedPost.published_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>Admin</span>
                </div>
              </div>
            </header>

            <div className="prose prose-invert max-w-none">
              {formatContent(selectedPost.content)}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-board">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-board-light rounded-lg p-8 mb-8 border border-chalk/10">
          <div className="flex items-center gap-3 mb-4">
            <Book className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-chalk font-bold text-chalk">Blog</h1>
          </div>
          <p className="text-chalk/70 text-lg max-w-3xl">
            Insights, strategies, and expert advice for youth football coaches and players.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-board-light rounded-lg overflow-hidden border border-chalk/10 animate-pulse">
                <div className="h-48 bg-chalk/10"></div>
                <div className="p-6">
                  <div className="h-4 bg-chalk/10 rounded w-2/3 mb-4"></div>
                  <div className="h-4 bg-chalk/10 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-chalk/10 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <Eye className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-chalk mb-2">No blog posts yet</h3>
            <p className="text-chalk/70">
              Check back soon for insights and strategies from our coaching experts.
            </p>
          </div>
        ) : (
          /* Blog Posts Grid */
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-board-light rounded-lg overflow-hidden border border-chalk/10 hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => setSelectedPost(post)}
              >
                <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Book className="h-16 w-16 text-primary/40" />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Tag className="h-3 w-3 mr-1" />
                      Coaching Tips
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-chalk mb-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-chalk/70 mb-4 line-clamp-3">
                    {post.content.substring(0, 150)}...
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-chalk/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-chalk/70">
                        <User className="h-4 w-4 inline mr-1" />
                        Admin
                      </span>
                    </div>
                    <span className="text-sm text-chalk/70">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}