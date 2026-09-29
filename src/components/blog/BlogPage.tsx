import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, Tag, Calendar, User, Eye, Newspaper } from 'lucide-react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';
import { parseSections } from '../../lib/blogMarkdown';
import { promoteImplicitHeadings, plainExcerpt } from '../../lib/blogText';
import { categorize, type Category, type CategoryId } from '../../lib/blogTaxonomy';
import { BlogCoverArt } from './BlogCoverArt';
import { floodlights, gridPaper } from '../../lib/ambient';
import { format } from 'date-fns';

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

type BlogPostView = BlogPost & { category: Category };

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') as CategoryId | null;

  // Derived once per fetch, not per render — a regex sweep over every post's
  // title/description on every keystroke of a filter would be the kind of
  // thing that makes a page feel cheap.
  const postViews = useMemo<BlogPostView[]>(
    () => posts.map((p) => ({ ...p, category: categorize(p) })),
    [posts],
  );
  const availableCategories = useMemo(() => {
    const counts = new Map<CategoryId, { category: Category; count: number }>();
    for (const p of postViews) {
      const entry = counts.get(p.category.id);
      if (entry) entry.count += 1;
      else counts.set(p.category.id, { category: p.category, count: 1 });
    }
    return Array.from(counts.values());
  }, [postViews]);
  const visiblePosts = activeCategory
    ? postViews.filter((p) => p.category.id === activeCategory)
    : postViews;
  // The featured treatment is always the overall newest post, shown only
  // when no filter is active — a featured card that doesn't match the
  // active filter would read as a bug, not a feature.
  const featured = !activeCategory ? visiblePosts[0] : undefined;
  const gridPosts = featured ? visiblePosts.slice(1) : visiblePosts;

  // Filtered views are query params on the canonical /blog, not separate
  // pages — usePageMeta below hardcodes path: '/blog' deliberately, so a
  // filtered view never self-canonicalizes into a thin duplicate URL.
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
      {/* Hero band — the same ambient vocabulary (floodlights + grid paper)
          as the homepage hero, so the blog reads as the same site instead
          of a bolted-on afterthought. */}
      <div className="relative bg-board overflow-hidden border-b border-chalk/10">
        <div className="absolute inset-0 pointer-events-none" style={floodlights} aria-hidden="true" />
        <div className="absolute inset-0 pointer-events-none" style={gridPaper} aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex items-center gap-2 mb-3">
            <Book className="h-5 w-5 text-primary" />
            <p className="font-label text-sm text-primary font-semibold tracking-widest uppercase">The Chalkboard</p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-chalk">Coaching, drawn up.</h1>
          <p className="mt-4 font-editorial text-lg text-chalk/70 max-w-2xl">
            Insights, strategies, and expert advice for youth football coaches and players.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Featured post — the newest post, full width. Dates here are
            relative ("4 days ago"); grid cards below use an absolute date
            instead — formatDistanceToNow on all of them turned a dated
            archive into "2 months ago / 2 months ago / 3 months ago", which
            is less informative and reads staler than it is. */}
        {!loading && featured && (
          <Link to={`/blog/${featured.slug}`} className="group block mb-10">
            <article className="overflow-hidden rounded-xl border border-chalk/10 bg-board-light transition-colors hover:border-primary/30 lg:flex">
              <div className="relative aspect-video lg:aspect-auto lg:w-3/5 shrink-0">
                <BlogCoverArt slug={featured.slug} className="absolute inset-0 block w-full h-full" />
              </div>
              <div className="p-5 sm:p-7 lg:flex-1 lg:flex lg:flex-col lg:justify-center">
                <p className="font-label text-xs uppercase tracking-widest text-primary">Latest</p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl text-chalk group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                <p className="mt-3 font-editorial text-chalk/70 line-clamp-3">
                  {featured.description || plainExcerpt(featured.content, 200)}
                </p>
                <p className="mt-4 font-label text-xs text-chalk/50">
                  {featured.category.label}
                  {' · '}
                  {formatDistanceToNow(new Date(featured.published_at), { addSuffix: true })}
                </p>
              </div>
            </article>
          </Link>
        )}

        {/* Category filter — only categories actually present, with counts.
            flex-wrap (not a horizontal scroller) so pills can never cause
            horizontal overflow at 320px. */}
        {!loading && availableCategories.length > 1 && (
          <nav aria-label="Filter posts by category" className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSearchParams((p) => { p.delete('category'); return p; })}
              aria-pressed={!activeCategory}
              className={`tap-target rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                !activeCategory
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-chalk/15 text-chalk/70 hover:border-chalk/30 hover:text-chalk'
              }`}
            >
              All <span className={!activeCategory ? 'text-primary/60' : 'text-chalk/40'}>{postViews.length}</span>
            </button>
            {availableCategories.map(({ category, count }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSearchParams((p) => { p.set('category', category.id); return p; })}
                aria-pressed={activeCategory === category.id}
                className={`tap-target rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-chalk/15 text-chalk/70 hover:border-chalk/30 hover:text-chalk'
                }`}
              >
                {category.label}{' '}
                <span className={activeCategory === category.id ? 'text-primary/60' : 'text-chalk/40'}>{count}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-board-light rounded-lg overflow-hidden border border-chalk/10 animate-pulse">
                <div className="aspect-video bg-chalk/10"></div>
                <div className="p-4">
                  <div className="h-5 bg-chalk/10 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-chalk/10 rounded w-full mb-2"></div>
                  <div className="h-3 bg-chalk/10 rounded w-5/6 mb-4"></div>
                  <div className="h-3 bg-chalk/10 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          /* Empty State — no posts at all */
          <div className="text-center py-12">
            <Newspaper className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-chalk mb-2">No blog posts yet</h3>
            <p className="text-chalk/70">
              Check back soon for insights and strategies from our coaching experts.
            </p>
          </div>
        ) : visiblePosts.length === 0 ? (
          /* Empty State — filter matched nothing. Distinct from "no posts at
             all": reusing that state here would read as a broken page. */
          <div className="text-center py-12">
            <Eye className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-chalk mb-2">
              No posts in {availableCategories.find((c) => c.category.id === activeCategory)?.category.label ?? 'this category'} yet
            </h3>
            <button
              type="button"
              onClick={() => setSearchParams((p) => { p.delete('category'); return p; })}
              className="text-primary hover:text-primary-dark transition-colors"
            >
              Show all posts
            </button>
          </div>
        ) : (
          /* Blog Posts Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="block group">
                <article className="h-full flex flex-col bg-board-light rounded-lg overflow-hidden border border-chalk/10 hover:border-primary/30 transition-colors">
                  <div className="aspect-video overflow-hidden">
                    <BlogCoverArt slug={post.slug} className="block w-full h-full" />
                  </div>
                  <div className="p-6 flex flex-1 flex-col">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        <Tag className="h-3 w-3 mr-1" />
                        {post.category.label}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-chalk mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-chalk/70 mb-4 line-clamp-3">
                      {post.description || plainExcerpt(post.content, 150)}
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-chalk/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-chalk/70">
                          <User className="h-4 w-4 inline mr-1" />
                          Playbuilder Pro
                        </span>
                      </div>
                      <span className="text-sm text-chalk/70">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        {format(new Date(post.published_at), 'MMM d, yyyy')}
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
