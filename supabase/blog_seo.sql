-- Blog SEO foundation (Phase 1 of the SEO/content workflow).
-- Run once in the Supabase SQL Editor. Idempotent.
--
-- Adds to blog_posts:
--   slug        - URL-safe unique identifier for /blog/<slug> routes
--   description - meta description shown in search results (~155 chars)
--   status      - 'draft' | 'published'; only published posts are public.
--                 The weekly content agent inserts drafts; an admin publishes.

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published'));

-- Backfill slugs for existing posts from their titles.
UPDATE blog_posts
SET slug = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Deduplicate any collisions by suffixing the row id's first 8 chars.
UPDATE blog_posts b
SET slug = b.slug || '-' || left(b.id::text, 8)
WHERE EXISTS (
  SELECT 1 FROM blog_posts o
  WHERE o.slug = b.slug AND o.id <> b.id AND o.created_at < b.created_at
);

ALTER TABLE blog_posts ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_key ON blog_posts (slug);

-- Tighten reads: the public sees only published posts; admins see drafts too.
-- (Replaces the old anyone-can-SELECT policy.)
DROP POLICY IF EXISTS "Anyone can read blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Public can view published blog posts" ON blog_posts;
CREATE POLICY "Public can view published blog posts"
  ON blog_posts FOR SELECT
  USING (status = 'published' OR is_admin());
