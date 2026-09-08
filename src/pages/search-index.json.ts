import { getCollection } from 'astro:content';
import { stripMarkdown, fmtDate } from '../lib/format';

export async function GET() {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const index = posts.map((p) => ({
    title: p.data.title,
    description: p.data.description,
    tags: p.data.tags,
    category: p.data.category,
    date: fmtDate(p.data.pubDate),
    url: `/blog/${p.id}/`,
    excerpt: stripMarkdown(p.body),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
