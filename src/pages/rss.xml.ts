import rss from '@astrojs/rss';
import { siteConfig } from '../config';
import { isPublished } from '../lib/publishing';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', isPublished))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: context.site ?? siteConfig.url,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/blog/${p.id}/`,
      categories: [p.data.category, ...p.data.tags],
    })),
    customData: '<language>zh-CN</language>',
  });
}
