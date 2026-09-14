import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { isPublished } from '../lib/publishing';
import { stripMarkdown } from '../lib/format';
import { siteConfig } from '../config';

export async function GET(context: APIContext) {
  const origin = context.site || siteConfig.url;
  const posts = (await getCollection('blog', isPublished)).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return new Response(JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: siteConfig.name, home_page_url: String(origin), feed_url: new URL('/feed.json', origin).href, description: siteConfig.description, language: 'zh-CN', items: posts.map(p => ({ id: new URL(`/blog/${p.id}/`, origin).href, url: new URL(`/blog/${p.id}/`, origin).href, title: p.data.title, summary: p.data.description, content_text: stripMarkdown(p.body, Number.POSITIVE_INFINITY), date_published: p.data.pubDate.toISOString(), ...(p.data.updatedDate ? { date_modified: p.data.updatedDate.toISOString() } : {}), authors: [{ name: p.data.author }], tags: [p.data.category, ...p.data.tags] })) }), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } });
}
