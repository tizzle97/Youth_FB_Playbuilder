import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, Tag, Calendar, User, Eye } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';
import { parseSections } from '../../lib/blogMarkdown';
import { promoteImplicitHeadings, plainExcerpt } from '../../lib/blogText';
import { BlogCoverArt } from './BlogCoverArt';

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

/** External links get target=_blank+rel (DOMPurify strips those attributes
 *  from content, so they can't be content-controlled); same-origin links are
 *  intercepted so an in-post link to e.g. /designer is a client-side
 *  transition instead of a full reload. Delegated on the container rather
 *  than per-anchor, since the anchors come from dangerouslySetInnerHTML. */
function useBlogLinkBehavior(
  containerRef: React.RefObject<HTMLElement>,
  navigate: ReturnType<typeof useNavigate>,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const a of Array.from(container.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        navigate(href);
      }
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  });
}

/** Single post at /blog/:slug — a real, crawlable, shareable URL. */
export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const articleRef = useRef<HTMLDivElement>(null);
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

  const sections = useMemo(
    () => (post ? parseSections(promoteImplicitHeadings(post.content)) : []),
    [post],
  );
  useBlogLinkBehavior(articleRef, navigate);

  usePageMeta({
    title: post?.title,
    description: post?.description || (post ? plainExcerpt(post.content) : undefined),
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
      {/* max-w-[42rem] targets ~68 characters at the article's text size —
          the old max-w-4xl (896px) ran ~105ch, well past comfortable
          reading measure. Step 6 wraps this in a wider page shell for a
          sidebar; the article column itself stays this width. */}
      <div className="max-w-[42rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/blog" className="inline-block mb-6 text-primary hover:text-primary-dark transition-colors">
          ← Back to Blog
        </Link>

        {loading ? (
          <div className="bg-board-light rounded-lg p-4 sm:p-8 border border-chalk/10 animate-pulse">
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
          <>
            {/* Title lives below the cover, never overlaid on it — legibility
                over generated art can't be inspected for a post that doesn't
                exist yet, and it's the likeliest way to break at 320px. */}
            <div className="aspect-[2/1] xs:aspect-[21/9] rounded-lg overflow-hidden border border-chalk/10 mb-6">
              <BlogCoverArt slug={post.slug} className="block w-full h-full" animate />
            </div>
            <article className="bg-board-light rounded-lg p-4 sm:p-8 border border-chalk/10">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-chalk mb-4 break-words">{post.title}</h1>
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

            <div
              ref={articleRef}
              className="prose prose-invert prose-article max-w-none break-words font-editorial text-[17px] sm:text-lg leading-[1.75]"
            >
              {/* Sanitized by sanitizeBlogHtml() inside parseSections() before it ever reaches here. */}
              {sections.map((section, i) => (
                <div key={section.id ?? `lead-${i}`} dangerouslySetInnerHTML={{ __html: section.html }} />
              ))}
            </div>
            </article>
          </>
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
    title: 'Blog — Youth & Flag Football Coaching Tips',
    description:
      'Coaching tips, play concepts, drills, and strategy for youth and flag football coaches, from the team behind Playbuilder Pro.',
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
        <div className="bg-board-light rounded-lg p-4 sm:p-8 mb-8 border border-chalk/10">
          <div className="flex items-center gap-3 mb-4">
            <Book className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-chalk">Blog</h1>
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
                  <div className="aspect-video overflow-hidden">
                    <BlogCoverArt slug={post.slug} className="block w-full h-full" />
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
