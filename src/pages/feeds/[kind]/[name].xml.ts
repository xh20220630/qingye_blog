import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { isPublished } from '../../../lib/publishing';
import { siteConfig } from '../../../config';

export async function getStaticPaths() {
  const posts = await getCollection('blog', isPublished);
  return ['category', 'tag', 'series'].flatMap(kind => [...new Set(posts.flatMap(p => kind === 'tag' ? p.data.tags : [kind === 'category' ? p.data.category : p.data.series]).filter(Boolean))].map(name => ({ params: { kind, name } })));
}
export async function GET(context: APIContext) {
  const { kind, name } = context.params;
  const posts = (await getCollection('blog', isPublished)).filter(p => kind === 'tag' ? p.data.tags.includes(name!) : kind === 'category' ? p.data.category === name : p.data.series === name).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({ title: `${siteConfig.name} · ${name}`, description: `${name} 主题的新文章`, site: context.site || siteConfig.url, items: posts.map(p => ({ title: p.data.title, description: p.data.description, pubDate: p.data.pubDate, link: `/blog/${p.id}/`, categories: p.data.tags })), customData: '<language>zh-CN</language>' });
}
