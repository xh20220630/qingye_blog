import { isPublished } from '../lib/publishing';
import { getCollection } from 'astro:content';
import { stripMarkdown, fmtDate } from '../lib/format';

export async function GET() {
  const posts = (await getCollection('blog', isPublished))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const index = posts.map((p) => ({
    title: p.data.title,
    description: p.data.description,
    tags: p.data.tags,
    category: p.data.category,
    slug: p.id,
    series: p.data.series || '',
    year: p.data.pubDate.getFullYear(),
    timestamp: p.data.pubDate.valueOf(),
    date: fmtDate(p.data.pubDate),
    url: `/blog/${p.id}/`,
    excerpt: stripMarkdown(p.body, Number.POSITIVE_INFINITY),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
