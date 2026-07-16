// Dynamic sitemap.xml for playbuilderpro.com.
//
// Served through the Netlify proxy redirect in public/_redirects:
//   /sitemap.xml -> this function (200 proxy, same-origin for crawlers)
//
// Deploy with JWT verification DISABLED (crawlers can't send a JWT):
//   supabase functions deploy sitemap --no-verify-jwt
// Read-only; only published blog posts and static routes are listed.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://playbuilderpro.com';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

const STATIC_ROUTES = ['/', '/blog', '/community', '/plays', '/privacy', '/terms', '/contact'];

Deno.serve(async () => {
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const urls = [
    ...STATIC_ROUTES.map((path) => `  <url><loc>${SITE}${path}</loc></url>`),
    ...(posts ?? []).map(
      (p) =>
        `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod></url>`,
    ),
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
