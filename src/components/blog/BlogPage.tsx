import React, { useState, useEffect } from 'react';
import { Book, Tag, Calendar, User, Eye } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  slug: string;
  description: string | null;
  author_id: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

function formatContent(content: string) {
  // Simple formatting: convert line breaks to paragraphs
  return content.split('\n\n').map((paragraph, index) => (
    <p key={index} className="mb-4 text-chalk/90 leading-relaxed">
      {paragraph}
    </p>
  ));
}

/** Single post at /blog/:slug — a real, crawlable, shareable URL. */
export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (cancelled) return;
      if (fetchError) setError(getSafeErrorMessage(fetchError, 'Failed to load this post'));
      setPost(data ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  usePageMeta({
    title: post?.title,
    description: post?.description || post?.content.slice(0, 155),
    path: `/blog/${slug}`,
    jsonLd: post
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description || undefined,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          author: { '@type': 'Organization', name: 'Playbuilder Pro' },
          publisher: { '@type': 'Organization', name: 'Playbuilder Pro', url: 'https://playbuilderpro.com' },
          mainEntityOfPage: `https://playbuilderpro.com/blog/${post.slug}`,
        }
      : null,
  });

  return (
    <div className="min-h-screen bg-board">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/blog" className="inline-block mb-6 text-primary hover:text-primary-dark transition-colors">
          ← Back to Blog
        </Link>

        {loading ? (
          <div className="bg-board-light rounded-lg p-8 border border-chalk/10 animate-pulse">
            <div className="h-8 bg-chalk/10 rounded w-2/3 mb-6"></div>
            <div className="h-4 bg-chalk/10 rounded w-full mb-3"></div>
            <div className="h-4 bg-chalk/10 rounded w-5/6"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">{error}</div>
        ) : !post ? (
          <div className="text-center py-12">
            <Eye className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
            <h1 className="text-lg font-medium text-chalk mb-2">Post not found</h1>
            <p className="text-chalk/70">This post may have been removed or the link is incorrect.</p>
          </div>
        ) : (
          <article className="bg-board-light rounded-lg p-8 border border-chalk/10">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-chalk mb-4">{post.title}</h1>
              <div className="flex items-center gap-4 text-sm text-chalk/70">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Published {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>Playbuilder Pro</span>
                </div>
              </div>
            </header>

            <div className="prose prose-invert max-w-none">{formatContent(post.content)}</div>
          </article>
        )}
      </div>
    </div>
  );
}

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: 'Blog — Flag Football Coaching Tips & Strategy',
    description:
      'Coaching tips, play concepts, drills, and strategy for flag and youth football coaches, from the team behind Playbuilder Pro.',
    path: '/blog',
  });

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
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to load blog posts'));
    } finally {
      setLoading(false);
    }
  };

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
              <Link key={post.id} to={`/blog/${post.slug}`} className="block group">
                <article className="h-full bg-board-light rounded-lg overflow-hidden border border-chalk/10 hover:border-primary/30 transition-colors">
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
                      {post.description || `${post.content.substring(0, 150)}...`}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-chalk/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-chalk/70">
                          <User className="h-4 w-4 inline mr-1" />
                          Playbuilder Pro
                        </span>
                      </div>
                      <span className="text-sm text-chalk/70">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
