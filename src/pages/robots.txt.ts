import type { APIContext } from 'astro';
export function GET(context: APIContext) {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /account/\nDisallow: /shelf/\nDisallow: /api/\nSitemap: ${new URL('/sitemap-index.xml', context.site || context.url.origin).href}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
